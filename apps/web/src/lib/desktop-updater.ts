import { toast } from "sonner";

import { isTauriRuntime } from "@/lib/tauri-ai";

export async function checkForDesktopUpdate(options?: {
	promptBeforeInstall?: boolean;
}) {
	if (!isTauriRuntime() || import.meta.env.DEV) {
		return { status: "skipped" as const };
	}

	const promptBeforeInstall = options?.promptBeforeInstall ?? true;

	try {
		const { check } = await import("@tauri-apps/plugin-updater");
		const update = await check();

		if (!update) {
			if (promptBeforeInstall) {
				toast.message("You're up to date.");
			}

			return { status: "current" as const };
		}

		const shouldInstall =
			!promptBeforeInstall ||
			window.confirm(
				`CV Tailor ${update.version} is available.\n\n${update.body ?? "Install the update and restart?"}`,
			);

		if (!shouldInstall) {
			return { status: "declined" as const, version: update.version };
		}

		toast.message(`Installing CV Tailor ${update.version}…`);

		await update.downloadAndInstall();

		const { relaunch } = await import("@tauri-apps/plugin-process");
		await relaunch();

		return { status: "installed" as const, version: update.version };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Update check failed.";

		if (promptBeforeInstall) {
			toast.error(message);
		}

		return { status: "error" as const, message };
	}
}
