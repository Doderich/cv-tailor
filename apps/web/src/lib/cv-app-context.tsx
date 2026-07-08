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
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import {
	type AiToolStatus,
	detectAiTools,
	exportGeneratedCvPdf,
	isTauriRuntime,
	runAiTool,
} from "@/lib/tauri-ai";

export interface JobDraft {
	title: string;
	company: string;
	rawText: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const blankJobDraft: JobDraft = {
	title: "",
	company: "",
	rawText: "",
};

interface CvAppContextValue {
	activeGeneratedCv: GeneratedCv | undefined;
	aiStatuses: AiToolStatus[];
	appState: AppState;
	canGenerate: boolean;
	canUseSelectedAi: boolean;
	generationError: string | undefined;
	isExportingPdf: boolean;
	isGenerating: boolean;
	jobDraft: JobDraft;
	matchAnalysis: ReturnType<typeof scoreProfileAgainstJob>;
	rawCliOutput: string | undefined;
	saveStatus: SaveStatus;
	selectedTool: AiToolId;
	setJobDraft: Dispatch<SetStateAction<JobDraft>>;
	setSelectedTool: Dispatch<SetStateAction<AiToolId>>;
	createDraftCv: () => void;
	duplicateGeneratedCv: (generatedCv: GeneratedCv) => void;
	exportPdf: () => Promise<void>;
	generateCv: () => Promise<void>;
	refreshAiStatuses: () => Promise<void>;
	reopenGeneratedCv: (generatedCv: GeneratedCv) => void;
	replaceProfile: (profile: BaseProfile) => void;
	signals: ReturnType<typeof extractJobSignals>;
	updateActiveCv: (cv: TailoredCv) => void;
	updateProfile: (profile: BaseProfile) => void;
}

const CvAppContext = createContext<CvAppContextValue | undefined>(undefined);

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

export function CvAppProvider({ children }: { children: ReactNode }) {
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
	const canUseSelectedAi = toolIsReady(selectedTool, aiStatuses);
	const canGenerate =
		jobDraft.rawText.trim().length > 0 && canUseSelectedAi && !isGenerating;

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

	async function generateCv() {
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

	function createDraftCv() {
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

	function updateActiveCv(cv: TailoredCv) {
		setAppState((state) => {
			const activeId = state.activeGeneratedCvId ?? state.generatedCvs[0]?.id;
			if (!activeId) {
				return state;
			}

			const now = new Date().toISOString();
			return appStateSchema.parse({
				...state,
				generatedCvs: state.generatedCvs.map((item) =>
					item.id === activeId ? { ...item, cv, updatedAt: now } : item,
				),
			});
		});
	}

	function reopenGeneratedCv(generatedCv: GeneratedCv) {
		setAppState((state) =>
			appStateSchema.parse({ ...state, activeGeneratedCvId: generatedCv.id }),
		);
		setJobDraft({
			title: generatedCv.jobOffer.title,
			company: generatedCv.jobOffer.company,
			rawText: generatedCv.jobOffer.rawText,
		});
	}

	function duplicateGeneratedCv(generatedCv: GeneratedCv) {
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

	async function exportPdf() {
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

	const value: CvAppContextValue = {
		activeGeneratedCv,
		aiStatuses,
		appState,
		canGenerate,
		canUseSelectedAi,
		createDraftCv,
		duplicateGeneratedCv,
		exportPdf,
		generateCv,
		generationError,
		isExportingPdf,
		isGenerating,
		jobDraft,
		matchAnalysis,
		rawCliOutput,
		refreshAiStatuses,
		reopenGeneratedCv,
		replaceProfile: (profile) =>
			setAppState((state) => replaceProfileInState(state, profile)),
		saveStatus,
		selectedTool,
		setJobDraft,
		setSelectedTool,
		signals,
		updateActiveCv,
		updateProfile: (profile) =>
			setAppState((state) => updateProfileInState(state, profile)),
	};

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
