export type SettingsStepId = "appearance" | "ai" | "data" | "profile";

export interface SettingsStepMeta {
	id: SettingsStepId;
	label: string;
}

export const settingsSteps: SettingsStepMeta[] = [
	{ id: "appearance", label: "Appearance" },
	{ id: "ai", label: "AI" },
	{ id: "data", label: "Data" },
	{ id: "profile", label: "Profile" },
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
