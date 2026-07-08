import type { GeneratedCv } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cv-tailor/ui/components/dropdown-menu";
import { Input } from "@cv-tailor/ui/components/input";
import { ScrollArea } from "@cv-tailor/ui/components/scroll-area";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	Archive,
	ArchiveRestore,
	ChevronRight,
	MoreHorizontal,
	PanelLeft,
	PanelLeftClose,
	Plus,
	Search,
	Settings,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/command-palette";
import { ScoreBadge } from "@/components/cv/score-badge";
import { applicationViewRegistry, viewMeta } from "@/lib/application-views";
import {
	applicationCompany,
	applicationTitle,
	isDraftApplication,
	useCvApp,
} from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

const isDesktop = isTauriRuntime();
const sidebarWidthKey = "cv-tailor-sidebar-width";
const sidebarCollapsedKey = "cv-tailor-sidebar-collapsed";
const minSidebarWidth = 240;
const maxSidebarWidth = 520;
const defaultSidebarWidth = 300;

function SidebarToggle({
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	return (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				className="lg:hidden"
				onClick={onOpenRail}
				title="Open applications"
			>
				<PanelLeft />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				className="hidden shrink-0 lg:inline-flex"
				onClick={onToggleCollapse}
				title={collapsed ? "Show sidebar" : "Hide sidebar"}
			>
				{collapsed ? <PanelLeft /> : <PanelLeftClose />}
			</Button>
		</>
	);
}

function clampWidth(value: number) {
	return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, value));
}

function saveLabel(saveStatus: ReturnType<typeof useCvApp>["saveStatus"]) {
	if (saveStatus === "saving") return "Saving…";
	if (saveStatus === "error") return "Save error";
	if (saveStatus === "idle") return "Loading…";
	return "All changes saved";
}

function ApplicationRailItem({
	application,
	active,
	onOpen,
	onArchiveToggle,
	onDelete,
}: {
	application: GeneratedCv;
	active: boolean;
	onOpen: () => void;
	onArchiveToggle: () => void;
	onDelete: () => void;
}) {
	const archived = Boolean(application.archived);

	return (
		<div
			className={cn(
				"group relative rounded-lg transition-colors",
				active
					? "bg-sidebar-accent text-sidebar-accent-foreground"
					: "hover:bg-sidebar-accent/60",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				className="grid w-full gap-1 px-2.5 py-2 pr-8 text-left"
			>
				<span className="line-clamp-2 font-medium text-sm leading-snug">
					{applicationTitle(application)}
				</span>
				<span className="flex items-center gap-1.5">
					{isDraftApplication(application) ? (
						<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
							Draft
						</span>
					) : (
						<ScoreBadge score={application.matchAnalysis.score} />
					)}
					<span className="min-w-0 truncate text-muted-foreground text-xs">
						{applicationCompany(application)}
					</span>
				</span>
			</button>

			<div className="absolute top-1.5 right-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 data-[open]:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-xs"
								title="More"
								onClick={(event) => event.stopPropagation()}
							/>
						}
					>
						<MoreHorizontal />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onArchiveToggle}>
							{archived ? (
								<>
									<ArchiveRestore /> Unarchive
								</>
							) : (
								<>
									<Archive /> Archive
								</>
							)}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onClick={onDelete}>
							<Trash2 /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function ApplicationRail({ onNavigate }: { onNavigate?: () => void }) {
	const {
		activeApplications,
		archivedApplications,
		activeId,
		aiStatuses,
		archiveApplication,
		createApplication,
		deleteApplication,
		restoreApplication,
		openApplication,
		saveStatus,
	} = useCvApp();
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [query, setQuery] = useState("");
	const [showArchived, setShowArchived] = useState(false);

	const term = query.trim().toLowerCase();
	const matches = (application: GeneratedCv) =>
		`${application.jobOffer.title} ${application.jobOffer.company}`
			.toLowerCase()
			.includes(term);
	const visibleActive = activeApplications.filter(matches);
	const visibleArchived = archivedApplications.filter(matches);
	const readyTools = aiStatuses.filter((status) => status.available).length;

	function handleOpen(id: string) {
		openApplication(id);
		void navigate({ to: "/" });
		onNavigate?.();
	}

	function handleCreate() {
		createApplication();
		void navigate({ to: "/" });
		onNavigate?.();
	}

	function handleDelete(application: GeneratedCv) {
		deleteApplication(application.id);
		toast("Application deleted", {
			description: applicationTitle(application),
			action: {
				label: "Undo",
				onClick: () => restoreApplication(application),
			},
		});
	}

	return (
		<div className="flex h-full flex-col gap-3 p-3">
			<div
				className="flex items-center gap-2 px-1 pt-1"
				data-tauri-drag-region={isDesktop ? "" : undefined}
			>
				<div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
					<Sparkles className="size-4" />
				</div>
				<div className="min-w-0 leading-tight">
					<p className="truncate font-semibold text-sm">CV Tailor</p>
					<p className="truncate text-muted-foreground text-xs">
						{isDesktop ? "Desktop workspace" : "Web preview"}
					</p>
				</div>
				<div
					className="h-8 flex-1 self-stretch"
					data-tauri-drag-region={isDesktop ? "" : undefined}
				/>
			</div>

			<div className="relative">
				<Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search applications"
					className="h-8 pl-8"
				/>
			</div>

			<Button className="w-full justify-center" onClick={handleCreate}>
				<Plus /> New application
			</Button>

			<ScrollArea className="-mx-1 min-h-0 flex-1">
				<div className="px-1">
					{visibleActive.length === 0 ? (
						<p className="px-2 py-6 text-center text-muted-foreground text-xs">
							{activeApplications.length === 0
								? "No applications yet. Create your first to get started."
								: "No matches."}
						</p>
					) : (
						<ul className="grid gap-1">
							{visibleActive.map((application) => (
								<li key={application.id}>
									<ApplicationRailItem
										application={application}
										active={application.id === activeId && pathname === "/"}
										onOpen={() => handleOpen(application.id)}
										onArchiveToggle={() =>
											archiveApplication(application.id, true)
										}
										onDelete={() => handleDelete(application)}
									/>
								</li>
							))}
						</ul>
					)}

					{visibleArchived.length > 0 ? (
						<div className="mt-3">
							<button
								type="button"
								onClick={() => setShowArchived((value) => !value)}
								className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground text-xs hover:bg-sidebar-accent/60"
							>
								<ChevronRight
									className={cn(
										"size-3.5 transition-transform",
										showArchived && "rotate-90",
									)}
								/>
								Archived ({visibleArchived.length})
							</button>
							{showArchived ? (
								<ul className="mt-1 grid gap-1">
									{visibleArchived.map((application) => (
										<li key={application.id}>
											<ApplicationRailItem
												application={application}
												active={application.id === activeId && pathname === "/"}
												onOpen={() => handleOpen(application.id)}
												onArchiveToggle={() =>
													archiveApplication(application.id, false)
												}
												onDelete={() => handleDelete(application)}
											/>
										</li>
									))}
								</ul>
							) : null}
						</div>
					) : null}
				</div>
			</ScrollArea>

			<div className="grid gap-2 border-sidebar-border border-t pt-3">
				<Button
					variant={pathname === "/settings" ? "secondary" : "ghost"}
					className="w-full justify-start"
					onClick={() => {
						void navigate({ to: "/settings" });
						onNavigate?.();
					}}
				>
					<Settings /> Profile & settings
				</Button>
				<div className="flex items-center justify-between gap-2 px-2 text-muted-foreground text-xs">
					<span className={cn(saveStatus === "error" && "text-destructive")}>
						{saveLabel(saveStatus)}
					</span>
					<span>
						{readyTools}/{aiStatuses.length || 2} AI ready
					</span>
				</div>
			</div>
		</div>
	);
}

function ViewTabBar({
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	const {
		activeApplication,
		activeViews,
		activeViewId,
		openView,
		closeView,
		setActiveView,
	} = useCvApp();

	return (
		<header
			className={cn(
				"flex h-10 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur",
			)}
			data-tauri-drag-region={isDesktop ? "" : undefined}
		>
			<SidebarToggle
				onOpenRail={onOpenRail}
				onToggleCollapse={onToggleCollapse}
				collapsed={collapsed}
			/>

			{activeApplication ? (
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-none">
					{activeViews.map((view) => {
						const meta = viewMeta(view.type);
						const Icon = meta.icon;
						const active = view.id === activeViewId;
						const isEditor = view.type === "editor";
						const label = isEditor
							? applicationTitle(activeApplication)
							: meta.label;
						return (
							<div
								key={view.id}
								className={cn(
									"group flex h-8 max-w-[240px] shrink-0 items-center gap-1.5 rounded-md border pr-1 pl-2.5 text-sm transition-colors",
									active
										? "border-border bg-muted"
										: "border-transparent hover:bg-muted/60",
								)}
							>
								<button
									type="button"
									className="flex min-w-0 items-center gap-1.5 py-1"
									onClick={() => setActiveView(view.id)}
								>
									{isEditor ? null : (
										<Icon className="size-3.5 shrink-0 text-muted-foreground" />
									)}
									<span className="truncate" title={label}>
										{label}
									</span>
									{meta.available ? null : (
										<span className="rounded-full bg-accent px-1 py-px text-[9px] text-accent-foreground uppercase">
											soon
										</span>
									)}
								</button>
								{activeViews.length > 1 ? (
									<button
										type="button"
										className="grid size-5 shrink-0 place-items-center rounded opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
										onClick={() => closeView(view.id)}
										title="Close view"
									>
										<X className="size-3.5" />
									</button>
								) : null}
							</div>
						);
					})}

					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="shrink-0"
									title="Add view"
								/>
							}
						>
							<Plus />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{applicationViewRegistry.map((meta) => {
								const Icon = meta.icon;
								return (
									<DropdownMenuItem
										key={meta.type}
										onClick={() => openView(meta.type)}
									>
										<Icon />
										<span className="flex-1">{meta.label}</span>
										{meta.available ? null : (
											<span className="rounded-full bg-accent px-1.5 py-px text-[9px] text-accent-foreground uppercase">
												soon
											</span>
										)}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>

					<div
						className="h-full min-w-8 flex-1 self-stretch"
						data-tauri-drag-region={isDesktop ? "" : undefined}
					/>
				</div>
			) : (
				<div
					className="flex h-full flex-1 items-center self-stretch pl-1 text-muted-foreground text-sm"
					data-tauri-drag-region={isDesktop ? "" : undefined}
				>
					No application open
				</div>
			)}
		</header>
	);
}

function RouteTopBar({
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	return (
		<header
			className={cn(
				"flex h-10 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur",
			)}
			data-tauri-drag-region={isDesktop ? "" : undefined}
		>
			<SidebarToggle
				onOpenRail={onOpenRail}
				onToggleCollapse={onToggleCollapse}
				collapsed={collapsed}
			/>
			<div
				className="h-full flex-1 self-stretch"
				data-tauri-drag-region={isDesktop ? "" : undefined}
			/>
		</header>
	);
}

export function AppShell({ children }: { children: ReactNode }) {
	const [railOpen, setRailOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const [width, setWidth] = useState(defaultSidebarWidth);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const showTabBar = pathname === "/";

	const toggleCollapsed = useCallback(() => {
		setCollapsed((prev) => {
			const next = !prev;
			window.localStorage.setItem(sidebarCollapsedKey, String(next));
			return next;
		});
	}, []);

	useEffect(() => {
		const stored = window.localStorage.getItem(sidebarWidthKey);
		if (stored) {
			setWidth(clampWidth(Number.parseInt(stored, 10) || defaultSidebarWidth));
		}
		setCollapsed(window.localStorage.getItem(sidebarCollapsedKey) === "true");
	}, []);

	const startResize = useCallback(
		(event: React.PointerEvent) => {
			event.preventDefault();
			const startX = event.clientX;
			const startWidth = width;

			function onMove(moveEvent: PointerEvent) {
				setWidth(clampWidth(startWidth + moveEvent.clientX - startX));
			}

			function onUp() {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				document.body.style.removeProperty("cursor");
				document.body.style.removeProperty("user-select");
				setWidth((current) => {
					window.localStorage.setItem(sidebarWidthKey, String(current));
					return current;
				});
			}

			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		},
		[width],
	);

	return (
		<div
			className="app-shell flex h-svh flex-col overflow-hidden overscroll-none bg-background text-foreground"
			style={{ "--rail-w": `${width}px` } as React.CSSProperties}
		>
			{isDesktop ? (
				<div
					className="h-7 shrink-0 border-b bg-sidebar"
					data-tauri-drag-region=""
				/>
			) : null}
			<div
				className={cn(
					"grid min-h-0 flex-1 grid-cols-1 [grid-template-rows:minmax(0,1fr)]",
					collapsed
						? "lg:grid-cols-1"
						: "lg:[grid-template-columns:var(--rail-w)_minmax(0,1fr)]",
				)}
			>
				<aside
					className={cn(
						"relative hidden border-r bg-sidebar text-sidebar-foreground lg:h-full",
						collapsed ? "lg:hidden" : "lg:block",
					)}
				>
					<ApplicationRail />
					<div
						onPointerDown={startResize}
						className="absolute top-0 right-0 z-10 hidden h-full w-1.5 cursor-col-resize hover:bg-primary/30 lg:block"
						title="Drag to resize"
					/>
				</aside>

				{railOpen ? (
					<div className="fixed inset-0 z-40 lg:hidden">
						<button
							type="button"
							aria-label="Close menu"
							className="absolute inset-0 bg-foreground/40"
							onClick={() => setRailOpen(false)}
						/>
						<div className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar text-sidebar-foreground shadow-xl">
							<ApplicationRail onNavigate={() => setRailOpen(false)} />
						</div>
					</div>
				) : null}

				<div className="flex min-h-0 flex-col">
					{showTabBar ? (
						<ViewTabBar
							onOpenRail={() => setRailOpen(true)}
							onToggleCollapse={toggleCollapsed}
							collapsed={collapsed}
						/>
					) : (
						<RouteTopBar
							onOpenRail={() => setRailOpen(true)}
							onToggleCollapse={toggleCollapsed}
							collapsed={collapsed}
						/>
					)}
					<ScrollArea className="min-h-0 flex-1">
						<main>{children}</main>
					</ScrollArea>
				</div>
			</div>
			<CommandPalette />
		</div>
	);
}

export function PageHeader({
	actions,
	eyebrow,
	meta,
	title,
}: {
	actions?: ReactNode;
	eyebrow?: string;
	meta?: ReactNode;
	title: string;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div className="min-w-0">
				{eyebrow ? (
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{eyebrow}
					</p>
				) : null}
				<h1 className="text-balance font-semibold text-2xl tracking-tight">
					{title}
				</h1>
				{meta ? (
					<div className="mt-1 text-muted-foreground text-sm">{meta}</div>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}
