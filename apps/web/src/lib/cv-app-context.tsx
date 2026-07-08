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
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import type {
	ApplicationView,
	ApplicationViewType,
} from "@/lib/application-views";
import {
	type AiToolStatus,
	detectAiTools,
	exportGeneratedCvPdf,
	isTauriRuntime,
	runAiTool,
} from "@/lib/tauri-ai";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface JobOfferPatch {
	title?: string;
	company?: string;
	rawText?: string;
}

interface ViewsEntry {
	views: ApplicationView[];
	activeViewId: string;
}

type ViewsByApp = Record<string, ViewsEntry>;

interface CvAppContextValue {
	appState: AppState;
	profile: BaseProfile;
	applications: GeneratedCv[];
	activeApplications: GeneratedCv[];
	archivedApplications: GeneratedCv[];
	activeApplication: GeneratedCv | undefined;
	activeId: string | undefined;
	activeViews: ApplicationView[];
	activeViewId: string | undefined;
	activeView: ApplicationView | undefined;
	aiStatuses: AiToolStatus[];
	selectedTool: AiToolId;
	saveStatus: SaveStatus;
	canUseSelectedAi: boolean;
	canGenerateActive: boolean;
	isGenerating: boolean;
	isExportingPdf: boolean;
	generationError: string | undefined;
	rawCliOutput: string | undefined;
	setSelectedTool: (tool: AiToolId) => void;
	refreshAiStatuses: () => Promise<void>;
	createApplication: () => string;
	deleteApplication: (id: string) => void;
	restoreApplication: (application: GeneratedCv) => void;
	archiveApplication: (id: string, archived: boolean) => void;
	openApplication: (id: string) => void;
	setActiveId: (id: string) => void;
	openView: (type: ApplicationViewType) => void;
	closeView: (viewId: string) => void;
	setActiveView: (viewId: string) => void;
	updateActiveJobOffer: (patch: JobOfferPatch) => void;
	updateActiveCv: (cv: TailoredCv) => void;
	generateActive: () => Promise<void>;
	exportPdf: () => Promise<void>;
	replaceProfile: (profile: BaseProfile) => void;
	updateProfile: (profile: BaseProfile) => void;
}

const CvAppContext = createContext<CvAppContextValue | undefined>(undefined);

export function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" ? message : JSON.stringify(error);
	}

	return String(error);
}

export function toolIsReady(tool: AiToolId, statuses: AiToolStatus[]) {
	if (!isTauriRuntime()) {
		return false;
	}

	if (tool === "auto") {
		return statuses.some((status) => status.available);
	}

	return Boolean(statuses.find((status) => status.id === tool)?.available);
}

export function applicationTitle(application: GeneratedCv) {
	return application.jobOffer.title.trim() || "Untitled role";
}

export function applicationCompany(application: GeneratedCv) {
	return application.jobOffer.company.trim() || "No company";
}

export function isDraftApplication(application: GeneratedCv) {
	return application.aiTool === "draft";
}

function defaultViewsFor(appId: string): ViewsEntry {
	const id = `${appId}:editor`;
	return { views: [{ id, type: "editor" }], activeViewId: id };
}

function createEmptyApplication(profile: BaseProfile): GeneratedCv {
	const now = new Date().toISOString();
	const signals = extractJobSignals("");
	const jobOffer: JobOffer = {
		id: createId("job"),
		title: "",
		company: "",
		rawText: "",
		createdAt: now,
		signals,
	};

	return {
		id: createId("app"),
		createdAt: now,
		updatedAt: now,
		jobOffer,
		signals,
		matchAnalysis: scoreProfileAgainstJob(profile, jobOffer),
		cv: createDefaultTailoredCv(profile),
		aiTool: "draft",
	};
}

export function CvAppProvider({ children }: { children: ReactNode }) {
	const [appState, setAppState] = useState<AppState>(() =>
		createDefaultAppState(),
	);
	const [viewsByApp, setViewsByApp] = useState<ViewsByApp>({});
	const [selectedTool, setSelectedTool] = useState<AiToolId>("auto");
	const [aiStatuses, setAiStatuses] = useState<AiToolStatus[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isExportingPdf, setIsExportingPdf] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [generationError, setGenerationError] = useState<string>();
	const [rawCliOutput, setRawCliOutput] = useState<string>();
	const hasLoaded = useRef(false);

	const profile = appState.profile;
	const applications = appState.generatedCvs;
	const activeApplications = applications.filter((item) => !item.archived);
	const archivedApplications = applications.filter((item) => item.archived);
	const activeId = appState.activeGeneratedCvId;
	const activeApplication =
		applications.find((item) => item.id === activeId) ?? activeApplications[0];

	const activeViewsEntry = activeApplication
		? (viewsByApp[activeApplication.id] ??
			defaultViewsFor(activeApplication.id))
		: undefined;
	const activeViews = activeViewsEntry?.views ?? [];
	const activeViewId = activeViewsEntry?.activeViewId;
	const activeView = activeViews.find((view) => view.id === activeViewId);

	const canUseSelectedAi = toolIsReady(selectedTool, aiStatuses);
	const canGenerateActive =
		Boolean(activeApplication?.jobOffer.rawText.trim()) &&
		canUseSelectedAi &&
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
		try {
			setAiStatuses(await detectAiTools());
		} catch (error) {
			toast.error("Could not detect AI tools", {
				description: getErrorMessage(error),
			});
		}
	}

	function createApplication() {
		const application = createEmptyApplication(profile);
		setAppState((state) =>
			appStateSchema.parse({
				...state,
				generatedCvs: [application, ...state.generatedCvs],
				activeGeneratedCvId: application.id,
			}),
		);
		setViewsByApp((prev) => ({
			...prev,
			[application.id]: defaultViewsFor(application.id),
		}));
		return application.id;
	}

	function deleteApplication(id: string) {
		setAppState((state) => {
			const remaining = state.generatedCvs.filter((item) => item.id !== id);
			const nextActive =
				state.activeGeneratedCvId === id
					? remaining.find((item) => !item.archived)?.id
					: state.activeGeneratedCvId;
			return appStateSchema.parse({
				...state,
				generatedCvs: remaining,
				activeGeneratedCvId: nextActive,
			});
		});
		setViewsByApp((prev) => {
			const { [id]: _removed, ...rest } = prev;
			return rest;
		});
	}

	function restoreApplication(application: GeneratedCv) {
		setAppState((state) =>
			appStateSchema.parse({
				...state,
				generatedCvs: [
					application,
					...state.generatedCvs.filter((item) => item.id !== application.id),
				],
				activeGeneratedCvId: application.id,
			}),
		);
	}

	function archiveApplication(id: string, archived: boolean) {
		setAppState((state) => {
			const now = new Date().toISOString();
			const generatedCvs = state.generatedCvs.map((item) =>
				item.id === id ? { ...item, archived, updatedAt: now } : item,
			);
			let activeGeneratedCvId = state.activeGeneratedCvId;
			if (archived && activeGeneratedCvId === id) {
				activeGeneratedCvId = generatedCvs.find(
					(item) => item.id !== id && !item.archived,
				)?.id;
			}
			return appStateSchema.parse({
				...state,
				generatedCvs,
				activeGeneratedCvId,
			});
		});
	}

	function openApplication(id: string) {
		setAppState((state) =>
			appStateSchema.parse({ ...state, activeGeneratedCvId: id }),
		);
	}

	function setActiveId(id: string) {
		openApplication(id);
	}

	function openView(type: ApplicationViewType) {
		const application = activeApplication;
		if (!application) {
			return;
		}

		setViewsByApp((prev) => {
			const entry = prev[application.id] ?? defaultViewsFor(application.id);
			const existing = entry.views.find((view) => view.type === type);
			if (existing) {
				return {
					...prev,
					[application.id]: { ...entry, activeViewId: existing.id },
				};
			}

			const view: ApplicationView = {
				id: `${application.id}:${type}:${createId("view")}`,
				type,
			};
			return {
				...prev,
				[application.id]: {
					views: [...entry.views, view],
					activeViewId: view.id,
				},
			};
		});
	}

	function closeView(viewId: string) {
		const application = activeApplication;
		if (!application) {
			return;
		}

		setViewsByApp((prev) => {
			const entry = prev[application.id] ?? defaultViewsFor(application.id);
			const index = entry.views.findIndex((view) => view.id === viewId);
			if (index === -1) {
				return prev;
			}

			const views = entry.views.filter((view) => view.id !== viewId);
			if (views.length === 0) {
				return { ...prev, [application.id]: defaultViewsFor(application.id) };
			}

			let activeViewId = entry.activeViewId;
			if (activeViewId === viewId) {
				activeViewId = (views[index] ?? views[index - 1] ?? views[0]).id;
			}
			return { ...prev, [application.id]: { views, activeViewId } };
		});
	}

	function setActiveView(viewId: string) {
		const application = activeApplication;
		if (!application) {
			return;
		}

		setViewsByApp((prev) => {
			const entry = prev[application.id] ?? defaultViewsFor(application.id);
			return {
				...prev,
				[application.id]: { ...entry, activeViewId: viewId },
			};
		});
	}

	function updateActiveJobOffer(patch: JobOfferPatch) {
		setAppState((state) => {
			const targetId = state.activeGeneratedCvId ?? state.generatedCvs[0]?.id;
			if (!targetId) {
				return state;
			}

			const now = new Date().toISOString();
			return appStateSchema.parse({
				...state,
				generatedCvs: state.generatedCvs.map((item) => {
					if (item.id !== targetId) {
						return item;
					}

					const rawText = patch.rawText ?? item.jobOffer.rawText;
					const signals = extractJobSignals(rawText);
					const jobOffer: JobOffer = {
						...item.jobOffer,
						...patch,
						signals,
					};

					return {
						...item,
						jobOffer,
						signals,
						matchAnalysis: scoreProfileAgainstJob(state.profile, jobOffer),
						updatedAt: now,
					};
				}),
			});
		});
	}

	function updateActiveCv(cv: TailoredCv) {
		setAppState((state) => {
			const targetId = state.activeGeneratedCvId ?? state.generatedCvs[0]?.id;
			if (!targetId) {
				return state;
			}

			const now = new Date().toISOString();
			return appStateSchema.parse({
				...state,
				generatedCvs: state.generatedCvs.map((item) =>
					item.id === targetId ? { ...item, cv, updatedAt: now } : item,
				),
			});
		});
	}

	async function generateActive() {
		const application = activeApplication;
		if (!application || !canGenerateActive) {
			return;
		}

		setIsGenerating(true);
		setGenerationError(undefined);
		setRawCliOutput(undefined);

		const signals = extractJobSignals(application.jobOffer.rawText);
		const jobOffer: JobOffer = { ...application.jobOffer, signals };
		const analysis = scoreProfileAgainstJob(profile, jobOffer);
		const prompt = buildTailorCvPrompt({
			profile,
			jobOffer,
			signals,
			matchAnalysis: analysis,
		});

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
			setAppState((state) =>
				appStateSchema.parse({
					...state,
					generatedCvs: state.generatedCvs.map((item) =>
						item.id === application.id
							? {
									...item,
									jobOffer,
									signals,
									matchAnalysis: analysis,
									cv: parsedCv,
									aiTool: response.tool,
									rawAiOutput: response.stdout,
									updatedAt: now,
								}
							: item,
					),
				}),
			);
			toast.success("Tailored CV generated");
		} catch (error) {
			const message = getErrorMessage(error);
			setGenerationError(message);
			toast.error("Generation failed", { description: message });
		} finally {
			setIsGenerating(false);
		}
	}

	async function exportPdf() {
		if (!activeApplication) {
			return;
		}

		if (!isTauriRuntime()) {
			window.print();
			return;
		}

		setIsExportingPdf(true);

		try {
			const response = await exportGeneratedCvPdf(profile, activeApplication);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: value is rebuilt from the appState + viewsByApp snapshots; handlers close over current values.
	const value = useMemo<CvAppContextValue>(
		() => ({
			appState,
			profile,
			applications,
			activeApplications,
			archivedApplications,
			activeApplication,
			activeId,
			activeViews,
			activeViewId,
			activeView,
			aiStatuses,
			selectedTool,
			saveStatus,
			canUseSelectedAi,
			canGenerateActive,
			isGenerating,
			isExportingPdf,
			generationError,
			rawCliOutput,
			setSelectedTool,
			refreshAiStatuses,
			createApplication,
			deleteApplication,
			restoreApplication,
			archiveApplication,
			openApplication,
			setActiveId,
			openView,
			closeView,
			setActiveView,
			updateActiveJobOffer,
			updateActiveCv,
			generateActive,
			exportPdf,
			replaceProfile: (next) =>
				setAppState((state) =>
					appStateSchema.parse({
						...state,
						profile: next,
					}),
				),
			updateProfile: (next) =>
				setAppState((state) =>
					appStateSchema.parse({ ...state, profile: next }),
				),
		}),
		[
			appState,
			viewsByApp,
			aiStatuses,
			selectedTool,
			saveStatus,
			canUseSelectedAi,
			canGenerateActive,
			isGenerating,
			isExportingPdf,
			generationError,
			rawCliOutput,
		],
	);

	return (
		<CvAppContext.Provider value={value}>{children}</CvAppContext.Provider>
	);
}

export function useCvApp() {
	const context = useContext(CvAppContext);
	if (!context) {
		throw new Error("useCvApp must be used inside CvAppProvider.");
	}

	return context;
}
