import { Button } from "@cv-tailor/ui/components/button";
import { Label } from "@cv-tailor/ui/components/label";
import { cn } from "@cv-tailor/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	History,
	RefreshCw,
	Sparkles,
	SquareActivity,
	UserRoundCog,
	WandSparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { useCvApp } from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

const navItems = [
	{ to: "/profiles", label: "Profiles", icon: UserRoundCog },
	{ to: "/generate", label: "Generate", icon: WandSparkles },
	{ to: "/history", label: "History", icon: History },
] as const;

function getSaveLabel(saveStatus: ReturnType<typeof useCvApp>["saveStatus"]) {
	if (saveStatus === "saving") {
		return "Saving";
	}

	if (saveStatus === "error") {
		return "Save error";
	}

	if (saveStatus === "idle") {
		return "Loading";
	}

	return "Saved";
}

export function AppShell({ children }: { children: ReactNode }) {
	const {
		aiStatuses,
		refreshAiStatuses,
		saveStatus,
		selectedTool,
		setSelectedTool,
	} = useCvApp();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const readyTools = aiStatuses.filter((status) => status.available).length;

	return (
		<div className="app-shell min-h-svh bg-background text-foreground">
			<div className="grid min-h-svh lg:grid-cols-[248px_minmax(0,1fr)]">
				<aside className="border-b bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-svh lg:border-r lg:border-b-0">
					<div className="flex h-full flex-col gap-4 p-3">
						<div className="flex items-center gap-2 px-1 py-1">
							<div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
								<Sparkles className="size-4" />
							</div>
							<div className="min-w-0">
								<h1 className="truncate font-semibold text-sm">CV Tailor</h1>
								<p className="truncate text-muted-foreground text-xs">
									{isTauriRuntime() ? "Desktop workspace" : "Web preview"}
								</p>
							</div>
						</div>

						<nav className="flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
							{navItems.map((item) => {
								const Icon = item.icon;
								const active = pathname === item.to;

								return (
									<Link
										key={item.to}
										to={item.to}
										className={cn(
											"inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 font-medium text-xs transition-colors",
											active
												? "bg-sidebar-primary text-sidebar-primary-foreground"
												: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
										)}
									>
										<Icon className="size-4" />
										{item.label}
									</Link>
								);
							})}
						</nav>

						<div className="mt-auto hidden rounded-md border border-sidebar-border bg-background/60 p-3 text-xs lg:grid lg:gap-2">
							<div className="flex items-center justify-between gap-2">
								<span className="text-muted-foreground">Storage</span>
								<span
									className={cn(
										"font-medium",
										saveStatus === "error" && "text-destructive",
									)}
								>
									{getSaveLabel(saveStatus)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-muted-foreground">AI tools</span>
								<span className="font-medium">
									{readyTools}/{aiStatuses.length || 2} ready
								</span>
							</div>
						</div>
					</div>
				</aside>

				<div className="flex min-h-0 flex-col">
					<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
						<div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 lg:px-6">
							<div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
								<SquareActivity className="size-4 text-primary" />
								<span className="font-medium">{getSaveLabel(saveStatus)}</span>
								<span className="hidden truncate text-muted-foreground sm:inline">
									{isTauriRuntime()
										? "Local AI enabled"
										: "Local CLI generation disabled"}
								</span>
							</div>

							<div className="flex items-center gap-2">
								<Label className="sr-only" htmlFor="ai-tool">
									AI tool
								</Label>
								<select
									id="ai-tool"
									value={selectedTool}
									onChange={(event) =>
										setSelectedTool(event.target.value as typeof selectedTool)
									}
									className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
								>
									<option value="auto">Auto</option>
									<option value="claude">Claude</option>
									<option value="codex">Codex</option>
								</select>
								<Button
									size="icon"
									variant="outline"
									onClick={() => void refreshAiStatuses()}
									title="Refresh AI tools"
								>
									<RefreshCw />
								</Button>
								<ModeToggle />
							</div>
						</div>
					</header>

					<main className="min-h-0 flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[1500px] p-4 sm:p-5 lg:p-6">
							{children}
						</div>
					</main>
				</div>
			</div>
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
		<div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
			<div className="min-w-0">
				{eyebrow ? (
					<p className="font-medium text-muted-foreground text-xs uppercase">
						{eyebrow}
					</p>
				) : null}
				<h2 className="text-balance font-semibold text-2xl">{title}</h2>
				{meta ? (
					<div className="mt-1 text-muted-foreground text-xs">{meta}</div>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}
