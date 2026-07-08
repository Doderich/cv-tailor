import {
	createDefaultAppSettings,
	createDefaultProfileRecord,
	defaultProfileId,
	normalizeProfileRecord,
} from "@cv-tailor/core";

import type { DbCollections } from "./collections";

export async function seedDefaults(collections: DbCollections) {
	for (const profile of collections.profiles.values()) {
		const normalized = normalizeProfileRecord(profile);
		const needsUpdate =
			profile.language !== normalized.language ||
			profile.experience !== normalized.experience ||
			profile.projects !== normalized.projects ||
			profile.education !== normalized.education;
		if (needsUpdate) {
			collections.profiles.update(profile.id, (draft) => {
				Object.assign(draft, normalized);
			});
		}
	}

	const hasSettings = collections.settings.has("settings");
	if (hasSettings) {
		const settings = collections.settings.get("settings");
		if (
			settings &&
			!collections.profiles.has(settings.activeProfileId) &&
			collections.profiles.size === 0
		) {
			const profile = createDefaultProfileRecord();
			collections.profiles.insert(profile);
			collections.settings.update("settings", (draft) => {
				draft.activeProfileId = profile.id;
			});
		}
		return;
	}

	const profile = createDefaultProfileRecord();
	collections.profiles.insert(profile);
	collections.settings.insert(createDefaultAppSettings(defaultProfileId));
}
