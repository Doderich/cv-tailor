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
import { FileSearch, Loader2, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import {
	mergeProfileFileSources,
	PROFILE_SOURCE_FILE_ACCEPT,
	type ProfileFileSource,
	readProfileSourceFiles,
} from "@/lib/profile-source-files";
import {
	formatSourceError,
	parseSourceUrls,
} from "@/lib/profile-source-urls";
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
	return formatSourceError(error);
}

function hasReadableText(sources: Array<{ text: string }>) {
	return sources.some((source) => source.text.trim().length > 0);
}

export function ProfileImporter({
	selectedTool,
	canUseAi,
	preferredTone,
	onProfileGenerated,
}: ProfileImporterProps) {
	const { aiModels, aiStatuses } = useCvApp();
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [contextText, setContextText] = useState("");
	const [urlsText, setUrlsText] = useState("");
	const [fileSources, setFileSources] = useState<ProfileFileSource[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isReadingFiles, setIsReadingFiles] = useState(false);
	const [sourceResults, setSourceResults] = useState<SourceResult[]>([]);
	const [rawOutput, setRawOutput] = useState<string>();
	const sourceUrls = parseSourceUrls(urlsText);
	const hasInput =
		contextText.trim().length > 0 ||
		sourceUrls.length > 0 ||
		fileSources.length > 0;
	const canGenerate = hasInput && canUseAi && !isGenerating && !isReadingFiles;

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

	async function handleFilesSelected(files: FileList | null) {
		if (!files || files.length === 0) {
			return;
		}

		setIsReadingFiles(true);

		try {
			const nextFiles = await readProfileSourceFiles(files);
			setFileSources((current) => mergeProfileFileSources(current, nextFiles));

			const failed = nextFiles.filter((file) => file.error);
			const succeeded = nextFiles.filter((file) => !file.error);

			if (succeeded.length > 0) {
				toast.success(
					succeeded.length === 1
						? "File added to context"
						: `${succeeded.length} files added to context`,
				);
			}

			if (failed.length > 0) {
				toast.error(
					failed.length === 1
						? "Could not read file"
						: "Some files could not be read",
					{
						description: failed[0]?.error,
					},
				);
			}
		} catch (error) {
			toast.error("Could not read files", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsReadingFiles(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	}

	function removeFileSource(name: string) {
		setFileSources((current) =>
			current.filter((file) => file.name.toLowerCase() !== name.toLowerCase()),
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

			const hasReadableSource =
				contextText.trim().length > 0 ||
				hasReadableText(fetchedSources) ||
				hasReadableText(fileSources);

			if (!hasReadableSource) {
				throw new Error(
					"No readable text was found in the context, URLs, or uploaded files.",
				);
			}

			const prompt = buildGenerateProfilePrompt({
				contextText,
				sourceUrls,
				fetchedSources,
				fileSources,
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
				requestAnimationFrame(() => {
					document.getElementById("profile-editor")?.scrollIntoView({
						behavior: "smooth",
						block: "start",
					});
				});
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
				<div className="grid gap-3">
					<Label>Context</Label>
					<Textarea
						value={contextText}
						onChange={(event) => setContextText(event.target.value)}
						placeholder="Paste resume text, LinkedIn profile text, notes, achievements, projects, education, languages, and links."
						rows={6}
					/>
				</div>
				<div className="grid gap-3">
					<div className="flex items-center justify-between gap-2">
						<Label>Local files</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isReadingFiles}
							onClick={() => fileInputRef.current?.click()}
						>
							{isReadingFiles ? (
								<Loader2 className="animate-spin" />
							) : (
								<Paperclip />
							)}
							Add files
						</Button>
					</div>
					<input
						ref={fileInputRef}
						id={fileInputId}
						type="file"
						accept={PROFILE_SOURCE_FILE_ACCEPT}
						multiple
						className="sr-only"
						onChange={(event) =>
							void handleFilesSelected(event.target.files)
						}
					/>
					<p className="text-muted-foreground text-xs">
						Upload resume files as text or PDF. PDF extraction works in the
						desktop app.
					</p>
					{fileSources.length > 0 ? (
						<div className="grid gap-1 text-xs">
							{fileSources.map((file) => (
								<div
									key={file.name}
									className="flex items-start justify-between gap-2 border p-2"
								>
									<div className="min-w-0">
										<p className="truncate font-medium">{file.name}</p>
										<p
											className={
												file.error
													? "text-destructive"
													: "text-muted-foreground"
											}
										>
											{file.error
												? file.error
												: `${file.text.length} chars`}
										</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => removeFileSource(file.name)}
										aria-label={`Remove ${file.name}`}
									>
										<X className="size-3.5" />
									</Button>
								</div>
							))}
						</div>
					) : null}
				</div>
				<div className="grid gap-3">
					<Label>Public URLs</Label>
					<Textarea
						value={urlsText}
						onChange={(event) => setUrlsText(event.target.value)}
						placeholder={"https://www.linkedin.com/in/...\nhttps://example.com/about"}
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
