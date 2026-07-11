import {
	createDefaultAppSettings,
	createDefaultProfileRecord,
	defaultProfileId,
	normalizeCvRun,
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

	for (const application of collections.applications.values()) {
		const needsLinks = !application.jobOffer.links;
		const needsPosition = !application.jobOffer.position;
		if (needsLinks || needsPosition) {
			collections.applications.update(application.id, (draft) => {
				draft.jobOffer.links = draft.jobOffer.links ?? [];
				draft.jobOffer.position = draft.jobOffer.position ?? "unspecified";
			});
		}
	}

	for (const application of collections.applications.values()) {
		if (application.profileMatch) {
			continue;
		}

		const runs = [...collections.cvRuns.values()].filter(
			(run) => run.applicationId === application.id,
		);
		const aiRun = runs.find((run) => run.matchAnalysis.source === "ai");
		if (!aiRun) {
			continue;
		}

		const profile = collections.profiles.get(application.profileId);
		if (!profile) {
			continue;
		}

		collections.applications.update(application.id, (draft) => {
			draft.profileMatch = {
				profileId: application.profileId,
				jobRawText: application.jobOffer.rawText.trim(),
				jobReviewedAt: application.jobOffer.review?.reviewedAt,
				profileUpdatedAt: profile.updatedAt,
				matchAnalysis: normalizeCvRun(aiRun).matchAnalysis,
				evaluatedAt: aiRun.updatedAt,
			};
		});
	}

	for (const run of collections.cvRuns.values()) {
		if (Array.isArray(run.matchAnalysis.goodFit)) {
			continue;
		}

		const normalized = normalizeCvRun(run);
		collections.cvRuns.update(run.id, (draft) => {
			draft.matchAnalysis = normalized.matchAnalysis;
		});
	}

	const hasSettings = collections.settings.has("settings");
	if (hasSettings) {
		const settings = collections.settings.get("settings");
		if (settings) {
			const needsAiSettings =
				!settings.selectedAiTool ||
				!settings.aiModels?.claude ||
				!settings.aiModels?.codex ||
				!settings.aiModels?.cursor;
			if (needsAiSettings) {
				const defaults = createDefaultAppSettings(settings.activeProfileId);
				collections.settings.update("settings", (draft) => {
					draft.selectedAiTool = draft.selectedAiTool ?? defaults.selectedAiTool;
					draft.aiModels = {
						...defaults.aiModels,
						...draft.aiModels,
					};
				});
			}
		}

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
