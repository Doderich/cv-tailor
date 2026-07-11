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
	Trash2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/command-palette";
import { ApplicationStepTabBar } from "@/components/application-step-tab-bar";
import { SettingsTabBar } from "@/components/settings-tab-bar";
import { ScoreBadge } from "@/components/cv/score-badge";
import { useAppMenuShortcuts } from "@/hooks/use-app-menu-shortcuts";
import { applicationStepPath } from "@/lib/application-route";
import type { ApplicationListItem } from "@/lib/cv-app-context";
import {
	applicationCompany,
	applicationTitle,
	useCvApp,
} from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

const isDesktop = isTauriRuntime();
const sidebarWidthKey = "cv-tailor-sidebar-width";
const sidebarCollapsedKey = "cv-tailor-sidebar-collapsed";
const minSidebarWidth = 240;
const maxSidebarWidth = 520;
const defaultSidebarWidth = 300;
const shellHeaderHeight = "h-10";
const macTitlebarInsetLeft = "pl-[4.875rem]";

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

function ApplicationRailItem({
	application,
	active,
	onOpen,
	onArchiveToggle,
	onDelete,
}: {
	application: ApplicationListItem;
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
				<span className="line-clamp-2 font-medium text-base leading-snug">
					{applicationTitle(application)}
				</span>
				<span className="flex items-center gap-1.5">
					{application.isDraft ? (
						<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
							Draft
						</span>
					) : application.previewScore !== undefined ? (
						<ScoreBadge score={application.previewScore} />
					) : null}
					<span className="min-w-0 truncate text-muted-foreground text-sm">
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
		archiveApplication,
		createApplication,
		deleteApplication,
		restoreApplication,
		openApplication,
	} = useCvApp();
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const activeApplicationId = pathname.startsWith("/application/")
		? pathname.slice("/application/".length).split("/")[0]
		: undefined;
	const [query, setQuery] = useState("");
	const [showArchived, setShowArchived] = useState(false);

	const term = query.trim().toLowerCase();
	const matches = (application: ApplicationListItem) =>
		`${application.jobOffer.title} ${application.jobOffer.company}`
			.toLowerCase()
			.includes(term);
	const visibleActive = activeApplications.filter(matches);
	const visibleArchived = archivedApplications.filter(matches);

	function handleOpen(id: string) {
		openApplication(id);
		void navigate(applicationStepPath(id, "job-details"));
		onNavigate?.();
	}

	function handleCreate() {
		const id = createApplication();
		if (!id) {
			return;
		}

		void navigate(applicationStepPath(id, "job-details"));
		onNavigate?.();
	}

	function handleDelete(application: ApplicationListItem) {
		const snapshot = deleteApplication(application.id);
		if (application.id === activeApplicationId) {
			void navigate({ to: "/" });
		}
		toast("Application deleted", {
			description: applicationTitle(application),
			action: snapshot
				? {
						label: "Undo",
						onClick: () => restoreApplication(snapshot),
					}
				: undefined,
		});
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-3",
				)}
			>
				<div className="relative min-w-0">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search applications"
						className="h-9 w-full bg-sidebar pl-9"
					/>
				</div>

			<Button className="w-full justify-center" onClick={handleCreate}>
				<Plus /> New application
			</Button>

			<ScrollArea className="-mx-1 min-h-0 flex-1">
				<div className="px-1">
					{visibleActive.length === 0 ? (
						<p className="px-2 py-6 text-center text-muted-foreground text-sm">
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
										active={application.id === activeApplicationId}
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
								className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-muted-foreground text-sm hover:bg-sidebar-accent/60"
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
												active={application.id === activeApplicationId}
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

			<div className="border-sidebar-border border-t p-3">
				<Button
					variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
					className="w-full justify-start"
					onClick={() => {
						void navigate({ to: "/settings" });
						onNavigate?.();
					}}
				>
					<Settings /> Settings
					{isDesktop ? (
						<kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
							⌘,
						</kbd>
					) : null}
				</Button>
			</div>
			</div>
		</div>
	);
}

function ShellHeader({
	center,
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	center?: ReactNode;
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	const dragRegion = isDesktop
		? ({ "data-tauri-drag-region": "" } as const)
		: {};

	return (
		<header
			className={cn(
				"relative flex shrink-0 items-center border-b bg-background/95 backdrop-blur",
				shellHeaderHeight,
				isDesktop && macTitlebarInsetLeft,
			)}
			{...dragRegion}
		>
			<div className="relative z-10 flex shrink-0 items-center px-2">
				<SidebarToggle
					onOpenRail={onOpenRail}
					onToggleCollapse={onToggleCollapse}
					collapsed={collapsed}
				/>
			</div>

			{center ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="pointer-events-auto px-2">{center}</div>
				</div>
			) : null}
		</header>
	);
}

function ApplicationStepHeader({
	applicationId,
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	applicationId: string;
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	return (
		<ShellHeader
			onOpenRail={onOpenRail}
			onToggleCollapse={onToggleCollapse}
			collapsed={collapsed}
			center={<ApplicationStepTabBar applicationId={applicationId} />}
		/>
	);
}

function SettingsStepHeader({
	onOpenRail,
	onToggleCollapse,
	collapsed,
}: {
	onOpenRail: () => void;
	onToggleCollapse: () => void;
	collapsed: boolean;
}) {
	return (
		<ShellHeader
			onOpenRail={onOpenRail}
			onToggleCollapse={onToggleCollapse}
			collapsed={collapsed}
			center={<SettingsTabBar />}
		/>
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
		<ShellHeader
			onOpenRail={onOpenRail}
			onToggleCollapse={onToggleCollapse}
			collapsed={collapsed}
		/>
	);
}

export function AppShell({ children }: { children: ReactNode }) {
	const [railOpen, setRailOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const [width, setWidth] = useState(defaultSidebarWidth);
	useAppMenuShortcuts();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const applicationId = pathname.startsWith("/application/")
		? pathname.slice("/application/".length).split("/")[0]
		: undefined;
	const isSettingsRoute = pathname.startsWith("/settings");
	const showStepHeader = Boolean(applicationId);

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
			{showStepHeader && applicationId ? (
				<ApplicationStepHeader
					applicationId={applicationId}
					onOpenRail={() => setRailOpen(true)}
					onToggleCollapse={toggleCollapsed}
					collapsed={collapsed}
				/>
			) : isSettingsRoute ? (
				<SettingsStepHeader
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
						"relative hidden flex-col border-r bg-sidebar text-sidebar-foreground lg:flex lg:h-full",
						collapsed ? "lg:hidden" : "lg:flex",
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

				<ScrollArea className="min-h-0 flex-1">
					<main>{children}</main>
				</ScrollArea>
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
				<h1 className="text-balance font-semibold text-3xl tracking-tight font-heading">
					{title}
				</h1>
				{meta ? (
					<div className="mt-1 text-base text-muted-foreground">{meta}</div>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}
