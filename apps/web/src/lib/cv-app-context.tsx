import {
	type AiModels,
	type AiProviderId,
	type AiToolId,
	buildEvaluateProfileMatchPrompt,
	buildReviewJobPostingPrompt,
	buildTailorCvPrompt,
	claudeModelOptions,
	codexModelOptions,
	cursorModelOptions,
	defaultAiModels,
	jobPostingReviewOutputJsonSchema,
	matchAnalysisOutputJsonSchema,
	parseCliJobPostingReviewOutput,
	parseCliMatchAnalysisOutput,
	parseCliTailoredCvOutput,
	tailoredCvOutputJsonSchema,
} from "@cv-tailor/ai";
import {
	type Application,
	type BaseProfile,
	type CvLanguage,
	type CvRun,
	createDefaultAppSettings,
	createDefaultBaseProfile,
	createDefaultProfileRecord,
	createEmptyApplication,
	createId,
	createProfileRecord,
	cvLanguageLabel,
	cvLanguages,
	type JobOffer,
	type JobPostingReview,
	type JobSignals,
	jobOfferNeedsReview,
	type MatchAnalysis,
	normalizeBaseProfile,
	normalizeCvRun,
	normalizeProfileRecord,
	normalizeMatchAnalysis,
	profileMatchNeedsEvaluation,
	profilesHaveSameContent,
	type ProfileRecord,
	resolveCachedProfileMatch,
	resolveJobSignals,
	scoreProfileAgainstJob,
	type TailoredCv,
	type AppSettings,
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
import { createDebouncedCallback } from "@/lib/debounce";
import { exportAllData as exportBackup, importAllData as importBackup } from "@/lib/data-backup";
import {
	type AiToolStatus,
	detectAiTools,
	exportGeneratedCvPdf,
	formatAppError,
	isTauriRuntime,
	runAiToolResilient,
} from "@/lib/tauri-ai";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface JobOfferPatch {
	title?: string;
	company?: string;
	position?: JobOffer["position"];
	links?: string[];
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
	profiles: ProfileRecord[];
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
	aiModels: AiModels;
	effectiveAiProvider: AiProviderId | undefined;
	effectiveAiModel: string | undefined;
	saveStatus: SaveStatus;
	canUseSelectedAi: boolean;
	canGenerateActive: boolean;
	isGenerating: boolean;
	isReviewingJobOffer: boolean;
	isAnalyzingProfileMatch: boolean;
	isExportingPdf: boolean;
	generationError: string | undefined;
	jobReviewError: string | undefined;
	profileMatchError: string | undefined;
	rawCliOutput: string | undefined;
	rawJobReviewOutput: string | undefined;
	rawProfileMatchOutput: string | undefined;
	setSelectedTool: (tool: AiToolId) => void;
	setAiModel: (provider: AiProviderId, model: string) => void;
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
	reviewActiveJobOffer: (options?: { force?: boolean }) => Promise<void>;
	analyzeActiveProfileMatch: (options?: { force?: boolean }) => Promise<void>;
	generateActive: (language?: CvLanguage) => Promise<void>;
	switchActiveRun: (runId: string) => void;
	exportPdf: () => Promise<void>;
	exportAllData: () => Promise<void>;
	importAllData: (
		file: File,
		mode: "replace" | "merge",
	) => Promise<void>;
	isExportingData: boolean;
	isImportingData: boolean;
	profileRevision: number;
	replaceProfile: (profile: BaseProfile) => void;
	updateProfile: (profile: BaseProfile) => void;
	patchProfile: (patch: Partial<BaseProfile>) => void;
	createProfile: (name: string, language: CvLanguage) => string;
	switchProfile: (id: string) => void;
	deleteProfile: (id: string) => void;
	updateProfileMeta: (
		id: string,
		patch: Partial<Pick<ProfileRecord, "name" | "language">>,
	) => void;
	applyGeneratedProfile: (
		profile: BaseProfile,
		options: {
			mode: "current" | "new";
			language: CvLanguage;
			name?: string;
		},
	) => Promise<void>;
}

const CvAppContext = createContext<CvAppContextValue | undefined>(undefined);

export function getErrorMessage(error: unknown) {
	return formatAppError(error);
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

export function resolveEffectiveAiProvider(
	tool: AiToolId,
	statuses: AiToolStatus[],
): AiProviderId | undefined {
	if (tool === "claude" && toolIsReady("claude", statuses)) {
		return "claude";
	}

	if (tool === "codex" && toolIsReady("codex", statuses)) {
		return "codex";
	}

	if (tool === "cursor" && toolIsReady("cursor", statuses)) {
		return "cursor";
	}

	if (tool === "auto") {
		if (toolIsReady("claude", statuses)) {
			return "claude";
		}

		if (toolIsReady("codex", statuses)) {
			return "codex";
		}

		if (toolIsReady("cursor", statuses)) {
			return "cursor";
		}
	}

	return undefined;
}

export function resolveEffectiveAiModel(
	tool: AiToolId,
	statuses: AiToolStatus[],
	models: AiModels,
) {
	const provider = resolveEffectiveAiProvider(tool, statuses);
	return provider ? models[provider] : undefined;
}

export { claudeModelOptions, codexModelOptions, cursorModelOptions };

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
		return createDefaultBaseProfile();
	}

	const normalized = normalizeProfileRecord(record);
	const defaults = createDefaultBaseProfile();
	const {
		id: _id,
		name: _name,
		language: _language,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...profile
	} = normalized;

	return {
		...defaults,
		...profile,
		contact: {
			...defaults.contact,
			...profile.contact,
			links: profile.contact?.links ?? [],
		},
		targetRoles: profile.targetRoles ?? [],
		skills: profile.skills ?? [],
		achievements: profile.achievements ?? [],
		experience: profile.experience ?? [],
		education: profile.education ?? [],
		projects: profile.projects ?? [],
		languages: profile.languages ?? [],
	};
}

const persistDebounceMs = 400;

function mergeProfilePatch(
	current: Partial<BaseProfile>,
	patch: Partial<BaseProfile>,
): Partial<BaseProfile> {
	const next: Partial<BaseProfile> = { ...current, ...patch };
	if (patch.contact !== undefined) {
		next.contact = { ...current.contact, ...patch.contact };
	}
	return next;
}

function mergeJobOfferPatch(
	current: JobOfferPatch,
	patch: JobOfferPatch,
): JobOfferPatch {
	const next: JobOfferPatch = { ...current, ...patch };
	if (patch.links !== undefined) {
		next.links = [...patch.links];
	}
	return next;
}

export function CvAppProvider({ children }: { children: ReactNode }) {
	const db = useDb();
	const [viewsByApp, setViewsByApp] = useState<ViewsByApp>({});
	const [selectedLanguage, setSelectedLanguageState] =
		useState<CvLanguage>("en");
	const [aiStatuses, setAiStatuses] = useState<AiToolStatus[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isReviewingJobOffer, setIsReviewingJobOffer] = useState(false);
	const [isAnalyzingProfileMatch, setIsAnalyzingProfileMatch] = useState(false);
	const [isExportingPdf, setIsExportingPdf] = useState(false);
	const [isExportingData, setIsExportingData] = useState(false);
	const [isImportingData, setIsImportingData] = useState(false);
	const [generationError, setGenerationError] = useState<string>();
	const [jobReviewError, setJobReviewError] = useState<string>();
	const [profileMatchError, setProfileMatchError] = useState<string>();
	const [rawCliOutput, setRawCliOutput] = useState<string>();
	const [rawJobReviewOutput, setRawJobReviewOutput] = useState<string>();
	const [rawProfileMatchOutput, setRawProfileMatchOutput] = useState<string>();
	const [profileRevision, setProfileRevision] = useState(0);
	const [profileSnapshot, setProfileSnapshot] = useState<BaseProfile | undefined>();
	const profileSnapshotUpdatedAtRef = useRef<string | undefined>(undefined);
	const deletedSnapshots = useRef(
		new Map<string, DeletedApplicationSnapshot>(),
	);
	const pendingAiSettingsRef = useRef<
		Partial<Pick<AppSettings, "selectedAiTool" | "aiModels">>
	>({});

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
	const normalizedRunRows = useMemo(
		() => runRows.map((run) => normalizeCvRun(run)),
		[runRows],
	);
	const { data: aiOutputRows = [] } = useLiveQuery((q) =>
		q.from({ output: db.aiOutputs }),
	);

	const profileRecord =
		profileRows
			.map((record) => normalizeProfileRecord(record))
			.find((record) => record.id === settings?.activeProfileId) ??
		(profileRows[0] ? normalizeProfileRecord(profileRows[0]) : undefined);
	const profiles = profileRows.map((record) => normalizeProfileRecord(record));
	const storedProfile = profileFromRecord(profileRecord);
	const profile = profileSnapshot ?? storedProfile;
	const profileRecordRef = useRef(profileRecord);
	const settingsRef = useRef(settings);
	const pendingProfilePatchRef = useRef<Partial<BaseProfile>>({});
	const pendingJobOfferPatchRef = useRef<JobOfferPatch>({});
	const pendingCvRef = useRef<TailoredCv | undefined>(undefined);
	const applicationRowsRef = useRef(applicationRows);
	const runRowsRef = useRef(runRows);
	const selectedLanguageRef = useRef(selectedLanguage);
	const aiStatusesRef = useRef(aiStatuses);
	const selectedToolRef = useRef<AiToolId>("auto");
	const aiModelsRef = useRef<AiModels>(defaultAiModels);
	const effectiveAiModelRef = useRef<string | undefined>(undefined);
	const profileMatchRequestRef = useRef(0);
	const persistProfilePatchRef = useRef<(patch: Partial<BaseProfile>) => void>(
		() => undefined,
	);
	const persistJobOfferPatchRef = useRef<(patch: JobOfferPatch) => void>(
		() => undefined,
	);
	const persistCvRef = useRef<(cv: TailoredCv) => void>(() => undefined);
	const debouncedPersistProfilePatch = useRef(
		createDebouncedCallback(() => {
			const patch = pendingProfilePatchRef.current;
			if (Object.keys(patch).length === 0) {
				return;
			}
			pendingProfilePatchRef.current = {};
			persistProfilePatchRef.current(patch);
		}, persistDebounceMs),
	);
	const debouncedPersistJobOfferPatch = useRef(
		createDebouncedCallback(() => {
			const patch = pendingJobOfferPatchRef.current;
			if (Object.keys(patch).length === 0) {
				return;
			}
			pendingJobOfferPatchRef.current = {};
			persistJobOfferPatchRef.current(patch);
		}, persistDebounceMs),
	);
	const debouncedPersistCv = useRef(
		createDebouncedCallback(() => {
			const cv = pendingCvRef.current;
			if (!cv) {
				return;
			}
			pendingCvRef.current = undefined;
			persistCvRef.current(cv);
		}, persistDebounceMs),
	);
	profileRecordRef.current = profileRecord;
	settingsRef.current = settings;
	applicationRowsRef.current = applicationRows;
	runRowsRef.current = runRows;
	selectedLanguageRef.current = selectedLanguage;
	aiStatusesRef.current = aiStatuses;

	const selectedTool =
		(settings?.selectedAiTool as AiToolId | undefined) ?? "auto";
	const aiModels = useMemo(
		() =>
			({
				...defaultAiModels,
				...(settings?.aiModels ?? {}),
			}) as AiModels,
		[settings?.aiModels],
	);

	useEffect(() => {
		if (!profileSnapshot) {
			return;
		}

		if (profilesHaveSameContent(profileSnapshot, storedProfile)) {
			setProfileSnapshot(undefined);
			profileSnapshotUpdatedAtRef.current = undefined;
		}
	}, [profileSnapshot, storedProfile]);
	const applications = useMemo(
		() =>
			applicationRows.map((application) =>
				toListItem(
					application,
					normalizedRunRows.filter(
						(run) => run.applicationId === application.id,
					),
				),
			),
		[applicationRows, normalizedRunRows],
	);
	const activeApplications = applications.filter((item) => !item.archived);
	const archivedApplications = applications.filter((item) => item.archived);
	const activeId = settings?.activeApplicationId;
	const activeApplication =
		applicationRows.find((item) => item.id === activeId) ??
		activeApplications[0];
	const activeRuns = normalizedRunRows.filter(
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
	const effectiveAiProvider = resolveEffectiveAiProvider(
		selectedTool,
		aiStatuses,
	);
	const effectiveAiModel = effectiveAiProvider
		? aiModels[effectiveAiProvider]
		: undefined;
	selectedToolRef.current = selectedTool;
	aiModelsRef.current = aiModels;
	effectiveAiModelRef.current = effectiveAiModel;
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

	async function persistSettings(patch: Partial<typeof settings>) {
		if (!settingsRef.current) {
			return;
		}

		await awaitPersisted(
			db.settings.update("settings", (draft) => {
				Object.assign(draft, patch);
			}),
		);
	}

	async function awaitPersisted(
		transaction: { isPersisted: { promise: Promise<unknown> } },
	) {
		await transaction.isPersisted.promise;
	}

	function cloneProfileRecord(record: ProfileRecord): ProfileRecord {
		return normalizeProfileRecord(
			JSON.parse(JSON.stringify(record)) as ProfileRecord,
		);
	}

	async function persistProfileRecord(record: ProfileRecord) {
		const plain = cloneProfileRecord(record);
		const content = profileFromRecord(plain);

		try {
			if (db.profiles.has(plain.id)) {
				await awaitPersisted(
					db.profiles.update(plain.id, (draft) => {
						applyProfileFields(draft, content, plain.updatedAt);
					}),
				);
				return;
			}

			await awaitPersisted(db.profiles.insert(plain));
		} catch (error) {
			const message = getErrorMessage(error);
			throw new Error(
				message.toLowerCase().includes("database")
					? message
					: `Could not write profile to the database: ${message}`,
			);
		}
	}

	async function persistAiSettings(
		patch: Partial<Pick<AppSettings, "selectedAiTool" | "aiModels">>,
	) {
		if (!settingsRef.current) {
			pendingAiSettingsRef.current = {
				...pendingAiSettingsRef.current,
				...patch,
			};
			return;
		}

		try {
			await persistSettings(patch);
		} catch (error) {
			toast.error("Could not save AI settings", {
				description: getErrorMessage(error),
			});
		}
	}

	function setSelectedTool(tool: AiToolId) {
		void persistAiSettings({ selectedAiTool: tool });
	}

	function setAiModel(provider: AiProviderId, model: string) {
		const current = {
			...defaultAiModels,
			...(settingsRef.current?.aiModels ?? {}),
		};
		void persistAiSettings({
			aiModels: { ...current, [provider]: model },
		});
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
		const profileLanguage = profileRecord.language ?? "en";
		const { application, draftRun } = createEmptyApplication({
			id: applicationId,
			profileId: profileRecord.id,
			profile,
			language: profileLanguage,
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
		setSelectedLanguageState(profileLanguage);
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
		pendingJobOfferPatchRef.current = mergeJobOfferPatch(
			pendingJobOfferPatchRef.current,
			patch,
		);
		debouncedPersistJobOfferPatch.current.debounced();
	}

	function updateApplicationRunsMatchAnalysis(
		applicationId: string,
		signals: JobSignals,
		matchAnalysis: MatchAnalysis,
	) {
		const now = new Date().toISOString();
		for (const run of runRowsRef.current.filter(
			(entry) => entry.applicationId === applicationId,
		)) {
			db.cvRuns.update(run.id, (draft) => {
				draft.signals = signals;
				draft.matchAnalysis = normalizeMatchAnalysis(matchAnalysis);
				draft.updatedAt = now;
			});
		}
	}

	async function evaluateProfileMatchAnalysis(
		profileForScoring: BaseProfile,
		jobOffer: JobOffer,
		signals: JobSignals,
	): Promise<{ analysis: MatchAnalysis; stdout: string }> {
		const tool = selectedToolRef.current;
		const statuses = aiStatusesRef.current;
		const model = effectiveAiModelRef.current;
		const models = aiModelsRef.current;

		if (!toolIsReady(tool, statuses)) {
			return {
				analysis: scoreProfileAgainstJob(profileForScoring, {
					...jobOffer,
					signals,
				}),
				stdout: "",
			};
		}

		const response = await runAiToolResilient(
			{
				tool,
				prompt: buildEvaluateProfileMatchPrompt({
					profile: profileForScoring,
					jobOffer,
					signals,
				}),
				schema: matchAnalysisOutputJsonSchema,
				model,
			},
			{
				statuses,
				model,
				models,
			},
		);

		try {
			const analysis = parseCliMatchAnalysisOutput(response.stdout);
			return {
				analysis: normalizeMatchAnalysis({
					...analysis,
					evaluatorTool: response.tool,
				}),
				stdout: response.stdout,
			};
		} catch (parseError) {
			setRawProfileMatchOutput(response.stdout);
			throw parseError;
		}
	}

	function saveApplicationProfileMatch(
		applicationId: string,
		input: {
			profileId: string;
			profileUpdatedAt: string;
			jobRawText: string;
			jobReviewedAt?: string;
			matchAnalysis: MatchAnalysis;
			stdout?: string;
		},
	) {
		const now = new Date().toISOString();
		db.applications.update(applicationId, (draft) => {
			draft.profileMatch = {
				profileId: input.profileId,
				jobRawText: input.jobRawText,
				jobReviewedAt: input.jobReviewedAt,
				profileUpdatedAt: input.profileUpdatedAt,
				matchAnalysis: normalizeMatchAnalysis(input.matchAnalysis),
				evaluatedAt: now,
				stdout: input.stdout,
			};
			draft.updatedAt = now;
		});
	}

	async function analyzeProfileMatchForApplication(
		applicationId: string,
		options?: { force?: boolean },
	) {
		const record = profileRecordRef.current;
		const application = applicationRowsRef.current.find(
			(item) => item.id === applicationId,
		);
		if (!application || !record) {
			return;
		}

		const rawText = application.jobOffer.rawText.trim();
		if (!rawText) {
			return;
		}

		const jobOffer: JobOffer = {
			...application.jobOffer,
			signals: resolveJobSignals(application.jobOffer),
		};
		const signals = jobOffer.signals ?? resolveJobSignals(jobOffer);
		const profileForScoring = profileFromRecord(record);
		const draftAnalysis = scoreProfileAgainstJob(profileForScoring, {
			...jobOffer,
			signals,
		});
		const cachedAnalysis = resolveCachedProfileMatch(
			application,
			record.id,
			record.updatedAt,
		);

		if (!options?.force && cachedAnalysis) {
			updateApplicationRunsMatchAnalysis(
				applicationId,
				signals,
				cachedAnalysis,
			);
			return;
		}

		if (
			!options?.force &&
			!profileMatchNeedsEvaluation({
				application,
				profileId: record.id,
				profileUpdatedAt: record.updatedAt,
			})
		) {
			return;
		}

		if (!toolIsReady(selectedToolRef.current, aiStatusesRef.current)) {
			updateApplicationRunsMatchAnalysis(
				applicationId,
				signals,
				draftAnalysis,
			);
			return;
		}

		const requestId = profileMatchRequestRef.current + 1;
		profileMatchRequestRef.current = requestId;
		setIsAnalyzingProfileMatch(true);
		setProfileMatchError(undefined);
		setRawProfileMatchOutput(undefined);
		updateApplicationRunsMatchAnalysis(applicationId, signals, draftAnalysis);

		try {
			const { analysis, stdout } = await evaluateProfileMatchAnalysis(
				profileForScoring,
				jobOffer,
				signals,
			);
			if (profileMatchRequestRef.current !== requestId) {
				return;
			}
			saveApplicationProfileMatch(applicationId, {
				profileId: record.id,
				profileUpdatedAt: record.updatedAt,
				jobRawText: rawText,
				jobReviewedAt: application.jobOffer.review?.reviewedAt,
				matchAnalysis: analysis,
				stdout,
			});
			updateApplicationRunsMatchAnalysis(applicationId, signals, analysis);
		} catch (error) {
			if (profileMatchRequestRef.current !== requestId) {
				return;
			}
			const message = getErrorMessage(error);
			setProfileMatchError(message);
			updateApplicationRunsMatchAnalysis(
				applicationId,
				signals,
				draftAnalysis,
			);
		} finally {
			if (profileMatchRequestRef.current === requestId) {
				setIsAnalyzingProfileMatch(false);
			}
		}
	}

	async function analyzeActiveProfileMatch(options?: { force?: boolean }) {
		const settingsValue = settingsRef.current;
		const applications = applicationRowsRef.current;
		const activeId = settingsValue?.activeApplicationId;
		const application =
			applications.find((item) => item.id === activeId) ?? applications[0];
		if (!application) {
			return;
		}

		await analyzeProfileMatchForApplication(application.id, options);
	}

	function persistActiveJobOffer(patch: JobOfferPatch) {
		const settingsValue = settingsRef.current;
		const record = profileRecordRef.current;
		const applications = applicationRowsRef.current;
		const runs = runRowsRef.current;
		const activeId = settingsValue?.activeApplicationId;
		const application =
			applications.find((item) => item.id === activeId) ?? applications[0];
		if (!application || !record) {
			return;
		}

		const profileForScoring = profileFromRecord(record);
		const now = new Date().toISOString();
		const previousRawText = application.jobOffer.rawText.trim();
		const rawText = (patch.rawText ?? application.jobOffer.rawText).trim();
		const rawTextChanged =
			patch.rawText !== undefined && rawText !== previousRawText;
		let review = application.jobOffer.review;
		let profileMatch = application.profileMatch;
		if (rawTextChanged) {
			review = undefined;
			profileMatch = undefined;
		}

		const jobOffer: JobOffer = {
			...application.jobOffer,
			...patch,
			links: patch.links ?? application.jobOffer.links ?? [],
			position: patch.position ?? application.jobOffer.position ?? "unspecified",
			review,
			signals: review
				? review.signals
				: rawTextChanged
					? undefined
					: application.jobOffer.signals,
		};
		const applicationForMatch = {
			...application,
			jobOffer,
			profileMatch,
		};
		const signals = resolveJobSignals(jobOffer);
		const jobOfferForScoring = { ...jobOffer, signals };
		const cachedAnalysis = resolveCachedProfileMatch(
			applicationForMatch,
			record.id,
			record.updatedAt,
		);

		db.applications.update(application.id, (draft) => {
			draft.jobOffer = jobOffer;
			draft.profileMatch = profileMatch;
			draft.updatedAt = now;
		});

		for (const run of runs.filter(
			(entry) => entry.applicationId === application.id,
		)) {
			db.cvRuns.update(run.id, (draft) => {
				draft.signals = signals;
				draft.matchAnalysis =
					cachedAnalysis ??
					scoreProfileAgainstJob(profileForScoring, jobOfferForScoring);
				draft.updatedAt = now;
			});
		}

		if (
			profileMatchNeedsEvaluation({
				application: applicationForMatch,
				profileId: record.id,
				profileUpdatedAt: record.updatedAt,
			})
		) {
			void analyzeProfileMatchForApplication(application.id);
		}
	}

	function updateActiveCv(cv: TailoredCv) {
		pendingCvRef.current = cv;
		debouncedPersistCv.current.debounced();
	}

	function persistActiveCv(cv: TailoredCv) {
		const settingsValue = settingsRef.current;
		const applications = applicationRowsRef.current;
		const runs = runRowsRef.current;
		const activeId = settingsValue?.activeApplicationId;
		const activeApplication =
			applications.find((item) => item.id === activeId) ?? applications[0];
		const activeRuns = runs.filter(
			(run) => run.applicationId === activeApplication?.id,
		);
		const run =
			activeRuns.find((entry) => entry.id === settingsValue?.activeRunId) ??
			activeRuns.find(
				(entry) => entry.language === selectedLanguageRef.current,
			) ??
			activeRuns[0];
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

	async function reviewActiveJobOffer(options?: { force?: boolean }) {
		const settingsValue = settingsRef.current;
		const record = profileRecordRef.current;
		const applications = applicationRowsRef.current;
		const runs = runRowsRef.current;
		const activeId = settingsValue?.activeApplicationId;
		const application =
			applications.find((item) => item.id === activeId) ?? applications[0];
		if (!application || !record) {
			return;
		}

		const rawText = application.jobOffer.rawText.trim();
		if (!rawText) {
			return;
		}

		if (!options?.force && !jobOfferNeedsReview(application.jobOffer)) {
			return;
		}

		if (!canUseSelectedAi) {
			setJobReviewError("No AI tool is available for job review.");
			return;
		}

		setIsReviewingJobOffer(true);
		setJobReviewError(undefined);
		setRawJobReviewOutput(undefined);

		try {
			const prompt = buildReviewJobPostingPrompt({
				jobOffer: application.jobOffer,
				rawText,
			});
			const response = await runAiToolResilient(
				{
					tool: selectedTool,
					prompt,
					schema: jobPostingReviewOutputJsonSchema,
					model: effectiveAiModel,
				},
				{
					statuses: aiStatuses,
					model: effectiveAiModel,
					models: aiModels,
				},
			);
			let parsedReview: { signals: JobPostingReview["signals"]; summary: string };
			try {
				parsedReview = parseCliJobPostingReviewOutput(response.stdout);
			} catch (parseError) {
				setRawJobReviewOutput(response.stdout);
				throw parseError;
			}

			const now = new Date().toISOString();
			const review: JobPostingReview = {
				signals: parsedReview.signals,
				summary: parsedReview.summary,
				rawText,
				reviewedAt: now,
				reviewTool: response.tool,
				stdout: response.stdout,
			};
			const jobOffer: JobOffer = {
				...application.jobOffer,
				review,
				signals: parsedReview.signals,
			};
			const profileForScoring = profileFromRecord(record);

			db.applications.update(application.id, (draft) => {
				draft.jobOffer = jobOffer;
				draft.profileMatch = undefined;
				draft.updatedAt = now;
			});

			for (const run of runs.filter(
				(entry) => entry.applicationId === application.id,
			)) {
				db.cvRuns.update(run.id, (draft) => {
					draft.signals = parsedReview.signals;
					draft.matchAnalysis = scoreProfileAgainstJob(
						profileForScoring,
						jobOffer,
					);
					draft.updatedAt = now;
				});
			}

			await analyzeProfileMatchForApplication(application.id);
		} catch (error) {
			const message = getErrorMessage(error);
			setJobReviewError(
				message.toLowerCase().includes("not logged in") ||
					message.toLowerCase().includes("login")
					? `${message} Try Settings → AI tool and pick Cursor, or run \`claude /login\`.`
					: message,
			);
			toast.error("Job review failed", { description: message });
		} finally {
			setIsReviewingJobOffer(false);
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

		const signals = resolveJobSignals(application.jobOffer);
		const jobOffer: JobOffer = { ...application.jobOffer, signals };
		let analysis = scoreProfileAgainstJob(profile, jobOffer);
		if (toolIsReady(selectedTool, aiStatuses)) {
			try {
				const cached = activeApplication
					? resolveCachedProfileMatch(
							activeApplication,
							profileRecord.id,
							profileRecord.updatedAt,
						)
					: undefined;
				if (cached) {
					analysis = cached;
				} else {
					const result = await evaluateProfileMatchAnalysis(
						profile,
						jobOffer,
						signals,
					);
					analysis = result.analysis;
					saveApplicationProfileMatch(application.id, {
						profileId: profileRecord.id,
						profileUpdatedAt: profileRecord.updatedAt,
						jobRawText: application.jobOffer.rawText.trim(),
						jobReviewedAt: application.jobOffer.review?.reviewedAt,
						matchAnalysis: result.analysis,
						stdout: result.stdout,
					});
				}
			} catch {
				analysis = scoreProfileAgainstJob(profile, jobOffer);
			}
		}
		const prompt = buildTailorCvPrompt({
			profile,
			jobOffer,
			signals,
			matchAnalysis: analysis,
			targetLanguage: language,
		});

		try {
			const response = await runAiToolResilient(
				{
					tool: selectedTool,
					prompt,
					schema: tailoredCvOutputJsonSchema,
					model: effectiveAiModel,
				},
				{
					statuses: aiStatuses,
					model: effectiveAiModel,
					models: aiModels,
				},
			);
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

	async function exportAllData() {
		setIsExportingData(true);
		try {
			const summary = await exportBackup(db);
			toast.success("Backup exported", {
				description: `${summary.profiles} profiles, ${summary.applications} applications, ${summary.cvRuns} CV versions.`,
			});
		} catch (error) {
			toast.error("Export failed", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsExportingData(false);
		}
	}

	async function importAllData(
		file: File,
		mode: "replace" | "merge",
	) {
		setIsImportingData(true);
		try {
			const content = await file.text();
			const summary = await importBackup(db, content, mode);
			setProfileRevision((current) => current + 1);
			toast.success(
				mode === "replace" ? "Backup restored" : "Backup merged",
				{
					description: `${summary.profiles} profiles, ${summary.applications} applications, ${summary.cvRuns} CV versions.`,
				},
			);
		} catch (error) {
			toast.error("Import failed", {
				description: getErrorMessage(error),
			});
			throw error;
		} finally {
			setIsImportingData(false);
		}
	}

	function applyProfileFields(
		draft: ProfileRecord,
		next: BaseProfile,
		updatedAt: string,
	) {
		draft.contact = { ...next.contact, links: [...next.contact.links] };
		draft.headline = next.headline;
		draft.summary = next.summary;
		draft.targetRoles = [...next.targetRoles];
		draft.preferredTone = next.preferredTone;
		draft.skills = [...next.skills];
		draft.achievements = [...next.achievements];
		draft.experience = next.experience.map((item) => ({
			...item,
			bullets: [...item.bullets],
			technologies: [...item.technologies],
		}));
		draft.education = next.education.map((item) => ({
			...item,
			details: [...item.details],
		}));
		draft.projects = next.projects.map((item) => ({
			...item,
			bullets: [...item.bullets],
			technologies: [...item.technologies],
		}));
		draft.languages = [...next.languages];
		draft.updatedAt = updatedAt;
	}

	function applyProfilePatch(
		draft: ProfileRecord,
		patch: Partial<BaseProfile>,
		updatedAt: string,
	) {
		if (patch.contact !== undefined) {
			draft.contact = {
				...patch.contact,
				links: [...(patch.contact.links ?? [])],
			};
		}
		if (patch.headline !== undefined) {
			draft.headline = patch.headline;
		}
		if (patch.summary !== undefined) {
			draft.summary = patch.summary;
		}
		if (patch.targetRoles !== undefined) {
			draft.targetRoles = [...patch.targetRoles];
		}
		if (patch.preferredTone !== undefined) {
			draft.preferredTone = patch.preferredTone;
		}
		if (patch.skills !== undefined) {
			draft.skills = [...patch.skills];
		}
		if (patch.achievements !== undefined) {
			draft.achievements = [...patch.achievements];
		}
		if (patch.experience !== undefined) {
			draft.experience = (patch.experience ?? []).map((item) => ({
				...item,
				bullets: [...item.bullets],
				technologies: [...item.technologies],
			}));
		}
		if (patch.education !== undefined) {
			draft.education = (patch.education ?? []).map((item) => ({
				...item,
				details: [...item.details],
			}));
		}
		if (patch.projects !== undefined) {
			draft.projects = (patch.projects ?? []).map((item) => ({
				...item,
				bullets: [...item.bullets],
				technologies: [...item.technologies],
			}));
		}
		if (patch.languages !== undefined) {
			draft.languages = [...patch.languages];
		}
		draft.updatedAt = updatedAt;
	}

	function ensureProfileRecord(next: BaseProfile) {
		const now = new Date().toISOString();
		const existing = profileRecordRef.current;
		const record: ProfileRecord = existing
			? {
					...existing,
					...next,
					updatedAt: now,
				}
			: {
					...createDefaultProfileRecord(now),
					...next,
					updatedAt: now,
				};
		db.profiles.insert(record);
		const currentSettings = settingsRef.current;
		if (currentSettings) {
			db.settings.update("settings", (draft) => {
				draft.activeProfileId = record.id;
			});
		} else {
			db.settings.insert(createDefaultAppSettings(record.id));
		}
		return record;
	}

	function replaceProfile(next: BaseProfile) {
		const normalized = normalizeBaseProfile(next);
		const record = profileRecordRef.current;
		const now = new Date().toISOString();

		void (async () => {
			try {
				if (!record) {
					const created = ensureProfileRecord(normalized);
					await persistProfileRecord(created);
					profileSnapshotUpdatedAtRef.current = created.updatedAt;
				} else {
					const nextRecord = cloneProfileRecord(record);
					applyProfileFields(nextRecord, normalized, now);
					await persistProfileRecord(nextRecord);
					profileSnapshotUpdatedAtRef.current = now;
				}

				setProfileSnapshot(undefined);
				profileSnapshotUpdatedAtRef.current = undefined;
				setProfileRevision((current) => current + 1);
			} catch (error) {
				toast.error("Could not save profile", {
					description: getErrorMessage(error),
				});
			}
		})();
	}

	function flushProfilePatch(patch: Partial<BaseProfile>) {
		const record = profileRecordRef.current;
		const now = new Date().toISOString();

		setProfileSnapshot(undefined);
		profileSnapshotUpdatedAtRef.current = undefined;

		try {
			if (!record) {
				ensureProfileRecord({ ...createDefaultBaseProfile(), ...patch });
				return;
			}

			db.profiles.update(record.id, (draft) => {
				applyProfilePatch(draft, patch, now);
			});
		} catch (error) {
			toast.error("Could not save profile", {
				description: getErrorMessage(error),
			});
		}
	}

	persistProfilePatchRef.current = flushProfilePatch;
	persistJobOfferPatchRef.current = persistActiveJobOffer;
	persistCvRef.current = persistActiveCv;

	function patchProfile(patch: Partial<BaseProfile>) {
		pendingProfilePatchRef.current = mergeProfilePatch(
			pendingProfilePatchRef.current,
			patch,
		);
		setProfileSnapshot(undefined);
		profileSnapshotUpdatedAtRef.current = undefined;
		debouncedPersistProfilePatch.current.debounced();
	}

	function updateProfile(next: BaseProfile) {
		replaceProfile(next);
	}

	function createProfile(name: string, language: CvLanguage) {
		const record = createProfileRecord({ name, language });
		db.profiles.insert(record);
		updateSettings({ activeProfileId: record.id });
		setProfileSnapshot(undefined);
		profileSnapshotUpdatedAtRef.current = undefined;
		setProfileRevision((current) => current + 1);
		return record.id;
	}

	function switchProfile(id: string) {
		if (!profiles.some((item) => item.id === id)) {
			return;
		}

		updateSettings({ activeProfileId: id });
		setProfileSnapshot(undefined);
		profileSnapshotUpdatedAtRef.current = undefined;
		setProfileRevision((current) => current + 1);
	}

	function deleteProfile(id: string) {
		if (profiles.length <= 1) {
			toast.error("Cannot delete the last profile");
			return;
		}

		const linkedApplications = applicationRows.filter(
			(item) => item.profileId === id,
		);
		if (linkedApplications.length > 0) {
			toast.error("Profile has applications", {
				description: "Delete or archive those applications first.",
			});
			return;
		}

		db.profiles.delete(id);

		if (settings?.activeProfileId === id) {
			const nextActive = profiles.find((item) => item.id !== id)?.id;
			if (nextActive) {
				updateSettings({ activeProfileId: nextActive });
			}
		}

		setProfileRevision((current) => current + 1);
	}

	function updateProfileMeta(
		id: string,
		patch: Partial<Pick<ProfileRecord, "name" | "language">>,
	) {
		const now = new Date().toISOString();

		db.profiles.update(id, (draft) => {
			if (patch.name !== undefined) {
				const trimmed = patch.name.trim();
				if (trimmed) {
					draft.name = trimmed;
				}
			}
			if (patch.language !== undefined) {
				draft.language = patch.language;
			}
			draft.updatedAt = now;
		});
		setProfileRevision((current) => current + 1);
	}

	async function applyGeneratedProfile(
		next: BaseProfile,
		options: {
			mode: "current" | "new";
			language: CvLanguage;
			name?: string;
		},
	) {
		const normalized = normalizeBaseProfile(next);
		const now = new Date().toISOString();
		const profileName =
			options.name?.trim() || cvLanguageLabel(options.language);

		let record: ProfileRecord;
		if (options.mode === "new") {
			record = createProfileRecord({
				name: profileName,
				language: options.language,
				now,
			});
			applyProfileFields(record, normalized, now);
		} else {
			const existing = profileRecordRef.current;
			if (!existing) {
				record = createProfileRecord({
					name: profileName,
					language: options.language,
					now,
				});
			} else {
				record = cloneProfileRecord(existing);
				record.language = options.language;
			}
			applyProfileFields(record, normalized, now);
		}

		await persistProfileRecord(record);
		if (settingsRef.current?.activeProfileId !== record.id) {
			await persistSettings({ activeProfileId: record.id });
		} else {
			updateSettings({ activeProfileId: record.id });
		}
		setProfileSnapshot(normalized);
		profileSnapshotUpdatedAtRef.current = record.updatedAt;
		setProfileRevision((current) => current + 1);
	}

	useEffect(() => {
		if (!settings) {
			return;
		}

		const pending = pendingAiSettingsRef.current;
		if (Object.keys(pending).length === 0) {
			return;
		}

		pendingAiSettingsRef.current = {};
		void persistAiSettings(pending);
	}, [settings]);

	useEffect(() => {
		const application = activeApplication;
		const record = profileRecord;
		if (!application?.jobOffer.rawText.trim() || !record) {
			return;
		}

		void analyzeProfileMatchForApplication(application.id);
	}, [profileRevision, activeApplication?.id, activeApplication?.jobOffer.review?.reviewedAt]);

	useEffect(() => {
		return () => {
			debouncedPersistProfilePatch.current.flush();
			debouncedPersistJobOfferPatch.current.flush();
			debouncedPersistCv.current.flush();
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: value is rebuilt from live query snapshots.
	const value = useMemo<CvAppContextValue>(
		() => ({
			profile,
			profileRecord,
			profiles,
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
			aiModels,
			effectiveAiProvider,
			effectiveAiModel,
			saveStatus,
			canUseSelectedAi,
			canGenerateActive,
			isGenerating,
			isReviewingJobOffer,
			isAnalyzingProfileMatch,
			isExportingPdf,
			isExportingData,
			isImportingData,
			generationError,
			jobReviewError,
			profileMatchError,
			rawCliOutput,
			rawJobReviewOutput,
			rawProfileMatchOutput,
			setSelectedTool,
			setAiModel,
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
			reviewActiveJobOffer,
			analyzeActiveProfileMatch,
			generateActive,
			switchActiveRun,
			exportPdf,
			exportAllData,
			importAllData,
			profileRevision,
			replaceProfile,
			updateProfile,
			patchProfile,
			createProfile,
			switchProfile,
			deleteProfile,
			updateProfileMeta,
			applyGeneratedProfile,
		}),
		[
			profile,
			profileRecord,
			profiles,
			profileRevision,
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
			aiModels,
			effectiveAiProvider,
			effectiveAiModel,
			saveStatus,
			canUseSelectedAi,
			canGenerateActive,
			isGenerating,
			isReviewingJobOffer,
			isAnalyzingProfileMatch,
			isExportingPdf,
			isExportingData,
			isImportingData,
			generationError,
			jobReviewError,
			profileMatchError,
			rawCliOutput,
			rawJobReviewOutput,
			rawProfileMatchOutput,
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
