import { isTauriRuntime } from "@/lib/tauri-ai";

export const DESKTOP_UPDATER_ENDPOINT =
	"https://github.com/Doderich/cv-tailor/releases/latest/download/latest.json";

export const DESKTOP_UPDATE_CHECKED_EVENT = "cv-tailor:desktop-update-checked";

const PENDING_RESTART_VERSION_KEY = "cv-tailor:pending-restart-version";

export type DesktopUpdateStatus =
	| "skipped"
	| "dev_skipped"
	| "current"
	| "available"
	| "declined"
	| "installing"
	| "installed"
	| "ready_to_restart"
	| "error";

export type DesktopUpdateCheckResult = {
	status: DesktopUpdateStatus;
	currentVersion?: string;
	availableVersion?: string;
	message?: string;
	checkedAt: string;
	releaseNotes?: string;
};

export type DesktopAppInfo = {
	version: string;
	appName: string;
	expectedUpdaterArchive: string;
	expectedGithubUpdaterArchive: string;
	platform: string;
	arch: string;
	osVersion: string;
	isDevBuild: boolean;
	updaterEnabled: boolean;
};

type PendingDesktopUpdate = {
	version: string;
	body?: string | null;
	downloadAndInstall: () => Promise<void>;
};

let lastCheckResult: DesktopUpdateCheckResult | null = null;
let pendingDesktopUpdate: PendingDesktopUpdate | null = null;

export function getLastDesktopUpdateCheck() {
	return lastCheckResult;
}

export function hasPendingDesktopUpdate() {
	return pendingDesktopUpdate !== null;
}

export function getPendingRestartVersion() {
	if (typeof window === "undefined") {
		return null;
	}

	return window.sessionStorage.getItem(PENDING_RESTART_VERSION_KEY);
}

export function clearPendingRestartVersion() {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.removeItem(PENDING_RESTART_VERSION_KEY);
}

function rememberPendingRestart(version: string) {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.setItem(PENDING_RESTART_VERSION_KEY, version);
}

export function subscribeDesktopUpdateChecks(
	listener: (result: DesktopUpdateCheckResult) => void,
) {
	const handler = (event: Event) => {
		listener((event as CustomEvent<DesktopUpdateCheckResult>).detail);
	};

	window.addEventListener(DESKTOP_UPDATE_CHECKED_EVENT, handler);
	return () => window.removeEventListener(DESKTOP_UPDATE_CHECKED_EVENT, handler);
}

function publishCheckResult(result: DesktopUpdateCheckResult) {
	lastCheckResult = result;
	window.dispatchEvent(
		new CustomEvent(DESKTOP_UPDATE_CHECKED_EVENT, { detail: result }),
	);
}

export function toGithubReleaseAssetName(fileName: string) {
	return fileName.replace(/ /g, ".");
}

export function updaterArchivesMatch(
	localArchive: string,
	remoteArchive: string,
) {
	if (localArchive === remoteArchive) {
		return true;
	}

	if (toGithubReleaseAssetName(localArchive) === remoteArchive) {
		return true;
	}

	if (localArchive === toGithubReleaseAssetName(remoteArchive)) {
		return true;
	}

	return false;
}

export async function loadDesktopAppInfo(): Promise<DesktopAppInfo | null> {
	if (!isTauriRuntime()) {
		return null;
	}

	const [{ getName, getVersion }, { arch, platform, version }] =
		await Promise.all([
			import("@tauri-apps/api/app"),
			import("@tauri-apps/plugin-os"),
		]);

	const isDevBuild = import.meta.env.DEV;
	const appName = await getName();
	const expectedUpdaterArchive = `${appName}.app.tar.gz`;

	return {
		version: await getVersion(),
		appName,
		expectedUpdaterArchive,
		expectedGithubUpdaterArchive: toGithubReleaseAssetName(
			expectedUpdaterArchive,
		),
		platform: platform(),
		arch: arch(),
		osVersion: version(),
		isDevBuild,
		updaterEnabled: !isDevBuild,
	};
}

function formatUpdaterError(
	error: unknown,
	phase: "check" | "install",
): string {
	if (typeof error === "string" && error.trim()) {
		return error;
	}

	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>;
		if (typeof record.message === "string" && record.message.trim()) {
			return record.message;
		}

		try {
			return JSON.stringify(error);
		} catch {
			// Fall through to the default message.
		}
	}

	return phase === "install"
		? "Update installation failed."
		: "Update check failed.";
}

export async function checkDesktopUpdate(options?: {
	allowDevCheck?: boolean;
}): Promise<DesktopUpdateCheckResult> {
	const checkedAt = new Date().toISOString();
	const allowDevCheck = options?.allowDevCheck ?? false;

	pendingDesktopUpdate = null;

	const appInfo = await loadDesktopAppInfo();

	if (!appInfo) {
		const result: DesktopUpdateCheckResult = {
			status: "skipped",
			checkedAt,
			message: "Not running in the desktop app.",
		};
		publishCheckResult(result);
		return result;
	}

	if (appInfo.isDevBuild && !allowDevCheck) {
		const result: DesktopUpdateCheckResult = {
			status: "dev_skipped",
			currentVersion: appInfo.version,
			checkedAt,
			message: "Update checks are disabled in development builds.",
		};
		publishCheckResult(result);
		return result;
	}

	try {
		const { check } = await import("@tauri-apps/plugin-updater");
		let update;

		try {
			update = await check();
		} catch (error) {
			const message = formatUpdaterError(error, "check");
			const result: DesktopUpdateCheckResult = {
				status: "error",
				currentVersion: appInfo.version,
				checkedAt,
				message,
			};
			publishCheckResult(result);
			return result;
		}

		if (!update) {
			const result: DesktopUpdateCheckResult = {
				status: "current",
				currentVersion: appInfo.version,
				checkedAt,
			};
			publishCheckResult(result);
			return result;
		}

		pendingDesktopUpdate = {
			version: update.version,
			body: update.body,
			downloadAndInstall: () => update.downloadAndInstall(),
		};

		const available: DesktopUpdateCheckResult = {
			status: "available",
			currentVersion: appInfo.version,
			availableVersion: update.version,
			releaseNotes: update.body ?? undefined,
			checkedAt,
		};
		publishCheckResult(available);
		return available;
	} catch (error) {
		const message = formatUpdaterError(error, "check");
		const result: DesktopUpdateCheckResult = {
			status: "error",
			currentVersion: appInfo.version,
			checkedAt,
			message,
		};
		publishCheckResult(result);
		return result;
	}
}

export async function installPendingDesktopUpdate(): Promise<DesktopUpdateCheckResult> {
	const checkedAt = new Date().toISOString();
	const appInfo = await loadDesktopAppInfo();
	const pending = pendingDesktopUpdate;

	if (!pending) {
		const result: DesktopUpdateCheckResult = {
			status: "error",
			checkedAt,
			currentVersion: appInfo?.version,
			message: "No pending update is available to install.",
		};
		publishCheckResult(result);
		return result;
	}

	const installing: DesktopUpdateCheckResult = {
		status: "installing",
		currentVersion: appInfo?.version,
		availableVersion: pending.version,
		releaseNotes: pending.body ?? undefined,
		checkedAt,
	};
	publishCheckResult(installing);

	try {
		await pending.downloadAndInstall();
	} catch (error) {
		const message = formatUpdaterError(error, "install");
		const result: DesktopUpdateCheckResult = {
			status: "error",
			currentVersion: appInfo?.version,
			availableVersion: pending.version,
			checkedAt,
			message,
		};
		publishCheckResult(result);
		return result;
	} finally {
		pendingDesktopUpdate = null;
	}

	rememberPendingRestart(pending.version);

	const ready: DesktopUpdateCheckResult = {
		status: "ready_to_restart",
		currentVersion: appInfo?.version,
		availableVersion: pending.version,
		releaseNotes: pending.body ?? undefined,
		checkedAt,
	};
	publishCheckResult(ready);
	return ready;
}

export async function relaunchDesktopApp() {
	clearPendingRestartVersion();
	const { relaunch } = await import("@tauri-apps/plugin-process");
	await relaunch();
}

export async function checkForDesktopUpdate(options?: {
	allowDevCheck?: boolean;
	installImmediately?: boolean;
}): Promise<DesktopUpdateCheckResult> {
	const result = await checkDesktopUpdate({
		allowDevCheck: options?.allowDevCheck,
	});

	if (result.status === "available" && options?.installImmediately) {
		return installPendingDesktopUpdate();
	}

	return result;
}

export type UpdaterManifestDebugInfo = {
	version: string;
	notes?: string;
	pub_date?: string;
	platforms?: Record<string, { url: string; signature: string }>;
};

export async function fetchUpdaterManifestForDebug(): Promise<UpdaterManifestDebugInfo> {
	if (isTauriRuntime()) {
		const { invoke } = await import("@tauri-apps/api/core");
		const response = await invoke<{
			version: string;
			notes?: string;
			pubDate?: string;
			platforms: Record<string, { url: string; signature: string }>;
		}>("fetch_updater_manifest", {
			request: { url: DESKTOP_UPDATER_ENDPOINT },
		});

		return {
			version: response.version,
			notes: response.notes,
			pub_date: response.pubDate,
			platforms: response.platforms,
		};
	}

	const response = await fetch(DESKTOP_UPDATER_ENDPOINT, {
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Manifest fetch failed (${response.status})`);
	}

	return response.json() as Promise<UpdaterManifestDebugInfo>;
}

function archiveNameFromUrl(url: string) {
	try {
		return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
	} catch {
		return url.split("/").pop() ?? url;
	}
}

export function getUpdaterBundleMismatchHint(options: {
	appInfo: DesktopAppInfo | null;
	manifest?: UpdaterManifestDebugInfo | null;
	platformKey?: string;
}) {
	if (!options.appInfo || !options.manifest?.platforms) {
		return null;
	}

	const platformKey =
		options.platformKey ??
		(options.appInfo.platform === "macos"
			? `darwin-${options.appInfo.arch}`
			: null);

	if (!platformKey) {
		return null;
	}

	const platformArtifact = options.manifest.platforms[platformKey];
	if (!platformArtifact?.url) {
		return `No updater artifact found for ${platformKey} in the release manifest.`;
	}

	const remoteArchive = archiveNameFromUrl(platformArtifact.url);
	const expectedArchive = options.appInfo.expectedUpdaterArchive;

	if (updaterArchivesMatch(expectedArchive, remoteArchive)) {
		return null;
	}

	if (remoteArchive === expectedArchive) {
		return `Release manifest points to ${remoteArchive}, but GitHub stores updater assets as ${options.appInfo.expectedGithubUpdaterArchive}. The download URL is invalid.`;
	}

	return `Installed app expects ${expectedArchive} (GitHub: ${options.appInfo.expectedGithubUpdaterArchive}), but the release ships ${remoteArchive}.`;
}

export function formatDesktopUpdateDebugReport(options: {
	appInfo: DesktopAppInfo | null;
	lastCheck: DesktopUpdateCheckResult | null;
	manifest?: {
		version: string;
		notes?: string;
		pub_date?: string;
		platforms?: Record<string, { url: string; signature: string }>;
	} | null;
	manifestError?: string;
}) {
	const lines = [
		"CV Tailor desktop update debug",
		`generatedAt: ${new Date().toISOString()}`,
		`endpoint: ${DESKTOP_UPDATER_ENDPOINT}`,
	];

	if (options.appInfo) {
		lines.push(
			`version: ${options.appInfo.version}`,
			`appName: ${options.appInfo.appName}`,
			`expectedUpdaterArchive: ${options.appInfo.expectedUpdaterArchive}`,
			`expectedGithubUpdaterArchive: ${options.appInfo.expectedGithubUpdaterArchive}`,
			`platform: ${options.appInfo.platform}`,
			`arch: ${options.appInfo.arch}`,
			`osVersion: ${options.appInfo.osVersion}`,
			`isDevBuild: ${options.appInfo.isDevBuild}`,
			`updaterEnabled: ${options.appInfo.updaterEnabled}`,
		);
	} else {
		lines.push("runtime: not desktop");
	}

	if (options.lastCheck) {
		lines.push(
			`lastCheck.status: ${options.lastCheck.status}`,
			`lastCheck.checkedAt: ${options.lastCheck.checkedAt}`,
			`lastCheck.currentVersion: ${options.lastCheck.currentVersion ?? ""}`,
			`lastCheck.availableVersion: ${options.lastCheck.availableVersion ?? ""}`,
			`lastCheck.message: ${options.lastCheck.message ?? ""}`,
		);
	}

	if (options.manifest) {
		const platformEntries = Object.entries(options.manifest.platforms ?? {});
		lines.push(
			`manifest.version: ${options.manifest.version}`,
			`manifest.pub_date: ${options.manifest.pub_date ?? ""}`,
			`manifest.platforms: ${platformEntries.map(([key]) => key).join(", ")}`,
		);

		for (const [platformKey, artifact] of platformEntries) {
			lines.push(
				`manifest.${platformKey}.archive: ${archiveNameFromUrl(artifact.url)}`,
				`manifest.${platformKey}.url: ${artifact.url}`,
			);
		}
	}

	if (options.manifestError) {
		lines.push(`manifest.error: ${options.manifestError}`);
	}

	return lines.join("\n");
}
