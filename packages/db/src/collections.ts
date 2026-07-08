import type {
	AiOutput,
	Application,
	AppSettings,
	CvRun,
	ProfileRecord,
} from "@cv-tailor/core";
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence";
import { type Collection, createCollection } from "@tanstack/db";

import { createPersistence } from "./persistence";
import { seedDefaults } from "./seed";

export const schemaVersion = 2;

export interface DbCollections {
	profiles: Collection<ProfileRecord, string>;
	applications: Collection<Application, string>;
	cvRuns: Collection<CvRun, string>;
	aiOutputs: Collection<AiOutput, string>;
	settings: Collection<AppSettings, string>;
}

export interface DbHandle extends DbCollections {
	close: () => Promise<void>;
}

export async function createDb(): Promise<DbHandle> {
	const persistence = await createPersistence();

	const profiles = createCollection(
		persistedCollectionOptions<ProfileRecord, string>({
			id: "profiles",
			getKey: (profile) => profile.id,
			persistence,
			schemaVersion,
		}),
	);

	const applications = createCollection(
		persistedCollectionOptions<Application, string>({
			id: "applications",
			getKey: (application) => application.id,
			persistence,
			schemaVersion,
		}),
	);

	const cvRuns = createCollection(
		persistedCollectionOptions<CvRun, string>({
			id: "cv-runs",
			getKey: (run) => run.id,
			persistence,
			schemaVersion,
		}),
	);

	const aiOutputs = createCollection(
		persistedCollectionOptions<AiOutput, string>({
			id: "ai-outputs",
			getKey: (output) => output.id,
			persistence,
			schemaVersion,
		}),
	);

	const settings = createCollection(
		persistedCollectionOptions<AppSettings, string>({
			id: "settings",
			getKey: (value) => value.id,
			persistence,
			schemaVersion,
		}),
	);

	await Promise.all([
		profiles.preload(),
		applications.preload(),
		cvRuns.preload(),
		aiOutputs.preload(),
		settings.preload(),
	]);

	await seedDefaults({
		profiles,
		applications,
		cvRuns,
		aiOutputs,
		settings,
	});

	return {
		profiles,
		applications,
		cvRuns,
		aiOutputs,
		settings,
		close: async () => {
			await Promise.all([
				profiles.cleanup(),
				applications.cleanup(),
				cvRuns.cleanup(),
				aiOutputs.cleanup(),
				settings.cleanup(),
			]);
		},
	};
}
