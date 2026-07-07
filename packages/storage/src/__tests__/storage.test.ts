import {
	createDefaultAppState,
	createDefaultBaseProfile,
	createDefaultTailoredCv,
	extractJobSignals,
	type GeneratedCv,
	scoreProfileAgainstJob,
} from "@cv-tailor/core";
import { describe, expect, it } from "vitest";

import { migrateAppState } from "../index";

describe("migrateAppState", () => {
	it("fills missing defaults without dropping valid generated CVs", () => {
		const profile = {
			...createDefaultBaseProfile(),
			contact: {
				name: "Ada Example",
				email: "ada@example.com",
				phone: "",
				location: "",
				links: [],
			},
			summary: "Builds frontend tools.",
		};
		const jobOffer = {
			id: "job-1",
			title: "React Engineer",
			company: "Hiring Co",
			rawText: "React and TypeScript",
			createdAt: new Date(0).toISOString(),
		};
		const signals = extractJobSignals(jobOffer.rawText);
		const generatedCv: GeneratedCv = {
			id: "generated-1",
			createdAt: new Date(0).toISOString(),
			updatedAt: new Date(0).toISOString(),
			jobOffer,
			signals,
			matchAnalysis: scoreProfileAgainstJob(profile, { ...jobOffer, signals }),
			cv: createDefaultTailoredCv(profile),
			aiTool: "claude",
		};

		const migrated = migrateAppState({
			profile,
			generatedCvs: [generatedCv],
			activeGeneratedCvId: generatedCv.id,
		});

		expect(migrated.version).toBe(1);
		expect(migrated.profile.preferredTone).toBe(
			createDefaultAppState().profile.preferredTone,
		);
		expect(migrated.generatedCvs).toHaveLength(1);
		expect(migrated.generatedCvs[0]?.id).toBe(generatedCv.id);
	});
});
