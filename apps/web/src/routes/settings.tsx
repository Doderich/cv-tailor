import type { AiProviderId, AiToolId } from "@cv-tailor/ai";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@cv-tailor/ui/components/tabs";
import { cn } from "@cv-tailor/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";

import { AiStatusPanel } from "@/components/cv/insights";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { PalettePicker } from "@/components/palette-picker";
import { useTheme } from "@/components/theme-provider";
import {
	claudeModelOptions,
	codexModelOptions,
	cursorModelOptions,
	toolIsReady,
	useCvApp,
} from "@/lib/cv-app-context";

export const Route = createFileRoute("/settings")({
	component: SettingsRoute,
});

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
	{ id: "cursor", label: "Cursor" },
];

function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
}: {
	options: { id: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<div className="inline-flex w-fit rounded-lg border bg-card p-1">
			{options.map((option) => {
				const active = value === option.id;
				return (
					<button
						key={option.id}
						type="button"
						onClick={() => onChange(option.id)}
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
	);
}

function SettingsRoute() {
	const {
		aiModels,
		aiStatuses,
		effectiveAiProvider,
		profile,
		refreshAiStatuses,
		replaceProfile,
		selectedTool,
		setAiModel,
		setSelectedTool,
		updateProfile,
	} = useCvApp();

	const modelOptions =
		effectiveAiProvider === "codex"
			? codexModelOptions
			: effectiveAiProvider === "cursor"
				? cursorModelOptions
				: claudeModelOptions;
	const activeModel = effectiveAiProvider
		? aiModels[effectiveAiProvider]
		: undefined;

	return (
		<div className="mx-auto grid w-full max-w-4xl gap-6 p-4 sm:p-6">
			<Tabs defaultValue="appearance">
				<TabsList variant="line">
					<TabsTrigger value="appearance">Appearance</TabsTrigger>
					<TabsTrigger value="ai">AI</TabsTrigger>
					<TabsTrigger value="profile">Profile</TabsTrigger>
				</TabsList>

				<TabsContent value="appearance" className="grid gap-4 pt-6">
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
				</TabsContent>

				<TabsContent value="ai" className="grid gap-4 pt-6">
					<div className="grid gap-4">
						<div className="grid gap-2">
							<span className="font-medium text-sm">Preferred tool</span>
							<SegmentedControl
								options={toolOptions}
								value={selectedTool}
								onChange={setSelectedTool}
							/>
						</div>
						{effectiveAiProvider ? (
							<div className="grid gap-2">
								<span className="font-medium text-sm">Model</span>
								<SegmentedControl
									options={modelOptions}
									value={activeModel ?? modelOptions[0]?.id ?? ""}
									onChange={(model) =>
										setAiModel(effectiveAiProvider as AiProviderId, model)
									}
								/>
							</div>
						) : null}
						<div>
							<Button variant="outline" onClick={() => void refreshAiStatuses()}>
								<RefreshCw /> Refresh tools
							</Button>
						</div>
						<AiStatusPanel statuses={aiStatuses} />
					</div>
				</TabsContent>

				<TabsContent value="profile" className="grid gap-4 pt-6">
					<div className="grid gap-4">
						<ProfileImporter
							selectedTool={selectedTool}
							canUseAi={toolIsReady(selectedTool, aiStatuses)}
							preferredTone={profile.preferredTone}
							onProfileGenerated={replaceProfile}
						/>
						<ProfileEditor profile={profile} onChange={updateProfile} />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
