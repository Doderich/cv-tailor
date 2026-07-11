export type SettingsStepId = "appearance" | "ai" | "data" | "profile";

export interface SettingsStepMeta {
	id: SettingsStepId;
	translationKey: string;
}

export const settingsSteps: SettingsStepMeta[] = [
	{ id: "appearance", translationKey: "settings.tab.appearance" },
	{ id: "ai", translationKey: "settings.tab.ai" },
	{ id: "data", translationKey: "settings.tab.data" },
	{ id: "profile", translationKey: "settings.tab.profile" },
];

export const defaultSettingsStep: SettingsStepId = "appearance";

export function parseSettingsStep(
	pathname: string,
): SettingsStepId | undefined {
	for (const step of settingsSteps) {
		if (
			pathname === `/settings/${step.id}` ||
			pathname.endsWith(`/${step.id}`)
		) {
			return step.id;
		}
	}

	return undefined;
}
