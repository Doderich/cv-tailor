import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	FileText,
	type LucideIcon,
	Monitor,
	Moon,
	Palette,
	Plus,
	Printer,
	Search,
	Settings,
	Sun,
	WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePalette } from "@/components/palette-provider";
import { useTheme } from "@/components/theme-provider";
import { applicationTitle, useCvApp } from "@/lib/cv-app-context";

export const openCommandPaletteEvent = "cmdk:open";

interface CommandItem {
	id: string;
	label: string;
	group: string;
	icon: LucideIcon;
	keywords?: string;
	hint?: string;
	run: () => void;
}

const groupOrder = ["Actions", "Applications", "Appearance"];

export function CommandPalette() {
	const {
		activeApplications,
		activeApplication,
		canGenerateActive,
		createApplication,
		openApplication,
		generateActive,
		exportPdf,
	} = useCvApp();
	const { setTheme } = useTheme();
	const { palettes, setPalette } = usePalette();
	const navigate = useNavigate();

	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		}

		function onOpen() {
			setOpen(true);
		}

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(openCommandPaletteEvent, onOpen);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(openCommandPaletteEvent, onOpen);
		};
	}, []);

	useEffect(() => {
		if (open) {
			setQuery("");
			setActiveIndex(0);
			const frame = requestAnimationFrame(() => inputRef.current?.focus());
			return () => cancelAnimationFrame(frame);
		}
	}, [open]);

	const items = useMemo<CommandItem[]>(() => {
		const close = () => setOpen(false);
		const goToWorkspace = () => void navigate({ to: "/" });

		const actions: CommandItem[] = [
			{
				id: "new-application",
				label: "New application",
				group: "Actions",
				icon: Plus,
				keywords: "create add job",
				run: () => {
					createApplication();
					goToWorkspace();
					close();
				},
			},
			{
				id: "settings",
				label: "Open profile & settings",
				group: "Actions",
				icon: Settings,
				keywords: "profile appearance ai tools palette",
				run: () => {
					void navigate({ to: "/settings" });
					close();
				},
			},
		];

		if (activeApplication) {
			actions.push({
				id: "export-pdf",
				label: "Export active CV as PDF",
				group: "Actions",
				icon: Printer,
				keywords: "print download",
				run: () => {
					void exportPdf();
					close();
				},
			});

			if (canGenerateActive) {
				actions.push({
					id: "generate",
					label: "Generate tailored CV",
					group: "Actions",
					icon: WandSparkles,
					keywords: "ai tailor regenerate",
					run: () => {
						void generateActive();
						close();
					},
				});
			}
		}

		const applicationItems: CommandItem[] = activeApplications.map(
			(application) => ({
				id: `app-${application.id}`,
				label: applicationTitle(application),
				group: "Applications",
				icon: FileText,
				keywords: `${application.jobOffer.company} open switch`,
				hint: application.jobOffer.company.trim() || undefined,
				run: () => {
					openApplication(application.id);
					goToWorkspace();
					close();
				},
			}),
		);

		const appearanceItems: CommandItem[] = [
			{
				id: "theme-light",
				label: "Theme: Light",
				group: "Appearance",
				icon: Sun,
				keywords: "mode color",
				run: () => {
					setTheme("light");
					close();
				},
			},
			{
				id: "theme-dark",
				label: "Theme: Dark",
				group: "Appearance",
				icon: Moon,
				keywords: "mode color",
				run: () => {
					setTheme("dark");
					close();
				},
			},
			{
				id: "theme-system",
				label: "Theme: System",
				group: "Appearance",
				icon: Monitor,
				keywords: "mode color",
				run: () => {
					setTheme("system");
					close();
				},
			},
			...palettes.map((option) => ({
				id: `palette-${option.id}`,
				label: `Palette: ${option.name}`,
				group: "Appearance",
				icon: Palette,
				keywords: "color theme accent",
				run: () => {
					setPalette(option.id);
					close();
				},
			})),
		];

		return [...actions, ...applicationItems, ...appearanceItems];
	}, [
		activeApplications,
		activeApplication,
		canGenerateActive,
		createApplication,
		openApplication,
		generateActive,
		exportPdf,
		navigate,
		palettes,
		setPalette,
		setTheme,
	]);

	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) {
			return items;
		}

		return items.filter((item) =>
			`${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(term),
		);
	}, [items, query]);

	useEffect(() => {
		setActiveIndex((index) =>
			Math.min(index, Math.max(filtered.length - 1, 0)),
		);
	}, [filtered.length]);

	if (!open) {
		return null;
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => (index + 1) % Math.max(filtered.length, 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex(
				(index) =>
					(index - 1 + Math.max(filtered.length, 1)) %
					Math.max(filtered.length, 1),
			);
		} else if (event.key === "Enter") {
			event.preventDefault();
			filtered[activeIndex]?.run();
		} else if (event.key === "Escape") {
			event.preventDefault();
			setOpen(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
			<button
				type="button"
				aria-label="Close command palette"
				className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
				onClick={() => setOpen(false)}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Command palette"
				className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
				onKeyDown={handleKeyDown}
			>
				<div className="flex items-center gap-2 border-b px-3">
					<Search className="size-4 text-muted-foreground" />
					<input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Type a command or search…"
						className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					/>
					<kbd className="rounded border bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
						ESC
					</kbd>
				</div>

				<div className="max-h-80 overflow-y-auto p-2">
					{filtered.length === 0 ? (
						<p className="px-2 py-6 text-center text-muted-foreground text-sm">
							No results for “{query}”.
						</p>
					) : (
						groupOrder.map((group) => {
							const groupItems = filtered.filter(
								(item) => item.group === group,
							);
							if (groupItems.length === 0) {
								return null;
							}

							return (
								<div key={group} className="mb-1 last:mb-0">
									<p className="px-2 py-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
										{group}
									</p>
									<ul>
										{groupItems.map((item) => {
											const index = filtered.indexOf(item);
											const active = index === activeIndex;
											const Icon = item.icon;
											return (
												<li key={item.id}>
													<button
														type="button"
														onMouseMove={() => setActiveIndex(index)}
														onClick={() => item.run()}
														className={cn(
															"flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
															active
																? "bg-accent text-accent-foreground"
																: "text-foreground",
														)}
													>
														<Icon className="size-4 shrink-0 text-muted-foreground" />
														<span className="min-w-0 flex-1 truncate">
															{item.label}
														</span>
														{item.hint ? (
															<span className="shrink-0 text-muted-foreground text-xs">
																{item.hint}
															</span>
														) : null}
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
