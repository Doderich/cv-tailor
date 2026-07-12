import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { openCommandPaletteEvent } from "@/components/command-palette";
import { applicationStepPath } from "@/lib/application-route";
import { useCvApp } from "@/lib/cv-app-context";
import { presentDesktopUpdateResult } from "@/lib/desktop-update-notifications";
import { checkDesktopUpdate } from "@/lib/desktop-updater";
import { isTauriRuntime } from "@/lib/tauri-ai";

const APP_MENU_EVENT = "app-menu";

type AppMenuAction =
	| "settings"
	| "new_application"
	| "command_palette"
	| "export_pdf"
	| "workspace"
	| "check_for_updates";

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	const tag = target.tagName;
	return (
		target.isContentEditable ||
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT"
	);
}

function openCommandPalette() {
	window.dispatchEvent(new Event(openCommandPaletteEvent));
}

export function useAppMenuShortcuts() {
	const navigate = useNavigate();
	const { activeId, createApplication, exportPdf } = useCvApp();

	useEffect(() => {
		function runAction(action: AppMenuAction) {
			switch (action) {
				case "settings":
					void navigate({ to: "/settings" });
					break;
				case "new_application": {
					const id = createApplication();
					if (id) {
						void navigate(applicationStepPath(id, "job-details"));
					}
					break;
				}
				case "command_palette":
					openCommandPalette();
					break;
				case "export_pdf":
					void exportPdf();
					break;
				case "workspace":
					if (activeId) {
						void navigate(applicationStepPath(activeId, "job-details"));
					} else {
						void navigate({ to: "/" });
					}
					break;
				case "check_for_updates":
					void checkDesktopUpdate().then(presentDesktopUpdateResult);
					break;
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey)) {
				return;
			}

			const key = event.key.toLowerCase();

			if (key === ",") {
				event.preventDefault();
				runAction("settings");
				return;
			}

			if (key === "k") {
				return;
			}

			if (key === "n" && !event.shiftKey) {
				event.preventDefault();
				runAction("new_application");
				return;
			}

			if (key === "e" && event.shiftKey) {
				event.preventDefault();
				runAction("export_pdf");
				return;
			}

			if (key === "1" && !event.shiftKey && !isEditableTarget(event.target)) {
				event.preventDefault();
				runAction("workspace");
			}
		}

		let unlisten: (() => void) | undefined;

		async function bindTauriMenu() {
			if (!isTauriRuntime()) {
				return;
			}

			const { listen } = await import("@tauri-apps/api/event");
			unlisten = await listen<AppMenuAction>(APP_MENU_EVENT, (event) => {
				runAction(event.payload);
			});
		}

		window.addEventListener("keydown", onKeyDown);
		void bindTauriMenu();

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			unlisten?.();
		};
	}, [activeId, createApplication, exportPdf, navigate]);
}
