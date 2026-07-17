import {
	createDefaultAppSettings,
	createDefaultProfileRecord,
	createEmptyApplication,
} from "@cv-tailor/core";
import { describe, expect, it } from "vitest";

import { createBackupSnapshot, importBackup, parseBackupFile } from "../backup";
import type { DbCollections } from "../collections";

function createMockCollections(seed?: {
	profiles?: ReturnType<typeof createDefaultProfileRecord>[];
}): DbCollections {
	const store = {
		profiles: new Map<string, ReturnType<typeof createDefaultProfileRecord>>(),
		applications: new Map<
			string,
			ReturnType<typeof createEmptyApplication>["application"]
		>(),
		cvRuns: new Map<
			string,
			ReturnType<typeof createEmptyApplication>["draftRun"]
		>(),
		aiOutputs: new Map<
			string,
			{ id: string; cvRunId: string; stdout: string }
		>(),
		settings: new Map<string, ReturnType<typeof createDefaultAppSettings>>(),
	};

	const profile =
		seed?.profiles?.[0] ??
		createDefaultProfileRecord(undefined, { name: "Ada" });
	store.profiles.set(profile.id, profile);
	store.settings.set("settings", createDefaultAppSettings(profile.id));

	const { application, draftRun } = createEmptyApplication({
		id: "app-1",
		profileId: profile.id,
		profile,
	});
	store.applications.set(application.id, application);
	store.cvRuns.set(draftRun.id, draftRun);

	function makeCollection<T extends { id: string }>(
		map: Map<string, T>,
	): DbCollections["profiles"] {
		return {
			values: () => map.values(),
			get: (id: string) => map.get(id),
			has: (id: string) => map.has(id),
			insert: (item: T) => {
				map.set(item.id, structuredClone(item));
				return { isPersisted: { promise: Promise.resolve() } };
			},
			delete: (id: string) => {
				map.delete(id);
				return { isPersisted: { promise: Promise.resolve() } };
			},
		} as DbCollections["profiles"];
	}

	const settingsCollection = {
		values: () => store.settings.values(),
		get: (id: string) => store.settings.get(id),
		has: (id: string) => store.settings.has(id),
		insert: (item: ReturnType<typeof createDefaultAppSettings>) => {
			store.settings.set(item.id, structuredClone(item));
			return { isPersisted: { promise: Promise.resolve() } };
		},
		delete: (id: string) => {
			store.settings.delete(id);
			return { isPersisted: { promise: Promise.resolve() } };
		},
	} as DbCollections["settings"];

	return {
		profiles: makeCollection(
			store.profiles,
		) as unknown as DbCollections["profiles"],
		applications: makeCollection(
			store.applications,
		) as unknown as DbCollections["applications"],
		cvRuns: makeCollection(store.cvRuns) as unknown as DbCollections["cvRuns"],
		aiOutputs: makeCollection(
			store.aiOutputs,
		) as unknown as DbCollections["aiOutputs"],
		settings: settingsCollection as unknown as DbCollections["settings"],
	};
}

describe("backup", () => {
	it("round-trips all collections through export and replace import", async () => {
		const source = createMockCollections();
		const backup = createBackupSnapshot(source);
		const json = JSON.stringify(backup);
		const parsed = parseBackupFile(json);

		expect(parsed.profiles).toHaveLength(1);
		expect(parsed.applications).toHaveLength(1);
		expect(parsed.cvRuns).toHaveLength(1);

		const target = createMockCollections({
			profiles: [createDefaultProfileRecord(undefined, { name: "Other" })],
		});
		await importBackup(target, parsed, "replace");

		expect([...target.profiles.values()]).toHaveLength(1);
		expect([...target.profiles.values()][0]?.name).toBe("Ada");
		expect([...target.applications.values()]).toHaveLength(1);
		expect([...target.cvRuns.values()]).toHaveLength(1);
	});

	it("merges records without overwriting existing ids", async () => {
		const sourceProfile = createDefaultProfileRecord(undefined, {
			id: "profile-import",
			name: "Imported",
		});
		const source = createMockCollections({ profiles: [sourceProfile] });
		const backup = createBackupSnapshot(source);
		const target = createMockCollections();
		const existingProfileId = [...target.profiles.values()][0]?.id;

		await importBackup(target, backup, "merge");

		expect(target.profiles.has(existingProfileId ?? "")).toBe(true);
		expect(target.profiles.has("profile-import")).toBe(true);
		expect([...target.profiles.values()]).toHaveLength(2);
	});

	it("redacts cloud backup secrets from exported snapshots", () => {
		const source = createMockCollections();
		const settings = source.settings.get("settings");
		if (!settings) {
			throw new Error("missing settings");
		}
		source.settings.insert({
			...settings,
			cloudBackup: {
				endpoint: "http://192.168.188.50:9000",
				region: "us-east-1",
				bucket: "cv-tailor-backups",
				accessKeyId: "cvtailor",
				secretAccessKey: "super-secret",
				prefix: "cv-tailor/",
			},
			lmStudio: {
				baseUrl: "http://localhost:1234",
				apiKey: "lm-secret",
				enableReasoning: true,
			},
		});

		const backup = createBackupSnapshot(source);
		expect(backup.settings.cloudBackup?.secretAccessKey).toBeUndefined();
		expect(backup.settings.cloudBackup?.accessKeyId).toBe("cvtailor");
		expect(backup.settings.lmStudio?.apiKey).toBeUndefined();
	});

	it("keeps local cloud secrets when replacing from a redacted backup", async () => {
		const source = createMockCollections();
		const backup = createBackupSnapshot(source);
		const target = createMockCollections();
		const existing = target.settings.get("settings");
		if (!existing) {
			throw new Error("missing settings");
		}
		target.settings.insert({
			...existing,
			cloudBackup: {
				endpoint: "http://192.168.188.50:9000",
				region: "us-east-1",
				bucket: "cv-tailor-backups",
				accessKeyId: "cvtailor",
				secretAccessKey: "keep-me",
				prefix: "cv-tailor/",
			},
		});

		await importBackup(target, backup, "replace");
		expect(target.settings.get("settings")?.cloudBackup?.secretAccessKey).toBe(
			"keep-me",
		);
	});
});
