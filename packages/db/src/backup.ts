import {
	type AppSettings,
	type Application,
	type CvRun,
	type ProfileRecord,
	aiOutputSchema,
	applicationSchema,
	appSettingsSchema,
	cvRunSchema,
	type LegacyAppSettings,
	mergeApplicationForImport,
	mergeSettingsPreservingSecrets,
	migrateAppSettings,
	normalizeApplication,
	normalizeProfileRecord,
	profileRecordSchema,
	redactSettingsForBackup,
} from "@cv-tailor/core";
import { z } from "zod";

import type { DbCollections } from "./collections";
import { schemaVersion } from "./collections";

export const CV_TAILOR_BACKUP_VERSION = 1;

export const cvTailorBackupSchema = z.object({
	formatVersion: z.literal(CV_TAILOR_BACKUP_VERSION),
	exportedAt: z.string(),
	schemaVersion: z.number(),
	profiles: z.array(profileRecordSchema),
	applications: z.array(applicationSchema),
	cvRuns: z.array(cvRunSchema),
	aiOutputs: z.array(aiOutputSchema),
	settings: z.preprocess(
		(value) => migrateAppSettings(value as LegacyAppSettings),
		appSettingsSchema,
	),
});

export type CvTailorBackup = z.infer<typeof cvTailorBackupSchema>;
export type BackupImportMode = "replace" | "merge";

export function createBackupSnapshot(
	collections: DbCollections,
): CvTailorBackup {
	const settings = collections.settings.get("settings");
	if (!settings) {
		throw new Error("Settings record is missing.");
	}

	return cvTailorBackupSchema.parse({
		formatVersion: CV_TAILOR_BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		schemaVersion,
		profiles: [...collections.profiles.values()].map((profile) =>
			normalizeProfileRecord(profile),
		),
		applications: [...collections.applications.values()].map((application) =>
			normalizeApplication(application),
		),
		cvRuns: [...collections.cvRuns.values()],
		aiOutputs: [...collections.aiOutputs.values()],
		settings: redactSettingsForBackup(settings),
	});
}

export function parseBackupFile(content: string): CvTailorBackup {
	const parsed = JSON.parse(content) as unknown;
	return cvTailorBackupSchema.parse(parsed);
}

function validateBackupReferences(backup: CvTailorBackup) {
	const profileIds = new Set(backup.profiles.map((profile) => profile.id));
	const applicationIds = new Set(
		backup.applications.map((application) => application.id),
	);
	const runIds = new Set(backup.cvRuns.map((run) => run.id));

	for (const application of backup.applications) {
		if (!profileIds.has(application.profileId)) {
			throw new Error(
				`Application "${application.id}" references missing profile "${application.profileId}".`,
			);
		}
	}

	for (const run of backup.cvRuns) {
		if (!applicationIds.has(run.applicationId)) {
			throw new Error(
				`CV run "${run.id}" references missing application "${run.applicationId}".`,
			);
		}
		if (!profileIds.has(run.profileId)) {
			throw new Error(
				`CV run "${run.id}" references missing profile "${run.profileId}".`,
			);
		}
	}

	for (const output of backup.aiOutputs) {
		if (!runIds.has(output.cvRunId)) {
			throw new Error(
				`AI output "${output.id}" references missing CV run "${output.cvRunId}".`,
			);
		}
	}

	if (!profileIds.has(backup.settings.activeProfileId)) {
		throw new Error(
			`Settings reference missing active profile "${backup.settings.activeProfileId}".`,
		);
	}

	if (
		backup.settings.activeApplicationId &&
		!applicationIds.has(backup.settings.activeApplicationId)
	) {
		throw new Error(
			`Settings reference missing active application "${backup.settings.activeApplicationId}".`,
		);
	}

	if (backup.settings.activeRunId && !runIds.has(backup.settings.activeRunId)) {
		throw new Error(
			`Settings reference missing active CV run "${backup.settings.activeRunId}".`,
		);
	}
}

async function awaitPersisted(transaction: {
	isPersisted: { promise: Promise<unknown> };
}) {
	await transaction.isPersisted.promise;
}

async function clearAllData(collections: DbCollections) {
	for (const output of collections.aiOutputs.values()) {
		await awaitPersisted(collections.aiOutputs.delete(output.id));
	}
	for (const run of collections.cvRuns.values()) {
		await awaitPersisted(collections.cvRuns.delete(run.id));
	}
	for (const application of collections.applications.values()) {
		await awaitPersisted(collections.applications.delete(application.id));
	}
	for (const profile of collections.profiles.values()) {
		await awaitPersisted(collections.profiles.delete(profile.id));
	}
	if (collections.settings.has("settings")) {
		await awaitPersisted(collections.settings.delete("settings"));
	}
}

function isNewerTimestamp(incoming: string, existing: string) {
	return Date.parse(incoming) >= Date.parse(existing);
}

async function replaceCollectionRecord<T extends { id: string }>(
	collection: {
		delete: (id: string) => { isPersisted: { promise: Promise<unknown> } };
		insert: (item: T) => { isPersisted: { promise: Promise<unknown> } };
	},
	item: T,
) {
	await awaitPersisted(collection.delete(item.id));
	await awaitPersisted(collection.insert(item));
}

async function insertBackupData(
	collections: DbCollections,
	backup: CvTailorBackup,
	settings: AppSettings,
) {
	for (const profile of backup.profiles) {
		await awaitPersisted(
			collections.profiles.insert(normalizeProfileRecord(profile)),
		);
	}
	for (const application of backup.applications) {
		await awaitPersisted(
			collections.applications.insert(normalizeApplication(application)),
		);
	}
	for (const run of backup.cvRuns) {
		await awaitPersisted(collections.cvRuns.insert(run));
	}
	for (const output of backup.aiOutputs) {
		await awaitPersisted(collections.aiOutputs.insert(output));
	}
	await awaitPersisted(collections.settings.insert(settings));
}

function profileContentScore(profile: ProfileRecord) {
	return (
		profile.skills.length +
		profile.experience.length +
		profile.projects.length +
		profile.education.length +
		profile.achievements.length +
		(profile.summary.trim() ? 1 : 0) +
		(profile.contact.name.trim() ? 1 : 0)
	);
}

async function mergeProfileRecord(
	collections: DbCollections,
	incoming: ProfileRecord,
) {
	const normalized = normalizeProfileRecord(incoming);
	const existing = collections.profiles.get(normalized.id);
	if (!existing) {
		await awaitPersisted(collections.profiles.insert(normalized));
		return;
	}
	const existingNormalized = normalizeProfileRecord(existing);
	const incomingIsNewer = isNewerTimestamp(
		normalized.updatedAt,
		existingNormalized.updatedAt,
	);
	const incomingIsRicher =
		profileContentScore(normalized) > profileContentScore(existingNormalized);
	if (!incomingIsNewer && !incomingIsRicher) {
		return;
	}
	await replaceCollectionRecord(collections.profiles, normalized);
}

async function mergeApplicationRecord(
	collections: DbCollections,
	incoming: Application,
) {
	const existing = collections.applications.get(incoming.id);
	if (!existing) {
		await awaitPersisted(
			collections.applications.insert(normalizeApplication(incoming)),
		);
		return;
	}
	const merged = mergeApplicationForImport(existing, incoming);
	await replaceCollectionRecord(collections.applications, merged);
}

async function mergeCvRunRecord(collections: DbCollections, incoming: CvRun) {
	const existing = collections.cvRuns.get(incoming.id);
	if (!existing) {
		await awaitPersisted(collections.cvRuns.insert(incoming));
		return;
	}
	if (!isNewerTimestamp(incoming.updatedAt, existing.updatedAt)) {
		return;
	}
	await replaceCollectionRecord(collections.cvRuns, incoming);
}

export async function importBackup(
	collections: DbCollections,
	backup: CvTailorBackup,
	mode: BackupImportMode,
) {
	validateBackupReferences(backup);

	if (mode === "replace") {
		const existingSettings = collections.settings.get("settings");
		const settings = mergeSettingsPreservingSecrets(
			backup.settings,
			existingSettings,
		);
		await clearAllData(collections);
		await insertBackupData(collections, backup, settings);
		return;
	}

	for (const profile of backup.profiles) {
		await mergeProfileRecord(collections, profile);
	}

	for (const application of backup.applications) {
		await mergeApplicationRecord(collections, application);
	}

	for (const run of backup.cvRuns) {
		await mergeCvRunRecord(collections, run);
	}

	for (const output of backup.aiOutputs) {
		if (collections.aiOutputs.has(output.id)) {
			continue;
		}
		await awaitPersisted(collections.aiOutputs.insert(output));
	}
}

export function summarizeBackup(backup: CvTailorBackup) {
	return {
		exportedAt: backup.exportedAt,
		profiles: backup.profiles.length,
		applications: backup.applications.length,
		cvRuns: backup.cvRuns.length,
		aiOutputs: backup.aiOutputs.length,
	};
}
