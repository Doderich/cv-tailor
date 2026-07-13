import { createDefaultProfileRecord } from "@cv-tailor/core";
import { describe, expect, it } from "vitest";

import type { DbCollections } from "../collections";
import { seedDefaults } from "../seed";

function createSeedMockCollections() {
	const profile = createDefaultProfileRecord(undefined, { name: "Ada" });
	const settings = {
		id: "settings" as const,
		schemaVersion: 2 as const,
		activeProfileId: profile.id,
		selectedAiTool: "auto",
		aiModels: {
			claude: "sonnet",
			codex: "gpt-5.4",
			cursor: "composer-2.5",
		},
	};

	const store = {
		profiles: new Map([[profile.id, profile]]),
		applications: new Map(),
		cvRuns: new Map(),
		aiOutputs: new Map(),
		settings: new Map([["settings", structuredClone(settings)]]),
	};

	const emptyCollection = {
		values: () => store.applications.values(),
		get: () => undefined,
		has: () => false,
		insert: () => ({ isPersisted: { promise: Promise.resolve() } }),
		delete: () => ({ isPersisted: { promise: Promise.resolve() } }),
		update: () => ({ isPersisted: { promise: Promise.resolve() } }),
	};

	return {
		profiles: {
			values: () => store.profiles.values(),
			get: (id: string) => store.profiles.get(id),
			has: (id: string) => store.profiles.has(id),
			insert: (item: typeof profile) => {
				store.profiles.set(item.id, structuredClone(item));
				return { isPersisted: { promise: Promise.resolve() } };
			},
			delete: (id: string) => {
				store.profiles.delete(id);
				return { isPersisted: { promise: Promise.resolve() } };
			},
			update: (
				id: string,
				updater: (draft: typeof profile) => void,
			) => {
				const current = store.profiles.get(id);
				if (!current) {
					return { isPersisted: { promise: Promise.resolve() } };
				}
				const draft = structuredClone(current);
				updater(draft);
				store.profiles.set(id, draft);
				return { isPersisted: { promise: Promise.resolve() } };
			},
		},
		applications: emptyCollection,
		cvRuns: emptyCollection,
		aiOutputs: emptyCollection,
		settings: {
			values: () => store.settings.values(),
			get: (id: string) => store.settings.get(id),
			has: (id: string) => store.settings.has(id),
			insert: (item: typeof settings) => {
				store.settings.set(item.id, structuredClone(item));
				return { isPersisted: { promise: Promise.resolve() } };
			},
			delete: (id: string) => {
				store.settings.delete(id);
				return { isPersisted: { promise: Promise.resolve() } };
			},
			update: (
				id: string,
				updater: (draft: typeof settings) => void,
			) => {
				const current = store.settings.get(id);
				if (!current) {
					return { isPersisted: { promise: Promise.resolve() } };
				}
				const draft = structuredClone(current);
				updater(draft);
				store.settings.set(id, draft);
				return { isPersisted: { promise: Promise.resolve() } };
			},
		},
	} as unknown as DbCollections;
}

describe("seedDefaults", () => {
	it("migrates legacy v2 settings without touching draft proxies", async () => {
		const collections = createSeedMockCollections();

		await seedDefaults(collections);

		const migrated = collections.settings.get("settings");
		expect(migrated?.schemaVersion).toBe(3);
		expect(migrated?.selectedAiProvider).toBe("claude");
		expect(migrated?.lmStudio?.baseUrl).toBe("http://localhost:1234");
		expect(migrated?.selectedAiTool).toBeUndefined();
	});
});
