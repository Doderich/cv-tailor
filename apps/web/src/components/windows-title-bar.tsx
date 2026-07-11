import { cn } from "@cv-tailor/ui/lib/utils";
import { interactiveTransition } from "@cv-tailor/ui/lib/interactive-styles";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function WindowsTitleBar() {
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		const appWindow = getCurrentWindow();
		appWindow.isMaximized().then(setIsMaximized);
		const unlisten = appWindow.onResized(() => {
			appWindow.isMaximized().then(setIsMaximized);
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);

	const minimize = useCallback(() => {
		getCurrentWindow().minimize();
	}, []);

	const toggleMaximize = useCallback(() => {
		getCurrentWindow().toggleMaximize();
	}, []);

	const close = useCallback(() => {
		getCurrentWindow().close();
	}, []);

	const buttonClass = cn(
		"inline-flex h-8 w-12 items-center justify-center hover:bg-muted active:scale-95",
		interactiveTransition,
	);

	return (
		<div className="ml-auto flex shrink-0">
			<button
				type="button"
				onClick={minimize}
				className={buttonClass}
				title="Minimize"
			>
				<Minus className="size-4" />
			</button>
			<button
				type="button"
				onClick={toggleMaximize}
				className={buttonClass}
				title={isMaximized ? "Restore" : "Maximize"}
			>
				{isMaximized ? (
					<svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
						<path d="M3 5v9h9V5H3zm8 8H4V6h7v7z" />
						<path d="M5 5V3h9v9h-2v-1h1V4H6v1H5z" />
					</svg>
				) : (
					<Square className="size-3.5" />
				)}
			</button>
			<button
				type="button"
				onClick={close}
				className={cn(buttonClass, "hover:bg-destructive hover:text-white")}
				title="Close"
			>
				<X className="size-4" />
			</button>
		</div>
	);
}
