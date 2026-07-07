import {
	type AiToolId,
	buildTailorCvPrompt,
	parseCliTailoredCvOutput,
	tailoredCvOutputJsonSchema,
} from "@cv-tailor/ai";
import {
	type AppState,
	appStateSchema,
	type BaseProfile,
	createDefaultAppState,
	createDefaultTailoredCv,
	createId,
	extractJobSignals,
	type GeneratedCv,
	type JobOffer,
	scoreProfileAgainstJob,
	type TailoredCv,
} from "@cv-tailor/core";
import { loadAppState, saveAppState } from "@cv-tailor/storage";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
	Copy,
	FileText,
	Loader2,
	Printer,
	RefreshCw,
	WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GeneratedCvEditor } from "@/components/cv/generated-cv-editor";
import { PrintableCv } from "@/components/cv/printable-cv";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import {
	type AiToolStatus,
	detectAiTools,
	exportGeneratedCvPdf,
	isTauriRuntime,
	runAiTool,
} from "@/lib/tauri-ai";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

interface JobDraft {
	title: string;
	company: string;
	rawText: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const blankJobDraft: JobDraft = {
	title: "",
	company: "",
	rawText: "",
};

function createJobOffer(draft: JobDraft, id = createId("job")): JobOffer {
	const signals = extractJobSignals(draft.rawText);

	return {
		id,
		title: draft.title,
		company: draft.company,
		rawText: draft.rawText,
		createdAt: new Date().toISOString(),
		signals,
	};
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

function toolIsReady(tool: AiToolId, statuses: AiToolStatus[]) {
	if (!isTauriRuntime()) {
		return false;
	}

	if (tool === "auto") {
		return statuses.some((status) => status.available);
	}

	return Boolean(statuses.find((status) => status.id === tool)?.available);
}

function updateProfileInState(state: AppState, profile: BaseProfile): AppState {
	return appStateSchema.parse({ ...state, profile });
}

function replaceProfileInState(
	state: AppState,
	profile: BaseProfile,
): AppState {
	return appStateSchema.parse({
		...state,
		profile,
		activeGeneratedCvId: undefined,
	});
}

function upsertGeneratedCv(
	state: AppState,
	generatedCv: GeneratedCv,
): AppState {
	const exists = state.generatedCvs.some((item) => item.id === generatedCv.id);
	const generatedCvs = exists
		? state.generatedCvs.map((item) =>
				item.id === generatedCv.id ? generatedCv : item,
			)
		: [generatedCv, ...state.generatedCvs];

	return appStateSchema.parse({
		...state,
		generatedCvs,
		activeGeneratedCvId: generatedCv.id,
	});
}

function HomeComponent() {
	const [appState, setAppState] = useState<AppState>(() =>
		createDefaultAppState(),
	);
	const [jobDraft, setJobDraft] = useState<JobDraft>(blankJobDraft);
	const [selectedTool, setSelectedTool] = useState<AiToolId>("auto");
	const [aiStatuses, setAiStatuses] = useState<AiToolStatus[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isExportingPdf, setIsExportingPdf] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [generationError, setGenerationError] = useState<string>();
	const [rawCliOutput, setRawCliOutput] = useState<string>();
	const hasLoaded = useRef(false);

	const signals = useMemo(
		() => extractJobSignals(jobDraft.rawText),
		[jobDraft.rawText],
	);
	const draftJobOffer = useMemo(
		() => ({
			id: "draft",
			title: jobDraft.title,
			company: jobDraft.company,
			rawText: jobDraft.rawText,
			createdAt: new Date(0).toISOString(),
			signals,
		}),
		[jobDraft, signals],
	);
	const matchAnalysis = useMemo(
		() => scoreProfileAgainstJob(appState.profile, draftJobOffer),
		[appState.profile, draftJobOffer],
	);
	const activeGeneratedCv =
		appState.generatedCvs.find(
			(item) => item.id === appState.activeGeneratedCvId,
		) ?? appState.generatedCvs[0];
	const canGenerate =
		jobDraft.rawText.trim().length > 0 &&
		toolIsReady(selectedTool, aiStatuses) &&
		!isGenerating;

	useEffect(() => {
		let isMounted = true;

		async function loadInitialState() {
			try {
				const state = await loadAppState();
				if (isMounted) {
					setAppState(state);
					hasLoaded.current = true;
					setSaveStatus("saved");
				}
			} catch (error) {
				if (isMounted) {
					hasLoaded.current = true;
					setSaveStatus("error");
					toast.error("Could not load local state", {
						description: getErrorMessage(error),
					});
				}
			}
		}

		async function loadAiStatuses() {
			try {
				setAiStatuses(await detectAiTools());
			} catch (error) {
				toast.error("Could not detect AI tools", {
					description: getErrorMessage(error),
				});
			}
		}

		void loadInitialState();
		void loadAiStatuses();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!hasLoaded.current) {
			return;
		}

		setSaveStatus("saving");
		const saveTimer = window.setTimeout(() => {
			saveAppState(appState)
				.then(() => setSaveStatus("saved"))
				.catch((error: unknown) => {
					setSaveStatus("error");
					toast.error("Could not save local state", {
						description: getErrorMessage(error),
					});
				});
		}, 400);

		return () => window.clearTimeout(saveTimer);
	}, [appState]);

	async function refreshAiStatuses() {
		setAiStatuses(await detectAiTools());
	}

	async function handleGenerate() {
		if (!canGenerate) {
			return;
		}

		setIsGenerating(true);
		setGenerationError(undefined);
		setRawCliOutput(undefined);

		const jobOffer = createJobOffer(jobDraft);
		const analysis = scoreProfileAgainstJob(appState.profile, jobOffer);
		const input = {
			profile: appState.profile,
			jobOffer,
			signals: jobOffer.signals ?? signals,
			matchAnalysis: analysis,
		};
		const prompt = buildTailorCvPrompt(input);

		try {
			const response = await runAiTool({
				tool: selectedTool,
				prompt,
				schema: tailoredCvOutputJsonSchema,
			});
			let parsedCv: TailoredCv;
			try {
				parsedCv = parseCliTailoredCvOutput(response.stdout);
			} catch (parseError) {
				setRawCliOutput(response.stdout);
				throw parseError;
			}
			const now = new Date().toISOString();
			const generatedCv: GeneratedCv = {
				id: createId("generated"),
				createdAt: now,
				updatedAt: now,
				jobOffer,
				signals: input.signals,
				matchAnalysis: analysis,
				cv: parsedCv,
				aiTool: response.tool,
				rawAiOutput: response.stdout,
			};

			setAppState((state) => upsertGeneratedCv(state, generatedCv));
			toast.success("Tailored CV generated");
		} catch (error) {
			const message = getErrorMessage(error);
			setGenerationError(message);
			toast.error("Generation failed", { description: message });
		} finally {
			setIsGenerating(false);
		}
	}

	function handleCreateDraftCv() {
		const jobOffer = createJobOffer(jobDraft);
		const analysis = scoreProfileAgainstJob(appState.profile, jobOffer);
		const now = new Date().toISOString();
		const generatedCv: GeneratedCv = {
			id: createId("generated"),
			createdAt: now,
			updatedAt: now,
			jobOffer,
			signals,
			matchAnalysis: analysis,
			cv: {
				...createDefaultTailoredCv(appState.profile),
				missingRequirements: analysis.missingRequirements,
				warnings: analysis.warnings,
			},
			aiTool: "deterministic-draft",
		};

		setAppState((state) => upsertGeneratedCv(state, generatedCv));
	}

	function handleUpdateActiveCv(cv: TailoredCv) {
		if (!activeGeneratedCv) {
			return;
		}

		setAppState((state) => {
			const now = new Date().toISOString();
			return appStateSchema.parse({
				...state,
				generatedCvs: state.generatedCvs.map((item) =>
					item.id === activeGeneratedCv.id
						? { ...item, cv, updatedAt: now }
						: item,
				),
			});
		});
	}

	function handleReopen(generatedCv: GeneratedCv) {
		setAppState((state) =>
			appStateSchema.parse({ ...state, activeGeneratedCvId: generatedCv.id }),
		);
		setJobDraft({
			title: generatedCv.jobOffer.title,
			company: generatedCv.jobOffer.company,
			rawText: generatedCv.jobOffer.rawText,
		});
	}

	function handleDuplicate(generatedCv: GeneratedCv) {
		const now = new Date().toISOString();
		setAppState((state) =>
			upsertGeneratedCv(state, {
				...generatedCv,
				id: createId("generated"),
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	async function handleExportPdf() {
		if (!activeGeneratedCv) {
			return;
		}

		if (!isTauriRuntime()) {
			window.print();
			return;
		}

		setIsExportingPdf(true);

		try {
			const response = await exportGeneratedCvPdf(
				appState.profile,
				activeGeneratedCv,
			);
			toast.success("PDF exported", {
				description: response.revealed
					? "The PDF was revealed in Finder."
					: response.path,
			});
		} catch (error) {
			toast.error("PDF export failed", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsExportingPdf(false);
		}
	}

	return (
		<>
			<main className="app-shell grid min-h-0 grid-rows-[auto_1fr_auto] overflow-hidden">
				<header className="flex shrink-0 items-center justify-between border-b px-4 py-2">
					<div>
						<h1 className="font-semibold text-base">CV Tailor</h1>
						<p className="text-muted-foreground text-xs">
							{isTauriRuntime()
								? "Desktop workspace"
								: "Web preview: local CLI generation disabled"}{" "}
							·{" "}
							{saveStatus === "saving"
								? "Saving"
								: saveStatus === "error"
									? "Save error"
									: "Saved"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Label className="sr-only" htmlFor="ai-tool">
							AI tool
						</Label>
						<select
							id="ai-tool"
							value={selectedTool}
							onChange={(event) =>
								setSelectedTool(event.target.value as AiToolId)
							}
							className="h-8 border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
						>
							<option value="auto">Auto</option>
							<option value="claude">Claude</option>
							<option value="codex">Codex</option>
						</select>
						<Button
							size="icon"
							variant="outline"
							onClick={() => void refreshAiStatuses()}
							title="Refresh AI tools"
						>
							<RefreshCw />
						</Button>
					</div>
				</header>

				<div className="grid min-h-0 gap-0 overflow-hidden xl:grid-cols-[380px_1fr_340px]">
					<section className="min-h-0 overflow-y-auto border-r p-4">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-medium text-sm">Base Profile</h2>
							<span className="text-muted-foreground text-xs">
								{appState.profile.experience.length} roles
							</span>
						</div>
						<div className="mb-4">
							<ProfileImporter
								selectedTool={selectedTool}
								canUseAi={toolIsReady(selectedTool, aiStatuses)}
								preferredTone={appState.profile.preferredTone}
								onProfileGenerated={(profile) =>
									setAppState((state) => replaceProfileInState(state, profile))
								}
							/>
						</div>
						<ProfileEditor
							profile={appState.profile}
							onChange={(profile) =>
								setAppState((state) => updateProfileInState(state, profile))
							}
						/>
					</section>

					<section className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
						<div className="grid gap-4 border-b p-4 lg:grid-cols-[1fr_260px]">
							<div className="grid gap-3">
								<div className="grid grid-cols-2 gap-2">
									<div className="grid gap-1">
										<Label>Job title</Label>
										<Input
											value={jobDraft.title}
											onChange={(event) =>
												setJobDraft((draft) => ({
													...draft,
													title: event.target.value,
												}))
											}
											placeholder="Senior Frontend Engineer"
										/>
									</div>
									<div className="grid gap-1">
										<Label>Company</Label>
										<Input
											value={jobDraft.company}
											onChange={(event) =>
												setJobDraft((draft) => ({
													...draft,
													company: event.target.value,
												}))
											}
											placeholder="Hiring company"
										/>
									</div>
								</div>
								<div className="grid gap-1">
									<Label>Job description</Label>
									<Textarea
										value={jobDraft.rawText}
										onChange={(event) =>
											setJobDraft((draft) => ({
												...draft,
												rawText: event.target.value,
											}))
										}
										placeholder="Paste the job offer text."
										rows={10}
									/>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										onClick={() => void handleGenerate()}
										disabled={!canGenerate}
									>
										{isGenerating ? (
											<Loader2 className="animate-spin" />
										) : (
											<WandSparkles />
										)}
										Generate tailored CV
									</Button>
									<Button
										variant="outline"
										onClick={handleCreateDraftCv}
										disabled={jobDraft.rawText.trim().length === 0}
									>
										<FileText /> Local draft
									</Button>
									<Button
										variant="outline"
										onClick={() => void handleExportPdf()}
										disabled={!activeGeneratedCv || isExportingPdf}
									>
										{isExportingPdf ? (
											<Loader2 className="animate-spin" />
										) : (
											<Printer />
										)}
										Export PDF
									</Button>
								</div>
								{!toolIsReady(selectedTool, aiStatuses) ? (
									<p className="text-destructive text-xs">
										{isTauriRuntime()
											? "Install or authenticate claude/codex, then refresh AI tools."
											: "Open the Tauri desktop app to run local AI CLIs."}
									</p>
								) : null}
								{generationError ? (
									<p className="text-destructive text-xs">{generationError}</p>
								) : null}
								{rawCliOutput ? (
									<pre className="max-h-40 overflow-auto border p-2 text-xs">
										{rawCliOutput}
									</pre>
								) : null}
							</div>

							<aside className="grid content-start gap-3 text-xs">
								<Metric label="Match score" value={`${matchAnalysis.score}%`} />
								<Metric label="Seniority" value={signals.seniority} />
								<Metric
									label="Keywords"
									value={signals.keywords.length.toString()}
								/>
								<div className="grid gap-1">
									<h3 className="font-medium">Detected keywords</h3>
									<TokenList values={signals.keywords.slice(0, 16)} />
								</div>
								<div className="grid gap-1">
									<h3 className="font-medium">Missing requirements</h3>
									<SmallList
										values={matchAnalysis.missingRequirements}
										empty="No clear gaps detected."
									/>
								</div>
							</aside>
						</div>

						<div className="min-h-0 overflow-y-auto p-4">
							<div className="mb-3 flex items-center justify-between">
								<div>
									<h2 className="font-medium text-sm">Tailored CV</h2>
									<p className="text-muted-foreground text-xs">
										{activeGeneratedCv
											? `${activeGeneratedCv.jobOffer.title || "Untitled role"} · ${
													activeGeneratedCv.jobOffer.company ||
													"Unknown company"
												}`
											: "No generated CV selected"}
									</p>
								</div>
							</div>
							<GeneratedCvEditor
								profile={appState.profile}
								generatedCv={activeGeneratedCv}
								onChange={handleUpdateActiveCv}
							/>
						</div>
					</section>

					<aside className="min-h-0 overflow-y-auto border-l p-4">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-medium text-sm">History</h2>
							<span className="text-muted-foreground text-xs">
								{appState.generatedCvs.length} versions
							</span>
						</div>

						<div className="mb-5 grid gap-2">
							{aiStatuses.map((status) => (
								<div key={status.id} className="border p-2 text-xs">
									<div className="flex items-center justify-between">
										<span className="font-medium">{status.label}</span>
										<span
											className={
												status.available ? "text-green-600" : "text-destructive"
											}
										>
											{status.available ? "Ready" : "Unavailable"}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground">
										{status.version || status.error}
									</p>
								</div>
							))}
						</div>

						<div className="grid gap-3">
							{appState.generatedCvs.map((generatedCv) => (
								<Card
									key={generatedCv.id}
									size="sm"
									role="button"
									tabIndex={0}
									onClick={() => handleReopen(generatedCv)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											handleReopen(generatedCv);
										}
									}}
									className={
										generatedCv.id === activeGeneratedCv?.id
											? "cursor-pointer ring-2 ring-ring transition-colors hover:bg-muted/40"
											: "cursor-pointer transition-colors hover:bg-muted/40"
									}
								>
									<CardHeader>
										<CardTitle>
											{generatedCv.jobOffer.title || "Untitled role"}
										</CardTitle>
									</CardHeader>
									<CardContent className="grid gap-2">
										<p className="text-muted-foreground text-xs">
											{generatedCv.jobOffer.company || "Unknown company"} ·{" "}
											{generatedCv.aiTool} ·{" "}
											{new Date(generatedCv.updatedAt).toLocaleDateString()}
										</p>
										<div className="flex gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={(event) => {
													event.stopPropagation();
													handleReopen(generatedCv);
												}}
											>
												Reopen
											</Button>
											<Button
												size="icon-sm"
												variant="ghost"
												onClick={(event) => {
													event.stopPropagation();
													handleDuplicate(generatedCv);
												}}
												title="Duplicate"
											>
												<Copy />
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</aside>
				</div>
			</main>
			<PrintableCv profile={appState.profile} generatedCv={activeGeneratedCv} />
		</>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="border p-2">
			<p className="text-muted-foreground">{label}</p>
			<p className="font-semibold text-lg">{value}</p>
		</div>
	);
}

function TokenList({ values }: { values: string[] }) {
	if (values.length === 0) {
		return <p className="text-muted-foreground">No keywords yet.</p>;
	}

	return (
		<div className="flex flex-wrap gap-1">
			{values.map((value) => (
				<span key={value} className="border bg-muted px-1.5 py-0.5 text-[11px]">
					{value}
				</span>
			))}
		</div>
	);
}

function SmallList({ values, empty }: { values: string[]; empty: string }) {
	if (values.length === 0) {
		return <p className="text-muted-foreground">{empty}</p>;
	}

	return (
		<ul className="grid gap-1">
			{values.slice(0, 6).map((value) => (
				<li key={value} className="border-destructive border-l-2 pl-2">
					{value}
				</li>
			))}
		</ul>
	);
}
