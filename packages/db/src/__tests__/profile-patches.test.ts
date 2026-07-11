import { createDefaultProfileRecord } from "@cv-tailor/core";
import { describe, expect, it } from "vitest";

import {
	applyKnownProfilePatches,
	applyMalteGermanProfilePatch,
	MALTE_GERMAN_PROFILE_PATCH_ID,
} from "../profile-patches";

describe("profile patches", () => {
	it("updates the Malte German profile with Node.js and monorepo signals", () => {
		const profile: ReturnType<typeof createDefaultProfileRecord> = {
			...createDefaultProfileRecord(new Date(0).toISOString(), {
				id: "profile-mrcsnltz-lp02wd",
				name: "German",
				language: "de",
			}),
			summary: "Old summary",
			skills: ["TypeScript", "Next.js"],
			projects: [],
			experience: [
				{
					id: "exp-1",
					company: "Montamo GmbH",
					title: "Fullstack Software Developer",
					location: "Stuttgart / Remote",
					startDate: "2025",
					endDate: "",
					current: true,
					bullets: ["Old bullet"],
					technologies: ["Next.js"],
				},
			],
		};

		const patched = applyMalteGermanProfilePatch(profile);

		expect(patched.summary).toContain("TypeScript/Node.js");
		expect(patched.skills).toEqual(
			expect.arrayContaining(["Node.js", "Turborepo", "Jest", "Vitest"]),
		);
		expect(patched.projects).toHaveLength(2);
		const montamo = patched.experience.find((item) => item.id === "exp-1");
		expect(montamo?.technologies).toEqual(
			expect.arrayContaining(["Node.js", "Turborepo"]),
		);
		expect(montamo?.bullets[0]).toContain("Production Deployment");
	});

	it("records the patch id after applying known profile patches", () => {
		const profile = createDefaultProfileRecord(undefined, {
			id: "profile-mrcsnltz-lp02wd",
			name: "German",
		});

		const result = applyKnownProfilePatches([], [profile]);

		expect(result.appliedPatchIds).toContain(MALTE_GERMAN_PROFILE_PATCH_ID);
		expect(result.profiles[0]?.summary).toContain("TypeScript/Node.js");
	});
});
