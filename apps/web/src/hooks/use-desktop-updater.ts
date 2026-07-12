import { useEffect } from "react";

import { runStartupDesktopUpdateCheck } from "@/lib/desktop-update-notifications";
import { isTauriRuntime } from "@/lib/tauri-ai";

export function useDesktopUpdater() {
	useEffect(() => {
		if (!isTauriRuntime() || import.meta.env.DEV) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void runStartupDesktopUpdateCheck();
		}, 4_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, []);
}
