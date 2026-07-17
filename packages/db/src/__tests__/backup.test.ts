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

	it("merges records without dropping local-only profiles", async () => {
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

	it("merges AI histories into an existing application with the same id", async () => {
		const profile = createDefaultProfileRecord(undefined, {
			id: "profile-shared",
			name: "Shared",
		});
		const { application: sharedApp, draftRun } = createEmptyApplication({
			id: "app-shared",
			profileId: profile.id,
			profile,
		});
		const source = createMockCollections({ profiles: [profile] });
		const target = createMockCollections({ profiles: [profile] });

		for (const app of [...source.applications.values()]) {
			source.applications.delete(app.id);
		}
		for (const run of [...source.cvRuns.values()]) {
			source.cvRuns.delete(run.id);
		}
		for (const app of [...target.applications.values()]) {
			target.applications.delete(app.id);
		}
		for (const run of [...target.cvRuns.values()]) {
			target.cvRuns.delete(run.id);
		}

		target.applications.insert(sharedApp);
		target.cvRuns.insert(draftRun);
		source.cvRuns.insert(draftRun);

		const reviewedAt = "2026-07-17T10:00:00.000Z";
		const review = {
			signals: {
				keywords: ["react"],
				requirements: ["TypeScript"],
				responsibilities: ["Build UI"],
				seniority: "mid" as const,
				technologies: ["React"],
				softSkills: ["Communication"],
			},
			summary: "Frontend role",
			rawText: "We need React",
			reviewedAt,
			reviewTool: "claude",
			stdout: "review-stdout",
		};

		source.applications.insert({
			...sharedApp,
			updatedAt: "2026-07-17T12:00:00.000Z",
			jobOffer: {
				...sharedApp.jobOffer,
				rawText: "We need React",
				review,
				signals: review.signals,
			},
			reviewHistory: [
				{
					...review,
					id: "review-web-1",
					label: "Review v1",
				},
			],
			activeReviewId: "review-web-1",
			matchHistory: [
				{
					id: "match-web-1",
					label: "Match v1",
					profileId: profile.id,
					jobRawText: "We need React",
					jobReviewedAt: reviewedAt,
					profileUpdatedAt: profile.updatedAt,
					evaluatedAt: "2026-07-17T11:00:00.000Z",
					matchAnalysis: {
						score: 82,
						matchedKeywords: ["react"],
						missingKeywords: [],
						missingRequirements: [],
						goodFit: ["React"],
						warnings: [],
						source: "ai",
						evaluatorTool: "claude",
					},
				},
			],
			activeMatchId: "match-web-1",
			profileMatch: {
				profileId: profile.id,
				jobRawText: "We need React",
				jobReviewedAt: reviewedAt,
				profileUpdatedAt: profile.updatedAt,
				evaluatedAt: "2026-07-17T11:00:00.000Z",
				matchAnalysis: {
					score: 82,
					matchedKeywords: ["react"],
					missingKeywords: [],
					missingRequirements: [],
					goodFit: ["React"],
					warnings: [],
					source: "ai",
					evaluatorTool: "claude",
				},
			},
		});

		const backup = createBackupSnapshot(source);
		await importBackup(target, backup, "merge");

		const merged = target.applications.get(sharedApp.id);
		expect(merged?.reviewHistory.map((entry) => entry.id)).toContain(
			"review-web-1",
		);
		expect(merged?.matchHistory.map((entry) => entry.id)).toContain(
			"match-web-1",
		);
		expect(merged?.jobOffer.review?.reviewTool).toBe("claude");
		expect(merged?.profileMatch?.matchAnalysis.score).toBe(82);
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
