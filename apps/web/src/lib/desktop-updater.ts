import { toast } from "sonner";

import { isTauriRuntime } from "@/lib/tauri-ai";

export const DESKTOP_UPDATER_ENDPOINT =
	"https://github.com/Doderich/cv-tailor/releases/latest/download/latest.json";

export const DESKTOP_UPDATE_CHECKED_EVENT = "cv-tailor:desktop-update-checked";

export type DesktopUpdateStatus =
	| "skipped"
	| "dev_skipped"
	| "current"
	| "available"
	| "declined"
	| "installing"
	| "installed"
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
	platform: string;
	arch: string;
	osVersion: string;
	isDevBuild: boolean;
	updaterEnabled: boolean;
};

let lastCheckResult: DesktopUpdateCheckResult | null = null;

export function getLastDesktopUpdateCheck() {
	return lastCheckResult;
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

export async function loadDesktopAppInfo(): Promise<DesktopAppInfo | null> {
	if (!isTauriRuntime()) {
		return null;
	}

	const [{ getVersion }, { arch, platform, version }] = await Promise.all([
		import("@tauri-apps/api/app"),
		import("@tauri-apps/plugin-os"),
	]);

	const isDevBuild = import.meta.env.DEV;

	return {
		version: await getVersion(),
		platform: platform(),
		arch: arch(),
		osVersion: version(),
		isDevBuild,
		updaterEnabled: !isDevBuild,
	};
}

async function confirmInstall(version: string, body?: string | null) {
	const { ask } = await import("@tauri-apps/plugin-dialog");

	return ask(body?.trim() || "Install the update and restart?", {
		title: `CV Tailor ${version} is available`,
		kind: "info",
	});
}

function notifyForResult(
	result: DesktopUpdateCheckResult,
	notify: boolean | "errors-only",
) {
	if (!notify) {
		return;
	}

	if (notify === "errors-only" && result.status !== "error") {
		return;
	}

	switch (result.status) {
		case "current":
			toast.success(
				result.currentVersion
					? `You're up to date (v${result.currentVersion}).`
					: "You're up to date.",
			);
			return;
		case "dev_skipped":
		case "skipped":
			toast.message(result.message ?? "Update check skipped.");
			return;
		case "error":
			toast.error(result.message ?? "Update check failed.");
			return;
		case "installing":
			toast.message(`Installing CV Tailor ${result.availableVersion}…`);
			return;
		default:
			return;
	}
}

export async function checkForDesktopUpdate(options?: {
	promptBeforeInstall?: boolean;
	notify?: boolean | "errors-only";
	allowDevCheck?: boolean;
}): Promise<DesktopUpdateCheckResult> {
	const checkedAt = new Date().toISOString();
	const promptBeforeInstall = options?.promptBeforeInstall ?? true;
	const notify = options?.notify ?? promptBeforeInstall;
	const allowDevCheck = options?.allowDevCheck ?? false;

	const appInfo = await loadDesktopAppInfo();

	if (!appInfo) {
		const result: DesktopUpdateCheckResult = {
			status: "skipped",
			checkedAt,
			message: "Not running in the desktop app.",
		};
		publishCheckResult(result);
		notifyForResult(result, notify);
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
		notifyForResult(result, notify);
		return result;
	}

	try {
		const { check } = await import("@tauri-apps/plugin-updater");
		const update = await check();

		if (!update) {
			const result: DesktopUpdateCheckResult = {
				status: "current",
				currentVersion: appInfo.version,
				checkedAt,
			};
			publishCheckResult(result);
			notifyForResult(result, notify);
			return result;
		}

		const available: DesktopUpdateCheckResult = {
			status: "available",
			currentVersion: appInfo.version,
			availableVersion: update.version,
			releaseNotes: update.body ?? undefined,
			checkedAt,
		};
		publishCheckResult(available);

		const shouldInstall =
			!promptBeforeInstall ||
			(await confirmInstall(update.version, update.body));

		if (!shouldInstall) {
			const declined: DesktopUpdateCheckResult = {
				...available,
				status: "declined",
			};
			publishCheckResult(declined);
			return declined;
		}

		const installing: DesktopUpdateCheckResult = {
			...available,
			status: "installing",
		};
		publishCheckResult(installing);
		notifyForResult(installing, notify);

		await update.downloadAndInstall();

		const installed: DesktopUpdateCheckResult = {
			...available,
			status: "installed",
		};
		publishCheckResult(installed);

		const { relaunch } = await import("@tauri-apps/plugin-process");
		await relaunch();

		return installed;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Update check failed.";
		const result: DesktopUpdateCheckResult = {
			status: "error",
			currentVersion: appInfo.version,
			checkedAt,
			message,
		};
		publishCheckResult(result);
		notifyForResult(result, notify);
		return result;
	}
}

export async function fetchUpdaterManifestForDebug() {
	const response = await fetch(DESKTOP_UPDATER_ENDPOINT, {
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Manifest fetch failed (${response.status})`);
	}

	return response.json() as Promise<{
		version: string;
		notes?: string;
		pub_date?: string;
		platforms?: Record<string, { url: string; signature: string }>;
	}>;
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
		lines.push(
			`manifest.version: ${options.manifest.version}`,
			`manifest.pub_date: ${options.manifest.pub_date ?? ""}`,
			`manifest.platforms: ${Object.keys(options.manifest.platforms ?? {}).join(", ")}`,
		);
	}

	if (options.manifestError) {
		lines.push(`manifest.error: ${options.manifestError}`);
	}

	return lines.join("\n");
}
