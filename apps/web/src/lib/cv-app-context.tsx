import {
	type AiModels,
	type AiProviderId,
	type AiToolId,
	buildTailorCvPrompt,
	claudeModelOptions,
	codexModelOptions,
	cursorModelOptions,
	defaultAiModels,
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
	extractJobSignals,
	type JobOffer,
	normalizeBaseProfile,
	normalizeProfileRecord,
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
	isExportingPdf: boolean;
	generationError: string | undefined;
	rawCliOutput: string | undefined;
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
	generateActive: (language?: CvLanguage) => Promise<void>;
	switchActiveRun: (runId: string) => void;
	exportPdf: () => Promise<void>;
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

export function CvAppProvider({ children }: { children: ReactNode }) {
	const db = useDb();
	const [viewsByApp, setViewsByApp] = useState<ViewsByApp>({});
	const [selectedTool, setSelectedToolState] = useState<AiToolId>("auto");
	const [aiModels, setAiModelsState] = useState<AiModels>(defaultAiModels);
	const [selectedLanguage, setSelectedLanguageState] =
		useState<CvLanguage>("en");
	const [aiStatuses, setAiStatuses] = useState<AiToolStatus[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isExportingPdf, setIsExportingPdf] = useState(false);
	const [generationError, setGenerationError] = useState<string>();
	const [rawCliOutput, setRawCliOutput] = useState<string>();
	const [profileRevision, setProfileRevision] = useState(0);
	const [profileSnapshot, setProfileSnapshot] = useState<BaseProfile | undefined>();
	const profileSnapshotUpdatedAtRef = useRef<string | undefined>(undefined);
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
		profileRows
			.map((record) => normalizeProfileRecord(record))
			.find((record) => record.id === settings?.activeProfileId) ??
		(profileRows[0] ? normalizeProfileRecord(profileRows[0]) : undefined);
	const profiles = profileRows.map((record) => normalizeProfileRecord(record));
	const storedProfile = profileFromRecord(profileRecord);
	const profile = profileSnapshot ?? storedProfile;
	const profileRecordRef = useRef(profileRecord);
	const settingsRef = useRef(settings);
	profileRecordRef.current = profileRecord;
	settingsRef.current = settings;
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
	const effectiveAiProvider = resolveEffectiveAiProvider(
		selectedTool,
		aiStatuses,
	);
	const effectiveAiModel = effectiveAiProvider
		? aiModels[effectiveAiProvider]
		: undefined;
	const canGenerateActive =
		Boolean(activeApplication?.jobOffer.rawText.trim()) &&
		canUseSelectedAi &&
		!isGenerating;

	useEffect(() => {
		if (!profileSnapshot || !profileRecord?.updatedAt) {
			return;
		}

		if (profileRecord.updatedAt === profileSnapshotUpdatedAtRef.current) {
			setProfileSnapshot(undefined);
			profileSnapshotUpdatedAtRef.current = undefined;
		}
	}, [profileRecord?.updatedAt, profileRecord?.id, profileSnapshot]);

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

	function setAiModel(provider: AiProviderId, model: string) {
		setAiModelsState((current) => {
			const next = { ...current, [provider]: model };
			updateSettings({ aiModels: next });
			return next;
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
				model: effectiveAiModel,
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

		try {
			if (!record) {
				const created = ensureProfileRecord(normalized);
				profileSnapshotUpdatedAtRef.current = created.updatedAt;
			} else {
				db.profiles.update(record.id, (draft) => {
					applyProfileFields(draft, normalized, now);
				});
				profileSnapshotUpdatedAtRef.current = now;
			}

			setProfileSnapshot(normalized);
			setProfileRevision((current) => current + 1);
		} catch (error) {
			toast.error("Could not save profile", {
				description: getErrorMessage(error),
			});
		}
	}

	function patchProfile(patch: Partial<BaseProfile>) {
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

	useEffect(() => {
		if (settings?.selectedAiTool) {
			setSelectedToolState(settings.selectedAiTool as AiToolId);
		}
	}, [settings?.selectedAiTool]);

	useEffect(() => {
		if (settings?.aiModels) {
			setAiModelsState(
				(current) => ({ ...current, ...settings.aiModels }) as AiModels,
			);
		}
	}, [settings?.aiModels]);

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
			isExportingPdf,
			generationError,
			rawCliOutput,
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
			generateActive,
			switchActiveRun,
			exportPdf,
			profileRevision,
			replaceProfile,
			updateProfile,
			patchProfile,
			createProfile,
			switchProfile,
			deleteProfile,
			updateProfileMeta,
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
