import {
	type AiToolId,
	buildTailorCvPrompt,
	parseCliTailoredCvOutput,
	tailoredCvOutputJsonSchema,
} from "@cv-tailor/ai";
import {
	type Application,
	type BaseProfile,
	type CvLanguage,
	type CvRun,
	createEmptyApplication,
	createId,
	cvLanguageLabel,
	cvLanguages,
	extractJobSignals,
	type JobOffer,
	type ProfileRecord,
	scoreProfileAgainstJob,
	type TailoredCv,
} from "@cv-tailor/core";
import { useLiveQuery } from "@tanstack/react-db";
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
import { useDb } from "@/lib/db-provider";
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

export interface ApplicationListItem extends Application {
	previewScore?: number;
	isDraft: boolean;
}

export interface DeletedApplicationSnapshot {
	application: Application;
	runs: CvRun[];
}

interface ViewsEntry {
	views: ApplicationView[];
	activeViewId: string;
}

type ViewsByApp = Record<string, ViewsEntry>;

interface CvAppContextValue {
	profile: BaseProfile;
	profileRecord: ProfileRecord | undefined;
	applications: ApplicationListItem[];
	activeApplications: ApplicationListItem[];
	archivedApplications: ApplicationListItem[];
	activeApplication: Application | undefined;
	activeRun: CvRun | undefined;
	activeRuns: CvRun[];
	activeId: string | undefined;
	selectedLanguage: CvLanguage;
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
	setSelectedLanguage: (language: CvLanguage) => void;
	refreshAiStatuses: () => Promise<void>;
	createApplication: () => string;
	deleteApplication: (id: string) => DeletedApplicationSnapshot | undefined;
	restoreApplication: (snapshot: DeletedApplicationSnapshot) => void;
	archiveApplication: (id: string, archived: boolean) => void;
	openApplication: (id: string) => void;
	setActiveId: (id: string) => void;
	openView: (type: ApplicationViewType) => void;
	closeView: (viewId: string) => void;
	setActiveView: (viewId: string) => void;
	updateActiveJobOffer: (patch: JobOfferPatch) => void;
	updateActiveCv: (cv: TailoredCv) => void;
	generateActive: (language?: CvLanguage) => Promise<void>;
	switchActiveRun: (runId: string) => void;
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

export function applicationTitle(application: Pick<Application, "jobOffer">) {
	return application.jobOffer.title.trim() || "Untitled role";
}

export function applicationCompany(application: Pick<Application, "jobOffer">) {
	return application.jobOffer.company.trim() || "No company";
}

function defaultViewsFor(appId: string): ViewsEntry {
	const id = `${appId}:editor`;
	return { views: [{ id, type: "editor" }], activeViewId: id };
}

function toListItem(
	application: Application,
	runs: CvRun[],
): ApplicationListItem {
	const latestRun = [...runs].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	)[0];
	const isDraft =
		runs.length === 0 || runs.every((run) => run.source === "draft");

	return {
		...application,
		previewScore: latestRun?.matchAnalysis.score,
		isDraft,
	};
}

function profileFromRecord(record: ProfileRecord | undefined): BaseProfile {
	if (!record) {
		return {
			contact: {
				name: "",
				email: "",
				phone: "",
				location: "",
				links: [],
			},
			headline: "",
			summary: "",
			targetRoles: [],
			preferredTone: "Clear, concise, confident, and factual.",
			skills: [],
			achievements: [],
			experience: [],
			education: [],
			projects: [],
			languages: [],
		};
	}

	const {
		id: _id,
		name: _name,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...profile
	} = record;
	return profile;
}

export function CvAppProvider({ children }: { children: ReactNode }) {
	const db = useDb();
	const [viewsByApp, setViewsByApp] = useState<ViewsByApp>({});
	const [selectedTool, setSelectedToolState] = useState<AiToolId>("auto");
	const [selectedLanguage, setSelectedLanguageState] =
		useState<CvLanguage>("en");
	const [aiStatuses, setAiStatuses] = useState<AiToolStatus[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isExportingPdf, setIsExportingPdf] = useState(false);
	const [generationError, setGenerationError] = useState<string>();
	const [rawCliOutput, setRawCliOutput] = useState<string>();
	const deletedSnapshots = useRef(
		new Map<string, DeletedApplicationSnapshot>(),
	);

	const {
		data: settings,
		isLoading: settingsLoading,
		status: settingsStatus,
	} = useLiveQuery((q) => q.from({ settings: db.settings }).findOne());
	const { data: profileRows = [], isLoading: profilesLoading } = useLiveQuery(
		(q) => q.from({ profile: db.profiles }),
	);
	const { data: applicationRows = [], isLoading: applicationsLoading } =
		useLiveQuery((q) => q.from({ application: db.applications }));
	const { data: runRows = [], isLoading: runsLoading } = useLiveQuery((q) =>
		q.from({ run: db.cvRuns }),
	);
	const { data: aiOutputRows = [] } = useLiveQuery((q) =>
		q.from({ output: db.aiOutputs }),
	);

	const profileRecord =
		profileRows.find((record) => record.id === settings?.activeProfileId) ??
		profileRows[0];
	const profile = profileFromRecord(profileRecord);
	const applications = useMemo(
		() =>
			applicationRows.map((application) =>
				toListItem(
					application,
					runRows.filter((run) => run.applicationId === application.id),
				),
			),
		[applicationRows, runRows],
	);
	const activeApplications = applications.filter((item) => !item.archived);
	const archivedApplications = applications.filter((item) => item.archived);
	const activeId = settings?.activeApplicationId;
	const activeApplication =
		applicationRows.find((item) => item.id === activeId) ??
		activeApplications[0];
	const activeRuns = runRows.filter(
		(run) => run.applicationId === activeApplication?.id,
	);
	const activeRun =
		activeRuns.find((run) => run.id === settings?.activeRunId) ??
		activeRuns.find((run) => run.language === selectedLanguage) ??
		activeRuns[0];

	const activeViewsEntry = activeApplication
		? (viewsByApp[activeApplication.id] ??
			defaultViewsFor(activeApplication.id))
		: undefined;
	const activeViews = activeViewsEntry?.views ?? [];
	const activeViewId = activeViewsEntry?.activeViewId;
	const activeView = activeViews.find((view) => view.id === activeViewId);

	const saveStatus: SaveStatus =
		settingsLoading || profilesLoading || applicationsLoading || runsLoading
			? "idle"
			: settingsStatus === "error"
				? "error"
				: "saved";

	const canUseSelectedAi = toolIsReady(selectedTool, aiStatuses);
	const canGenerateActive =
		Boolean(activeApplication?.jobOffer.rawText.trim()) &&
		canUseSelectedAi &&
		!isGenerating;

	useEffect(() => {
		if (activeRun?.language) {
			setSelectedLanguageState(activeRun.language);
		}
	}, [activeRun?.id, activeRun?.language]);

	useEffect(() => {
		async function loadAiStatuses() {
			try {
				setAiStatuses(await detectAiTools());
			} catch (error) {
				toast.error("Could not detect AI tools", {
					description: getErrorMessage(error),
				});
			}
		}

		void loadAiStatuses();
	}, []);

	function updateSettings(patch: Partial<typeof settings>) {
		if (!settings) {
			return;
		}

		db.settings.update("settings", (draft) => {
			Object.assign(draft, patch);
		});
	}

	function setSelectedTool(tool: AiToolId) {
		setSelectedToolState(tool);
		updateSettings({ selectedAiTool: tool });
	}

	function setSelectedLanguage(language: CvLanguage) {
		setSelectedLanguageState(language);
		const runForLanguage = activeRuns
			.filter((run) => run.language === language)
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
		if (runForLanguage) {
			updateSettings({ activeRunId: runForLanguage.id });
		}
	}

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
		if (!profileRecord) {
			return "";
		}

		const applicationId = createId("app");
		const { application, draftRun } = createEmptyApplication({
			id: applicationId,
			profileId: profileRecord.id,
			profile,
		});

		db.applications.insert(application);
		db.cvRuns.insert(draftRun);
		updateSettings({
			activeApplicationId: application.id,
			activeRunId: draftRun.id,
		});
		setViewsByApp((prev) => ({
			...prev,
			[application.id]: defaultViewsFor(application.id),
		}));
		setSelectedLanguageState("en");
		return application.id;
	}

	function deleteApplication(
		id: string,
	): DeletedApplicationSnapshot | undefined {
		const application = applicationRows.find((item) => item.id === id);
		const runs = runRows.filter((run) => run.applicationId === id);
		const snapshot = application ? { application, runs } : undefined;

		if (snapshot) {
			deletedSnapshots.current.set(id, snapshot);
		}

		for (const run of runs) {
			db.cvRuns.delete(run.id);
			for (const output of aiOutputRows.filter(
				(item) => item.cvRunId === run.id,
			)) {
				db.aiOutputs.delete(output.id);
			}
		}
		db.applications.delete(id);

		const remaining = applicationRows.filter((item) => item.id !== id);
		const nextActive =
			settings?.activeApplicationId === id
				? remaining.find((item) => !item.archived)?.id
				: settings?.activeApplicationId;
		const nextRuns = runRows.filter((run) => run.applicationId === nextActive);
		updateSettings({
			activeApplicationId: nextActive,
			activeRunId: nextRuns[0]?.id,
		});
		setViewsByApp((prev) => {
			const { [id]: _removed, ...rest } = prev;
			return rest;
		});
		return snapshot;
	}

	function restoreApplication(snapshot: DeletedApplicationSnapshot) {
		db.applications.insert(snapshot.application);
		for (const run of snapshot.runs) {
			db.cvRuns.insert(run);
		}
		updateSettings({
			activeApplicationId: snapshot.application.id,
			activeRunId: snapshot.runs[0]?.id,
		});
	}

	function archiveApplication(id: string, archived: boolean) {
		const now = new Date().toISOString();
		db.applications.update(id, (draft) => {
			draft.archived = archived;
			draft.updatedAt = now;
		});

		if (archived && settings?.activeApplicationId === id) {
			const nextActive = applicationRows.find(
				(item) => item.id !== id && !item.archived,
			)?.id;
			const nextRuns = runRows.filter(
				(run) => run.applicationId === nextActive,
			);
			updateSettings({
				activeApplicationId: nextActive,
				activeRunId: nextRuns[0]?.id,
			});
		}
	}

	function openApplication(id: string) {
		const runs = runRows.filter((run) => run.applicationId === id);
		updateSettings({
			activeApplicationId: id,
			activeRunId: runs[0]?.id,
		});
	}

	function setActiveId(id: string) {
		openApplication(id);
	}

	function switchActiveRun(runId: string) {
		const run = runRows.find((item) => item.id === runId);
		if (!run) {
			return;
		}

		updateSettings({ activeRunId: run.id });
		setSelectedLanguageState(run.language);
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
		const application = activeApplication;
		if (!application || !profileRecord) {
			return;
		}

		const now = new Date().toISOString();
		const rawText = patch.rawText ?? application.jobOffer.rawText;
		const signals = extractJobSignals(rawText);
		const jobOffer: JobOffer = {
			...application.jobOffer,
			...patch,
			signals,
		};

		db.applications.update(application.id, (draft) => {
			draft.jobOffer = jobOffer;
			draft.updatedAt = now;
		});

		for (const run of activeRuns) {
			db.cvRuns.update(run.id, (draft) => {
				draft.signals = signals;
				draft.matchAnalysis = scoreProfileAgainstJob(profile, jobOffer);
				draft.updatedAt = now;
			});
		}
	}

	function updateActiveCv(cv: TailoredCv) {
		const run = activeRun;
		if (!run) {
			return;
		}

		const now = new Date().toISOString();
		db.cvRuns.update(run.id, (draft) => {
			draft.cv = cv;
			draft.source = draft.source === "draft" ? "manual" : draft.source;
			draft.updatedAt = now;
		});
		if (activeApplication) {
			db.applications.update(activeApplication.id, (draft) => {
				draft.updatedAt = now;
			});
		}
	}

	async function generateActive(language = selectedLanguage) {
		const application = activeApplication;
		if (!application || !profileRecord || !canGenerateActive) {
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
			targetLanguage: language,
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
			const existingRunsForLanguage = activeRuns.filter(
				(run) => run.language === language,
			);
			const runId = createId("run");
			const newRun: CvRun = {
				id: runId,
				applicationId: application.id,
				profileId: profileRecord.id,
				language,
				label:
					existingRunsForLanguage.length === 0
						? cvLanguageLabel(language)
						: `${cvLanguageLabel(language)} v${existingRunsForLanguage.length + 1}`,
				cv: parsedCv,
				signals,
				matchAnalysis: analysis,
				aiTool: response.tool,
				source: "ai",
				createdAt: now,
				updatedAt: now,
			};

			db.cvRuns.insert(newRun);
			db.aiOutputs.insert({
				id: createId("output"),
				cvRunId: runId,
				stdout: response.stdout,
			});
			db.applications.update(application.id, (draft) => {
				draft.jobOffer = jobOffer;
				draft.updatedAt = now;
			});
			updateSettings({ activeRunId: runId });
			setSelectedLanguageState(language);
			toast.success(`${cvLanguageLabel(language)} CV generated`);
		} catch (error) {
			const message = getErrorMessage(error);
			setGenerationError(message);
			toast.error("Generation failed", { description: message });
		} finally {
			setIsGenerating(false);
		}
	}

	async function exportPdf() {
		if (!activeApplication || !activeRun || !profileRecord) {
			return;
		}

		if (!isTauriRuntime()) {
			window.print();
			return;
		}

		setIsExportingPdf(true);

		try {
			const response = await exportGeneratedCvPdf(
				profile,
				activeApplication,
				activeRun,
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

	function replaceProfile(next: BaseProfile) {
		if (!profileRecord) {
			return;
		}

		const now = new Date().toISOString();
		db.profiles.update(profileRecord.id, (draft) => {
			Object.assign(draft, next, {
				id: draft.id,
				name: draft.name,
				createdAt: draft.createdAt,
				updatedAt: now,
			});
		});
	}

	function updateProfile(next: BaseProfile) {
		replaceProfile(next);
	}

	useEffect(() => {
		if (settings?.selectedAiTool) {
			setSelectedToolState(settings.selectedAiTool as AiToolId);
		}
	}, [settings?.selectedAiTool]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: value is rebuilt from live query snapshots.
	const value = useMemo<CvAppContextValue>(
		() => ({
			profile,
			profileRecord,
			applications,
			activeApplications,
			archivedApplications,
			activeApplication,
			activeRun,
			activeRuns,
			activeId,
			selectedLanguage,
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
			setSelectedLanguage,
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
			switchActiveRun,
			exportPdf,
			replaceProfile,
			updateProfile,
		}),
		[
			profile,
			profileRecord,
			applications,
			activeApplications,
			archivedApplications,
			activeApplication,
			activeRun,
			activeRuns,
			activeId,
			selectedLanguage,
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

export { cvLanguageLabel, cvLanguages };
