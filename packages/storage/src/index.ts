import {
	type AppState,
	appStateSchema,
	createDefaultAppState,
	generatedCvSchema,
} from "@cv-tailor/core";

export interface StorageAdapter {
	loadAppState(): Promise<AppState>;
	saveAppState(state: AppState): Promise<void>;
}

const localStorageKey = "cv-tailor:app-state:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeStringArray(value: unknown, fallback: string[]) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: fallback;
}

function migrateProfile(value: unknown): AppState["profile"] {
	const defaultProfile = createDefaultAppState().profile;

	if (!isRecord(value)) {
		return defaultProfile;
	}

	const contact = isRecord(value.contact)
		? {
				...defaultProfile.contact,
				...value.contact,
				links: mergeStringArray(
					value.contact.links,
					defaultProfile.contact.links,
				),
			}
		: defaultProfile.contact;

	return {
		...defaultProfile,
		...value,
		contact,
		targetRoles: mergeStringArray(
			value.targetRoles,
			defaultProfile.targetRoles,
		),
		skills: mergeStringArray(value.skills, defaultProfile.skills),
		achievements: mergeStringArray(
			value.achievements,
			defaultProfile.achievements,
		),
		experience: Array.isArray(value.experience)
			? value.experience
			: defaultProfile.experience,
		education: Array.isArray(value.education)
			? value.education
			: defaultProfile.education,
		projects: Array.isArray(value.projects)
			? value.projects
			: defaultProfile.projects,
		languages: mergeStringArray(value.languages, defaultProfile.languages),
	};
}

export function migrateAppState(value: unknown): AppState {
	const fallback = createDefaultAppState();

	if (!isRecord(value)) {
		return fallback;
	}

	const migrated: AppState = {
		version: 1,
		profile: migrateProfile(value.profile),
		generatedCvs: Array.isArray(value.generatedCvs)
			? value.generatedCvs.flatMap((item) => {
					const parsed = generatedCvSchema.safeParse(item);
					return parsed.success ? [parsed.data] : [];
				})
			: fallback.generatedCvs,
		activeGeneratedCvId:
			typeof value.activeGeneratedCvId === "string"
				? value.activeGeneratedCvId
				: undefined,
	};

	return appStateSchema.parse(migrated);
}

async function loadTauriInvoke() {
	if (!("__TAURI_INTERNALS__" in globalThis)) {
		return undefined;
	}

	const { invoke } = await import("@tauri-apps/api/core");
	return invoke;
}

class TauriStorageAdapter implements StorageAdapter {
	async loadAppState() {
		const invoke = await loadTauriInvoke();

		if (!invoke) {
			throw new Error("Tauri invoke is not available.");
		}

		const state = await invoke<unknown>("load_app_state");
		return migrateAppState(state);
	}

	async saveAppState(state: AppState) {
		const invoke = await loadTauriInvoke();

		if (!invoke) {
			throw new Error("Tauri invoke is not available.");
		}

		await invoke("save_app_state", { state: appStateSchema.parse(state) });
	}
}

class BrowserStorageAdapter implements StorageAdapter {
	async loadAppState() {
		if (!("localStorage" in globalThis)) {
			return createDefaultAppState();
		}

		const raw = globalThis.localStorage.getItem(localStorageKey);
		return raw ? migrateAppState(JSON.parse(raw)) : createDefaultAppState();
	}

	async saveAppState(state: AppState) {
		if (!("localStorage" in globalThis)) {
			return;
		}

		globalThis.localStorage.setItem(
			localStorageKey,
			JSON.stringify(appStateSchema.parse(state)),
		);
	}
}

export function createStorageAdapter(): StorageAdapter {
	return "__TAURI_INTERNALS__" in globalThis
		? new TauriStorageAdapter()
		: new BrowserStorageAdapter();
}

export async function loadAppState(): Promise<AppState> {
	return createStorageAdapter().loadAppState();
}

export async function saveAppState(state: AppState): Promise<void> {
	await createStorageAdapter().saveAppState(state);
}
