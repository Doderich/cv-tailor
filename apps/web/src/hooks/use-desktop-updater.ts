import { useEffect } from "react";

import { checkForDesktopUpdate } from "@/lib/desktop-updater";
import { isTauriRuntime } from "@/lib/tauri-ai";

export function useDesktopUpdater() {
	useEffect(() => {
		if (!isTauriRuntime() || import.meta.env.DEV) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void checkForDesktopUpdate({
				promptBeforeInstall: true,
				notify: "errors-only",
			});
		}, 4_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, []);
}
