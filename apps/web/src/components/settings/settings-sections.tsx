import type { AiProviderId, CliProviderId } from "@cv-tailor/ai";
import { Button } from "@cv-tailor/ui/components/button";
import { Checkbox } from "@cv-tailor/ui/components/checkbox";
import { Input } from "@cv-tailor/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { cn } from "@cv-tailor/ui/lib/utils";
import { interactiveSegment } from "@cv-tailor/ui/lib/interactive-styles";
import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AiStatusPanel } from "@/components/cv/insights";
import { CvTemplatePicker } from "@/components/cv/cv-template-picker";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { ProfileManager } from "@/components/cv/profile-manager";
import { DataBackupPanel } from "@/components/data-backup-panel";
import { DesktopUpdatesPanel } from "@/components/desktop-updates-panel";
import { FontPicker } from "@/components/font-picker";
import { LanguagePicker } from "@/components/language-picker";
import { PalettePicker } from "@/components/palette-picker";
import { type TextSizeId, useTextSize } from "@/components/text-size-provider";
import { useTheme } from "@/components/theme-provider";
import {
	claudeModelOptions,
	codexModelOptions,
	cursorModelOptions,
	providerIsReady,
	useCvApp,
} from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

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
const segmentedButtonClass = `rounded-sm px-2.5 py-1 font-medium text-sm ${interactiveSegment}`;

const providerOptionIds: AiProviderId[] = [
	"claude",
	"codex",
	"cursor",
	"lmstudio",
];
const cliProviderIds: CliProviderId[] = ["claude", "codex", "cursor"];

function AiToolPathFields() {
	const { t } = useTranslation();
	const { aiToolPaths, setAiToolPath, suggestAndApplyAiToolPaths } = useCvApp();

	return (
		<div className="grid gap-3">
			<div className="grid gap-1">
				<span className="font-medium text-base">
					{t("settings.ai.toolPaths")}
				</span>
				<p className="text-muted-foreground text-sm">
					{t("settings.ai.toolPathsHelp")}
				</p>
			</div>
			{cliProviderIds.map((provider) => (
				<label key={provider} className="grid gap-1.5">
					<span className="font-medium text-sm">
						{t(`settings.ai.tool.${provider}`)}
					</span>
					<Input
						value={aiToolPaths[provider] ?? ""}
						onChange={(event) => setAiToolPath(provider, event.target.value)}
						placeholder={t(`settings.ai.pathPlaceholder.${provider}`)}
						className="font-mono text-sm"
					/>
				</label>
			))}
			<div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void suggestAndApplyAiToolPaths()}
				>
					<RefreshCw /> {t("settings.ai.autoDetectPaths")}
				</Button>
			</div>
		</div>
	);
}

function LmStudioFields() {
	const { t } = useTranslation();
	const {
		lmStudio,
		lmStudioModels,
		refreshLmStudioModels,
		setLmStudioApiKey,
		setLmStudioBaseUrl,
		setLmStudioEnableReasoning,
		setLmStudioModel,
	} = useCvApp();

	return (
		<div className="grid gap-3">
			<div className="grid gap-1">
				<span className="font-medium text-base">
					{t("settings.ai.sections.apiProviders")}
				</span>
				<p className="text-muted-foreground text-sm">
					{t("settings.ai.lmStudio.help")}
				</p>
			</div>
			<label className="grid gap-1.5">
				<span className="font-medium text-sm">
					{t("settings.ai.lmStudio.baseUrl")}
				</span>
				<Input
					value={lmStudio.baseUrl}
					onChange={(event) => setLmStudioBaseUrl(event.target.value)}
					placeholder="http://localhost:1234"
					className="font-mono text-sm"
				/>
			</label>
			<label className="grid gap-1.5">
				<span className="font-medium text-sm">
					{t("settings.ai.lmStudio.apiKey")}
				</span>
				<Input
					type="password"
					value={lmStudio.apiKey ?? ""}
					onChange={(event) => setLmStudioApiKey(event.target.value)}
					placeholder={t("settings.ai.lmStudio.apiKeyPlaceholder")}
					className="font-mono text-sm"
				/>
			</label>
			<div className="grid gap-1.5">
				<span className="font-medium text-sm">
					{t("settings.ai.lmStudio.model")}
				</span>
				<div className="flex flex-wrap items-center gap-2">
					<Select
						value={lmStudio.model ?? ""}
						onValueChange={(value) => {
							if (value) {
								setLmStudioModel(value);
							}
						}}
					>
						<SelectTrigger className="max-w-md" size="sm">
							<SelectValue
								placeholder={t("settings.ai.lmStudio.modelPlaceholder")}
							>
								{lmStudio.model ?? t("settings.ai.lmStudio.modelPlaceholder")}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{lmStudioModels.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refreshLmStudioModels()}
					>
						<RefreshCw /> {t("settings.ai.lmStudio.refreshModels")}
					</Button>
				</div>
			</div>
			<label className="flex items-start gap-3">
				<Checkbox
					checked={lmStudio.enableReasoning ?? true}
					onCheckedChange={(checked) =>
						setLmStudioEnableReasoning(checked === true)
					}
					className="mt-0.5"
				/>
				<span className="grid gap-1">
					<span className="font-medium text-sm">
						{t("settings.ai.lmStudio.enableReasoning")}
					</span>
					<span className="text-muted-foreground text-sm">
						{t("settings.ai.lmStudio.enableReasoningHelp")}
					</span>
				</span>
			</label>
		</div>
	);
}

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
				<SelectValue placeholder={t("settings.appearance.selectTextSize")}>
					{t(`settings.textSize.${textSize}`)}
				</SelectValue>
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
	const { cvTemplate, setCvTemplate } = useCvApp();

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.mode")}
					</span>
					<ThemeToggleGroup />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.language")}
					</span>
					<LanguagePicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.textSize")}
					</span>
					<TextSizeSelect />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.typeface")}
					</span>
					<FontPicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.palette")}
					</span>
					<PalettePicker />
				</div>
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.appearance.cvTemplate")}
					</span>
					<p className="text-muted-foreground text-sm">
						{t("settings.appearance.cvTemplateHelp")}
					</p>
					<CvTemplatePicker value={cvTemplate} onChange={setCvTemplate} />
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
		lmStudio,
		refreshAiStatuses,
		selectedProvider,
		setAiModel,
		setSelectedProvider,
	} = useCvApp();

	const isCliProvider =
		selectedProvider === "claude" ||
		selectedProvider === "codex" ||
		selectedProvider === "cursor";
	const modelOptions =
		selectedProvider === "codex"
			? codexModelOptions
			: selectedProvider === "cursor"
				? cursorModelOptions
				: claudeModelOptions;
	const activeModel = isCliProvider ? aiModels[selectedProvider] : lmStudio.model;

	const providerOptions = providerOptionIds.map((id) => ({
		id,
		label: t(`settings.ai.provider.${id}`),
	}));

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<div className="grid gap-3">
					<span className="font-medium text-base">
						{t("settings.ai.activeProvider")}
					</span>
					<SegmentedControl
						options={providerOptions}
						value={selectedProvider}
						onChange={setSelectedProvider}
					/>
				</div>
				{isCliProvider ? (
					<div className="grid gap-4 rounded-xl border p-4">
						<div className="grid gap-3">
							<span className="font-medium text-base">
								{t("settings.ai.sections.cliTools")}
							</span>
							<span className="font-medium text-base">
								{t("settings.ai.model")}
							</span>
							<SegmentedControl
								options={modelOptions}
								value={activeModel ?? modelOptions[0]?.id ?? ""}
								onChange={(model) => setAiModel(selectedProvider, model)}
							/>
						</div>
						<AiToolPathFields />
					</div>
				) : (
					<div className="rounded-xl border p-4">
						<LmStudioFields />
					</div>
				)}
				<div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refreshAiStatuses()}
					>
						<RefreshCw /> {t("settings.ai.refreshTools")}
					</Button>
				</div>
				<AiStatusPanel
					statuses={aiStatuses}
					selectedProvider={effectiveAiProvider ?? selectedProvider}
				/>
			</div>
		</SettingsSection>
	);
}

export function SettingsDataSection() {
	const isDesktop = isTauriRuntime();

	return (
		<SettingsSection>
			<div className="grid gap-6">
				{isDesktop ? <DesktopUpdatesPanel /> : null}
				<DataBackupPanel />
			</div>
		</SettingsSection>
	);
}

export function SettingsProfileSection() {
	const {
		aiStatuses,
		lmStudio,
		patchProfile,
		profile,
		profileRecord,
		profileRevision,
		selectedProvider,
	} = useCvApp();

	return (
		<SettingsSection>
			<div className="grid gap-4">
				<ProfileManager />
				<ProfileImporter
					canUseAi={providerIsReady(selectedProvider, aiStatuses, lmStudio)}
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
