import type { SettingsStepId } from "@/lib/settings-steps";
import { defaultSettingsStep } from "@/lib/settings-steps";

export function settingsStepPath(step: SettingsStepId = defaultSettingsStep) {
	return {
		to: `/settings/${step}` as const,
	};
}
