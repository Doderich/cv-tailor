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
import { useTranslation } from "react-i18next";

import { DataBackupPanel } from "@/components/data-backup-panel";
import { AiStatusPanel } from "@/components/cv/insights";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { ProfileManager } from "@/components/cv/profile-manager";
import { FontPicker } from "@/components/font-picker";
import { LanguagePicker } from "@/components/language-picker";
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

const themeOptionIds = ["light", "dark", "system"] as const;
const themeIcons = {
	light: Sun,
	dark: Moon,
	system: Monitor,
} as const;

function ThemeToggleGroup() {
	const { t } = useTranslation();
	const { theme, setTheme } = useTheme();

	return (
		<div className={segmentedContainerClass}>
			{themeOptionIds.map((optionId) => {
				const Icon = themeIcons[optionId];
				const active = theme === optionId;
				return (
					<button
						key={optionId}
						type="button"
						onClick={() => setTheme(optionId)}
						className={cn(
							"inline-flex items-center gap-1.5",
							segmentedButtonClass,
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						<Icon className="size-3.5" />
						{t(`settings.theme.${optionId}`)}
					</button>
				);
			})}
		</div>
	);
}

const segmentedContainerClass =
	"inline-flex w-fit rounded-md border bg-card p-0.5";
const segmentedButtonClass =
	"rounded-sm px-2.5 py-1 text-sm font-medium transition-colors";

const toolOptionIds: AiToolId[] = ["auto", "claude", "codex", "cursor"];

function TextSizeSelect() {
	const { t } = useTranslation();
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
				<SelectValue placeholder={t("settings.appearance.selectTextSize")} />
			</SelectTrigger>
			<SelectContent>
				{textSizeOptions.map((option) => (
					<SelectItem key={option.id} value={option.id}>
						{t(`settings.textSize.${option.id}`)}
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
	const { t } = useTranslation();

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.appearance.mode")}</span>
					<ThemeToggleGroup />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.appearance.language")}</span>
					<LanguagePicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.appearance.textSize")}</span>
					<TextSizeSelect />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.appearance.typeface")}</span>
					<FontPicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.appearance.palette")}</span>
					<PalettePicker />
				</div>
			</div>
		</SettingsSection>
	);
}

export function SettingsAiSection() {
	const { t } = useTranslation();
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

	const toolOptions = toolOptionIds.map((id) => ({
		id,
		label: t(`settings.ai.tool.${id}`),
	}));

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">{t("settings.ai.preferredTool")}</span>
					<SegmentedControl
						options={toolOptions}
						value={selectedTool}
						onChange={setSelectedTool}
					/>
				</div>
				{effectiveAiProvider ? (
					<div className="grid gap-3">
						<span className="font-medium text-base">{t("settings.ai.model")}</span>
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
						<RefreshCw /> {t("settings.ai.refreshTools")}
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
