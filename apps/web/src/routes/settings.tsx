import type { AiToolId } from "@cv-tailor/ai";
import { Button } from "@cv-tailor/ui/components/button";
import { cn } from "@cv-tailor/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/app-shell";
import { AiStatusPanel } from "@/components/cv/insights";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { PalettePicker } from "@/components/palette-picker";
import { useTheme } from "@/components/theme-provider";
import { toolIsReady, useCvApp } from "@/lib/cv-app-context";

export const Route = createFileRoute("/settings")({
	component: SettingsRoute,
});

function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-4 border-t pt-8 first:border-t-0 first:pt-0">
			<div className="grid gap-1">
				<h2 className="font-semibold text-lg tracking-tight">{title}</h2>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

const themeOptions = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
] as const;

function ThemeToggleGroup() {
	const { theme, setTheme } = useTheme();

	return (
		<div className="inline-flex w-fit rounded-lg border bg-card p-1">
			{themeOptions.map((option) => {
				const Icon = option.icon;
				const active = theme === option.id;
				return (
					<button
						key={option.id}
						type="button"
						onClick={() => setTheme(option.id)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						<Icon className="size-4" />
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

const toolOptions: { id: AiToolId; label: string }[] = [
	{ id: "auto", label: "Auto" },
	{ id: "claude", label: "Claude" },
	{ id: "codex", label: "Codex" },
];

function SettingsRoute() {
	const {
		aiStatuses,
		profile,
		refreshAiStatuses,
		replaceProfile,
		selectedTool,
		setSelectedTool,
		updateProfile,
	} = useCvApp();

	return (
		<div className="mx-auto grid w-full max-w-4xl gap-8 p-4 sm:p-6">
			<PageHeader
				eyebrow="Workspace"
				title="Profile & settings"
				meta="Manage your base profile, AI tools, and appearance."
			/>

			<SettingsSection
				title="Appearance"
				description="Choose a color theme and palette. Applies across the app instantly."
			>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<span className="font-medium text-sm">Mode</span>
						<ThemeToggleGroup />
					</div>
					<div className="grid gap-2">
						<span className="font-medium text-sm">Palette</span>
						<PalettePicker />
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				title="AI tools"
				description="Local CLI tools used to generate tailored CVs (desktop app only)."
			>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<span className="font-medium text-sm">Preferred tool</span>
						<div className="inline-flex w-fit rounded-lg border bg-card p-1">
							{toolOptions.map((option) => {
								const active = selectedTool === option.id;
								return (
									<button
										key={option.id}
										type="button"
										onClick={() => setSelectedTool(option.id)}
										className={cn(
											"rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
											active
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:bg-muted",
										)}
									>
										{option.label}
									</button>
								);
							})}
						</div>
					</div>
					<div>
						<Button variant="outline" onClick={() => void refreshAiStatuses()}>
							<RefreshCw /> Refresh tools
						</Button>
					</div>
					<AiStatusPanel statuses={aiStatuses} />
				</div>
			</SettingsSection>

			<SettingsSection
				title="Base profile"
				description="Your reusable source of truth. Every tailored CV starts from here."
			>
				<div className="grid gap-4">
					<ProfileImporter
						selectedTool={selectedTool}
						canUseAi={toolIsReady(selectedTool, aiStatuses)}
						preferredTone={profile.preferredTone}
						onProfileGenerated={replaceProfile}
					/>
					<ProfileEditor profile={profile} onChange={updateProfile} />
				</div>
			</SettingsSection>
		</div>
	);
}
