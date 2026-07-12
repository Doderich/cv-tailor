import i18n from "@/i18n";
import {
	type DesktopUpdateCheckResult,
	checkDesktopUpdate,
	clearPendingRestartVersion,
	getPendingRestartVersion,
	installPendingDesktopUpdate,
	relaunchDesktopApp,
} from "@/lib/desktop-updater";
import { toast } from "sonner";

const DESKTOP_UPDATE_TOAST_ID = "desktop-update";

function t(key: string, options?: Record<string, string>) {
	return i18n.t(key, options);
}

async function handleDownload() {
	const toastId = DESKTOP_UPDATE_TOAST_ID;
	toast.loading(t("desktopUpdate.toast.downloading"), { id: toastId });

	const result = await installPendingDesktopUpdate();

	if (result.status === "ready_to_restart") {
		showRestartToast(result.availableVersion ?? "");
		return;
	}

	if (result.status === "error") {
		toast.error(result.message ?? t("desktopUpdate.toast.installFailed"), {
			id: toastId,
		});
		return;
	}

	toast.message(t("desktopUpdate.toast.installFailed"), { id: toastId });
}

function showUpdateAvailableToast(result: DesktopUpdateCheckResult) {
	toast(t("desktopUpdate.toast.updateAvailable", {
		version: result.availableVersion ?? "",
	}), {
		id: DESKTOP_UPDATE_TOAST_ID,
		duration: Number.POSITIVE_INFINITY,
		description:
			result.releaseNotes?.trim() ||
			t("desktopUpdate.toast.updateAvailableDescription"),
		action: {
			label: t("desktopUpdate.toast.download"),
			onClick: () => {
				void handleDownload();
			},
		},
	});
}

function showRestartToast(version: string) {
	toast.success(
		t("desktopUpdate.toast.readyToRestart", { version }),
		{
			id: DESKTOP_UPDATE_TOAST_ID,
			duration: Number.POSITIVE_INFINITY,
			description: t("desktopUpdate.toast.readyToRestartDescription"),
			action: {
				label: t("desktopUpdate.toast.restartNow"),
				onClick: () => {
					void relaunchDesktopApp();
				},
			},
			cancel: {
				label: t("desktopUpdate.toast.restartLater"),
				onClick: () => {
					clearPendingRestartVersion();
				},
			},
		},
	);
}

export function presentDesktopUpdateResult(result: DesktopUpdateCheckResult) {
	const toastId = DESKTOP_UPDATE_TOAST_ID;

	switch (result.status) {
		case "current":
			toast.success(
				t("desktopUpdate.toast.upToDate", {
					version: result.currentVersion ?? "",
				}),
				{ id: toastId, duration: 4_000 },
			);
			return;
		case "available":
			showUpdateAvailableToast(result);
			return;
		case "ready_to_restart":
			showRestartToast(result.availableVersion ?? "");
			return;
		case "installing":
			toast.loading(
				t("desktopUpdate.toast.downloadingVersion", {
					version: result.availableVersion ?? "",
				}),
				{ id: toastId },
			);
			return;
		case "error":
			toast.error(result.message ?? t("desktopUpdate.toast.checkFailed"), {
				id: toastId,
			});
			return;
		case "dev_skipped":
		case "skipped":
			return;
		default:
			return;
	}
}

export async function runStartupDesktopUpdateCheck() {
	const pendingVersion = getPendingRestartVersion();
	if (pendingVersion) {
		showRestartToast(pendingVersion);
		return;
	}

	toast.loading(t("desktopUpdate.toast.checking"), {
		id: DESKTOP_UPDATE_TOAST_ID,
	});

	const result = await checkDesktopUpdate();
	presentDesktopUpdateResult(result);
}
