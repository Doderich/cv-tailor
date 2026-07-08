import {
	createDefaultAppSettings,
	createDefaultProfileRecord,
	defaultProfileId,
} from "@cv-tailor/core";

import type { DbCollections } from "./collections";

export async function seedDefaults(collections: DbCollections) {
	const hasSettings = collections.settings.has("settings");
	if (hasSettings) {
		return;
	}

	const profile = createDefaultProfileRecord();
	collections.profiles.insert(profile);
	collections.settings.insert(createDefaultAppSettings(defaultProfileId));
}
