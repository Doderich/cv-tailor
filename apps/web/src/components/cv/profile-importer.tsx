import {
	type AiToolId,
	buildGenerateProfilePrompt,
	generatedProfileOutputJsonSchema,
	parseCliGeneratedProfileOutput,
} from "@cv-tailor/ai";
import { type BaseProfile, normalizeBaseProfile } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { FileSearch, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { fetchUrlText, isTauriRuntime, runAiTool } from "@/lib/tauri-ai";
import { resolveEffectiveAiModel, useCvApp } from "@/lib/cv-app-context";

interface ProfileImporterProps {
	selectedTool: AiToolId;
	canUseAi: boolean;
	preferredTone: string;
	onProfileGenerated: (profile: BaseProfile) => void;
}

interface SourceResult {
	url: string;
	text: string;
	status?: number;
	error?: string;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" ? message : JSON.stringify(error);
	}

	return String(error);
}

function parseUrls(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function ProfileImporter({
	selectedTool,
	canUseAi,
	preferredTone,
	onProfileGenerated,
}: ProfileImporterProps) {
	const { aiModels, aiStatuses } = useCvApp();
	const [contextText, setContextText] = useState("");
	const [urlsText, setUrlsText] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [sourceResults, setSourceResults] = useState<SourceResult[]>([]);
	const [rawOutput, setRawOutput] = useState<string>();
	const sourceUrls = parseUrls(urlsText);
	const hasInput = contextText.trim().length > 0 || sourceUrls.length > 0;
	const canGenerate = hasInput && canUseAi && !isGenerating;

	async function fetchSources(urls: string[]): Promise<SourceResult[]> {
		if (urls.length === 0) {
			return [];
		}

		if (!isTauriRuntime()) {
			return urls.map((url) => ({
				url,
				text: "",
				error: "Open the Tauri desktop app to fetch public URLs.",
			}));
		}

		return Promise.all(
			urls.map(async (url) => {
				try {
					const response = await fetchUrlText(url);
					return {
						url: response.url,
						text: response.text,
						status: response.status,
					};
				} catch (error) {
					return {
						url,
						text: "",
						error: getErrorMessage(error),
					};
				}
			}),
		);
	}

	async function handleGenerateProfile() {
		if (!hasInput) {
			toast.error("Add profile context first");
			return;
		}

		if (!canUseAi) {
			toast.error("No local AI tool is ready");
			return;
		}

		setIsGenerating(true);
		setRawOutput(undefined);

		try {
			const fetchedSources = await fetchSources(sourceUrls);
			setSourceResults(fetchedSources);

			const hasReadableSource = fetchedSources.some(
				(source) => source.text.trim().length > 0,
			);
			if (
				contextText.trim().length === 0 &&
				sourceUrls.length > 0 &&
				!hasReadableSource
			) {
				throw new Error("None of the URLs returned readable public text.");
			}

			const prompt = buildGenerateProfilePrompt({
				contextText,
				sourceUrls,
				fetchedSources,
				preferredTone,
			});
			const response = await runAiTool({
				tool: selectedTool,
				prompt,
				schema: generatedProfileOutputJsonSchema,
				model: resolveEffectiveAiModel(selectedTool, aiStatuses, aiModels),
			});

			try {
				const profile = normalizeBaseProfile(
					parseCliGeneratedProfileOutput(response.stdout),
				);
				onProfileGenerated(profile);
				toast.success("Profile created");
			} catch (error) {
				setRawOutput(response.stdout);
				throw error;
			}
		} catch (error) {
			toast.error("Profile creation failed", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsGenerating(false);
		}
	}

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Create Profile</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-1">
					<Label>Context</Label>
					<Textarea
						value={contextText}
						onChange={(event) => setContextText(event.target.value)}
						placeholder="Paste resume text, LinkedIn profile text, notes, achievements, projects, education, languages, and links."
						rows={6}
					/>
				</div>
				<div className="grid gap-1">
					<Label>Public URLs</Label>
					<Textarea
						value={urlsText}
						onChange={(event) => setUrlsText(event.target.value)}
						placeholder="https://www.linkedin.com/in/..."
						rows={3}
					/>
				</div>
				<Button
					onClick={() => void handleGenerateProfile()}
					disabled={!canGenerate}
				>
					{isGenerating ? <Loader2 className="animate-spin" /> : <FileSearch />}
					Create profile
				</Button>
				{!canUseAi ? (
					<p className="text-destructive text-xs">
						Local AI is not ready for profile creation.
					</p>
				) : null}
				{sourceResults.length > 0 ? (
					<div className="grid gap-1 text-xs">
						{sourceResults.map((source) => (
							<div key={source.url} className="border p-2">
								<p className="truncate font-medium">{source.url}</p>
								<p
									className={
										source.error ? "text-destructive" : "text-muted-foreground"
									}
								>
									{source.error
										? source.error
										: `${source.status ?? "Fetched"} · ${source.text.length} chars`}
								</p>
							</div>
						))}
					</div>
				) : null}
				{rawOutput ? (
					<pre className="max-h-40 overflow-auto border p-2 text-xs">
						{rawOutput}
					</pre>
				) : null}
			</CardContent>
		</Card>
	);
}
