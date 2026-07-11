import {
	type AiToolId,
	buildGenerateProfilePrompt,
	generatedProfileOutputJsonSchema,
	parseCliGeneratedProfileOutput,
} from "@cv-tailor/ai";
import {
	type CvLanguage,
	cvLanguages,
	hasMeaningfulProfileContent,
	normalizeBaseProfile,
	summarizeProfileContent,
} from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { cn } from "@cv-tailor/ui/lib/utils";
import {
	interactiveCard,
	interactiveSegment,
} from "@cv-tailor/ui/lib/interactive-styles";
import { FileSearch, Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { resolveEffectiveAiModel, useCvApp } from "@/lib/cv-app-context";
import { formatLocalizedDate, useCvLanguageLabel } from "@/lib/i18n-labels";
import {
	mergeProfileFileSources,
	PROFILE_SOURCE_FILE_ACCEPT,
	type ProfileFileSource,
	readProfileSourceFiles,
} from "@/lib/profile-source-files";
import { formatSourceError, parseSourceUrls } from "@/lib/profile-source-urls";
import {
	type AiRunProgressEvent,
	fetchUrlText,
	isTauriRuntime,
	runAiToolResilient,
} from "@/lib/tauri-ai";

interface ProfileImporterProps {
	selectedTool: AiToolId;
	canUseAi: boolean;
	preferredTone: string;
}

type ProfileTargetMode = "current" | "new";

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

function appendProgressLine(current: string[], text: string) {
	const trimmed = text.trim();
	if (!trimmed) {
		return current;
	}

	return [...current, trimmed];
}

function TargetModeButton({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-md border px-3 py-2 text-left text-sm",
				interactiveSegment,
				active
					? "border-primary bg-primary text-primary-foreground"
					: "border-border text-muted-foreground hover:bg-muted",
			)}
		>
			{label}
		</button>
	);
}

export function ProfileImporter({
	selectedTool,
	canUseAi,
	preferredTone,
}: ProfileImporterProps) {
	const { t } = useTranslation();
	const cvLanguageLabel = useCvLanguageLabel();
	const {
		aiModels,
		aiStatuses,
		applyGeneratedProfile,
		profileRecord,
		profiles,
		switchProfile,
	} = useCvApp();
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [contextText, setContextText] = useState("");
	const [urlsText, setUrlsText] = useState("");
	const [fileSources, setFileSources] = useState<ProfileFileSource[]>([]);
	const [targetMode, setTargetMode] = useState<ProfileTargetMode>("current");
	const [targetLanguage, setTargetLanguage] = useState<CvLanguage>(
		profileRecord?.language ?? "en",
	);
	const [newProfileName, setNewProfileName] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationPhase, setGenerationPhase] = useState<string>();
	const [generationLog, setGenerationLog] = useState<string[]>([]);
	const [isReadingFiles, setIsReadingFiles] = useState(false);
	const [sourceResults, setSourceResults] = useState<SourceResult[]>([]);
	const [rawOutput, setRawOutput] = useState<string>();
	const logEndRef = useRef<HTMLDivElement>(null);
	const sourceUrls = parseSourceUrls(urlsText);
	const hasInput =
		contextText.trim().length > 0 ||
		sourceUrls.length > 0 ||
		fileSources.length > 0;
	const canGenerate = hasInput && canUseAi && !isGenerating && !isReadingFiles;
	const sortedProfiles = [...profiles].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);

	useEffect(() => {
		if (targetMode === "current" && profileRecord?.language) {
			setTargetLanguage(profileRecord.language);
		}
	}, [profileRecord?.id, profileRecord?.language, targetMode]);

	useEffect(() => {
		if (!isGenerating) {
			return;
		}

		logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}, [generationLog, isGenerating]);

	function handleAiProgress(event: AiRunProgressEvent) {
		if (event.stream === "status") {
			setGenerationPhase(event.text);
		}

		setGenerationLog((current) => appendProgressLine(current, event.text));
	}

	async function fetchSources(urls: string[]): Promise<SourceResult[]> {
		if (urls.length === 0) {
			return [];
		}

		if (!isTauriRuntime()) {
			return urls.map((url) => ({
				url,
				text: "",
				error: t("profile.importer.error.urlFetchDesktop"),
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
						? t("profile.importer.toast.fileAdded")
						: t("profile.importer.toast.filesAdded", {
								count: succeeded.length,
							}),
				);
			}

			if (failed.length > 0) {
				toast.error(
					failed.length === 1
						? t("profile.importer.toast.fileReadFailed")
						: t("profile.importer.toast.filesReadFailed"),
					{
						description: failed[0]?.error,
					},
				);
			}
		} catch (error) {
			toast.error(t("profile.importer.toast.filesReadError"), {
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
			toast.error(t("profile.importer.toast.noContext"));
			return;
		}

		if (!canUseAi) {
			toast.error(t("profile.importer.toast.noAi"));
			return;
		}

		const preparingMessage = t("profile.importer.progress.preparing");
		setIsGenerating(true);
		setGenerationPhase(preparingMessage);
		setGenerationLog([preparingMessage]);
		setRawOutput(undefined);

		try {
			if (sourceUrls.length > 0) {
				const fetchingMessage = t("profile.importer.progress.fetching");
				setGenerationPhase(fetchingMessage);
				setGenerationLog((current) =>
					appendProgressLine(current, fetchingMessage),
				);
			}

			const fetchedSources = await fetchSources(sourceUrls);
			setSourceResults(fetchedSources);

			const hasReadableSource =
				contextText.trim().length > 0 ||
				hasReadableText(fetchedSources) ||
				hasReadableText(fileSources);

			if (!hasReadableSource) {
				throw new Error(t("profile.importer.error.noReadableText"));
			}

			const runningAiMessage = t("profile.importer.progress.runningAi");
			setGenerationPhase(runningAiMessage);
			setGenerationLog((current) =>
				appendProgressLine(current, runningAiMessage),
			);

			const prompt = buildGenerateProfilePrompt({
				contextText,
				sourceUrls,
				fetchedSources,
				fileSources,
				preferredTone,
				targetLanguage,
			});
			const response = await runAiToolResilient(
				{
					tool: selectedTool,
					prompt,
					schema: generatedProfileOutputJsonSchema,
					model: resolveEffectiveAiModel(selectedTool, aiStatuses, aiModels),
				},
				{
					statuses: aiStatuses,
					model: resolveEffectiveAiModel(selectedTool, aiStatuses, aiModels),
					models: aiModels,
					onProgress: handleAiProgress,
				},
			);
			setRawOutput(response.stdout);

			try {
				const profile = normalizeBaseProfile(
					parseCliGeneratedProfileOutput(response.stdout),
				);

				if (!hasMeaningfulProfileContent(profile)) {
					toast.warning(t("profile.importer.toast.emptyProfile"), {
						description: t("profile.importer.toast.emptyProfileDescription"),
					});
					return;
				}

				await applyGeneratedProfile(profile, {
					mode: targetMode,
					language: targetLanguage,
					name: targetMode === "new" ? newProfileName : undefined,
				});
				toast.success(
					targetMode === "new"
						? t("profile.importer.toast.created")
						: t("profile.importer.toast.updated"),
					{
						description: t("profile.importer.toast.successDescription", {
							language: cvLanguageLabel(targetLanguage),
							summary: summarizeProfileContent(profile),
						}),
					},
				);
				if (targetMode === "new") {
					setNewProfileName("");
				}
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
			toast.error(t("profile.importer.toast.failed"), {
				description: getErrorMessage(error),
			});
		} finally {
			setIsGenerating(false);
			setGenerationPhase(undefined);
		}
	}

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>{t("profile.importer.title")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-3">
					<Label>{t("profile.importer.saveTo")}</Label>
					<div className="grid gap-2 sm:grid-cols-2">
						<TargetModeButton
							active={targetMode === "current"}
							label={
								profileRecord
									? t("profile.importer.updateNamed", {
											profileName: profileRecord.name,
										})
									: t("profile.importer.updateCurrent")
							}
							onClick={() => setTargetMode("current")}
						/>
						<TargetModeButton
							active={targetMode === "new"}
							label={t("profile.importer.createNew")}
							onClick={() => setTargetMode("new")}
						/>
					</div>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="grid gap-3">
						<Label>{t("profile.importer.language")}</Label>
						<Select
							value={targetLanguage}
							onValueChange={(value) => {
								if (value) {
									setTargetLanguage(value as CvLanguage);
								}
							}}
						>
							<SelectTrigger
								className="w-full max-w-xs"
								aria-label={t("profile.importer.languageAriaLabel")}
							>
								<SelectValue
									placeholder={t("profile.importer.languagePlaceholder")}
								>
									{cvLanguageLabel(targetLanguage)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{cvLanguages.map((option) => (
									<SelectItem key={option} value={option}>
										{cvLanguageLabel(option)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{targetMode === "new" ? (
						<div className="grid gap-3">
							<Label>{t("profile.importer.name")}</Label>
							<Input
								value={newProfileName}
								onChange={(event) => setNewProfileName(event.target.value)}
								placeholder={t("profile.importer.namePlaceholder", {
									language: cvLanguageLabel(targetLanguage),
								})}
							/>
						</div>
					) : null}
				</div>
				<div className="grid gap-3">
					<Label>{t("profile.importer.context")}</Label>
					<Textarea
						value={contextText}
						onChange={(event) => setContextText(event.target.value)}
						placeholder={t("profile.importer.contextPlaceholder")}
						rows={6}
					/>
				</div>
				<div className="grid gap-3">
					<div className="flex items-center justify-between gap-2">
						<Label>{t("profile.importer.files")}</Label>
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
							{t("profile.importer.addFiles")}
						</Button>
					</div>
					<input
						ref={fileInputRef}
						id={fileInputId}
						type="file"
						accept={PROFILE_SOURCE_FILE_ACCEPT}
						multiple
						className="sr-only"
						onChange={(event) => void handleFilesSelected(event.target.files)}
					/>
					<p className="text-muted-foreground text-xs">
						{t("profile.importer.filesHelp")}
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
												: t("profile.importer.chars", {
														count: file.text.length,
													})}
										</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => removeFileSource(file.name)}
										aria-label={t("profile.importer.removeFile", {
											fileName: file.name,
										})}
									>
										<X className="size-3.5" />
									</Button>
								</div>
							))}
						</div>
					) : null}
				</div>
				<div className="grid gap-3">
					<Label>{t("profile.importer.urls")}</Label>
					<Textarea
						value={urlsText}
						onChange={(event) => setUrlsText(event.target.value)}
						placeholder={t("profile.importer.urlsPlaceholder")}
						rows={3}
					/>
				</div>
				<Button
					onClick={() => void handleGenerateProfile()}
					disabled={!canGenerate}
				>
					{isGenerating ? <Loader2 className="animate-spin" /> : <FileSearch />}
					{t("profile.importer.submit")}
				</Button>
				{isGenerating ? (
					<div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
						<p className="font-medium text-xs">
							{generationPhase ?? t("profile.importer.progress.working")}
						</p>
						{generationLog.length > 0 ? (
							<div className="max-h-48 overflow-auto">
								<pre className="text-xs leading-relaxed">
									{generationLog.join("\n")}
								</pre>
								<div ref={logEndRef} />
							</div>
						) : null}
					</div>
				) : generationLog.length > 0 ? (
					<div className="grid gap-2 rounded-lg border p-3">
						<p className="font-medium text-xs">
							{t("profile.importer.lastLog")}
						</p>
						<pre className="max-h-48 overflow-auto text-xs leading-relaxed">
							{generationLog.join("\n")}
						</pre>
					</div>
				) : null}
				{!canUseAi ? (
					<p className="text-destructive text-xs">
						{t("profile.importer.aiNotReady")}
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
										: t("profile.importer.sourceStatus", {
												status:
													source.status?.toString() ??
													t("profile.importer.sourceFetched"),
												count: source.text.length,
											})}
								</p>
							</div>
						))}
					</div>
				) : null}
				{rawOutput ? (
					<div className="grid gap-2">
						<p className="font-medium text-xs">
							{t("profile.importer.rawResponse")}
						</p>
						<pre className="max-h-60 overflow-auto border p-2 text-xs">
							{rawOutput}
						</pre>
					</div>
				) : null}
				{sortedProfiles.length > 0 ? (
					<div className="grid gap-2 border-t pt-3">
						<div className="flex items-center justify-between gap-2">
							<Label>
								{t("profile.importer.allProfiles", {
									count: sortedProfiles.length,
								})}
							</Label>
						</div>
						<div className="grid gap-1">
							{sortedProfiles.map((item) => {
								const active = item.id === profileRecord?.id;
								const preview =
									item.contact.name.trim() ||
									item.summary.trim() ||
									item.headline.trim() ||
									t("profile.importer.noContent");
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => switchProfile(item.id)}
										className={cn(
											"grid gap-1 rounded-lg border p-2 text-left text-xs",
											interactiveCard,
											active
												? "border-primary bg-primary/5"
												: "hover:bg-muted/50",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium">{item.name}</span>
											<span className="text-muted-foreground">
												{cvLanguageLabel(item.language)}
											</span>
										</div>
										<p className="truncate text-muted-foreground">{preview}</p>
										<p className="text-[11px] text-muted-foreground">
											{t("profile.importer.updated", {
												date: formatLocalizedDate(item.updatedAt),
											})}
										</p>
									</button>
								);
							})}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
