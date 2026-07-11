import type { AiProviderId, AiToolId } from "@cv-tailor/ai";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { cn } from "@cv-tailor/ui/lib/utils";
import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";

import { DataBackupPanel } from "@/components/data-backup-panel";
import { AiStatusPanel } from "@/components/cv/insights";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { ProfileManager } from "@/components/cv/profile-manager";
import { FontPicker } from "@/components/font-picker";
import { PalettePicker } from "@/components/palette-picker";
import { useTextSize, type TextSizeId } from "@/components/text-size-provider";
import { useTheme } from "@/components/theme-provider";
import {
	claudeModelOptions,
	codexModelOptions,
	cursorModelOptions,
	toolIsReady,
	useCvApp,
} from "@/lib/cv-app-context";

const themeOptions = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
] as const;

const segmentedContainerClass =
	"inline-flex w-fit rounded-md border bg-card p-0.5";
const segmentedButtonClass =
	"rounded-sm px-2.5 py-1 text-sm font-medium transition-colors";

const toolOptions: { id: AiToolId; label: string }[] = [
	{ id: "auto", label: "Auto" },
	{ id: "claude", label: "Claude" },
	{ id: "codex", label: "Codex" },
	{ id: "cursor", label: "Cursor" },
];

function ThemeToggleGroup() {
	const { theme, setTheme } = useTheme();

	return (
		<div className={segmentedContainerClass}>
			{themeOptions.map((option) => {
				const Icon = option.icon;
				const active = theme === option.id;
				return (
					<button
						key={option.id}
						type="button"
						onClick={() => setTheme(option.id)}
						className={cn(
							"inline-flex items-center gap-1.5",
							segmentedButtonClass,
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						<Icon className="size-3.5" />
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

function TextSizeSelect() {
	const { textSize, setTextSize, textSizeOptions } = useTextSize();

	return (
		<Select
			value={textSize}
			onValueChange={(value) => {
				if (value) {
					setTextSize(value as TextSizeId);
				}
			}}
		>
			<SelectTrigger className="max-w-xs" size="sm">
				<SelectValue placeholder="Select text size" />
			</SelectTrigger>
			<SelectContent>
				{textSizeOptions.map((option) => (
					<SelectItem key={option.id} value={option.id}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

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
		<div className={segmentedContainerClass}>
			{options.map((option) => {
				const active = value === option.id;
				return (
					<button
						key={option.id}
						type="button"
						onClick={() => onChange(option.id)}
						className={cn(
							segmentedButtonClass,
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

function SettingsSection({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto grid w-full max-w-4xl gap-4 p-4 sm:p-6">
			{children}
		</div>
	);
}

export function SettingsAppearanceSection() {
	return (
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">Mode</span>
					<ThemeToggleGroup />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">Text size</span>
					<TextSizeSelect />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">Typeface</span>
					<FontPicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">Palette</span>
					<PalettePicker />
				</div>
			</div>
		</SettingsSection>
	);
}

export function SettingsAiSection() {
	const {
		aiModels,
		aiStatuses,
		effectiveAiProvider,
		refreshAiStatuses,
		selectedTool,
		setAiModel,
		setSelectedTool,
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
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">Preferred tool</span>
					<SegmentedControl
						options={toolOptions}
						value={selectedTool}
						onChange={setSelectedTool}
					/>
				</div>
				{effectiveAiProvider ? (
					<div className="grid gap-3">
						<span className="font-medium text-base">Model</span>
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
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refreshAiStatuses()}
					>
						<RefreshCw /> Refresh tools
					</Button>
				</div>
				<AiStatusPanel statuses={aiStatuses} />
			</div>
		</SettingsSection>
	);
}

export function SettingsDataSection() {
	return (
		<SettingsSection>
			<DataBackupPanel />
		</SettingsSection>
	);
}

export function SettingsProfileSection() {
	const {
		aiStatuses,
		patchProfile,
		profile,
		profileRecord,
		profileRevision,
		selectedTool,
	} = useCvApp();

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<ProfileManager />
				<ProfileImporter
					selectedTool={selectedTool}
					canUseAi={toolIsReady(selectedTool, aiStatuses)}
					preferredTone={profile.preferredTone}
				/>
				<ProfileEditor
					key={`profile-editor:${profileRecord?.id ?? "none"}:${profileRevision}`}
					profile={profile}
					profileRevision={profileRevision}
					onPatch={patchProfile}
				/>
			</div>
		</SettingsSection>
	);
}
