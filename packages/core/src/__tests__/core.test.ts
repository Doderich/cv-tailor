import { describe, expect, it } from "vitest";

import {
	type BaseProfile,
	createDefaultBaseProfile,
	extractJobSignals,
	type JobOffer,
	scoreProfileAgainstJob,
} from "../index";

function profileWith(values: Partial<BaseProfile>): BaseProfile {
	return {
		...createDefaultBaseProfile(),
		...values,
	};
}

describe("extractJobSignals", () => {
	it("handles empty input", () => {
		expect(extractJobSignals("")).toEqual({
			keywords: [],
			requirements: [],
			responsibilities: [],
			seniority: "unspecified",
			technologies: [],
			softSkills: [],
		});
	});

	it("extracts headings, bullet requirements, seniority, and technologies", () => {
		const signals = extractJobSignals(`
      Senior Frontend Engineer

      Requirements
      - Must have React and TypeScript experience
      - Experience with accessibility and stakeholder management

      Responsibilities
      - You will own the design system and mentor engineers
      - Build reliable UI with GraphQL APIs
    `);

		expect(signals.seniority).toBe("senior");
		expect(signals.technologies).toEqual(
			expect.arrayContaining(["react", "typescript", "graphql"]),
		);
		expect(signals.softSkills).toEqual(
			expect.arrayContaining(["mentoring", "stakeholder management"]),
		);
		expect(signals.requirements).toContain(
			"Must have React and TypeScript experience",
		);
		expect(signals.responsibilities).toEqual(
			expect.arrayContaining([
				"You will own the design system and mentor engineers",
				"Build reliable UI with GraphQL APIs",
			]),
		);
	});
});

describe("scoreProfileAgainstJob", () => {
	it("matches keywords case-insensitively and ignores common stopwords", () => {
		const profile = profileWith({
			headline: "Frontend Engineer",
			skills: ["React", "TypeScript", "Accessibility"],
			experience: [
				{
					id: "exp-1",
					company: "Example Co",
					title: "Frontend Engineer",
					location: "Remote",
					startDate: "2021",
					endDate: "",
					current: true,
					bullets: [
						"Built design systems with React and improved accessibility.",
					],
					technologies: ["React", "TypeScript"],
				},
			],
		});
		const job: JobOffer = {
			id: "job-1",
			title: "Senior React Engineer",
			company: "Hiring Co",
			rawText: "We need React, TypeScript, and accessibility experience.",
			createdAt: new Date(0).toISOString(),
			signals: extractJobSignals(
				"We need React, TypeScript, and accessibility experience.",
			),
		};

		const analysis = scoreProfileAgainstJob(profile, job);

		expect(analysis.matchedKeywords).toEqual(
			expect.arrayContaining(["react", "typescript"]),
		);
		expect(analysis.missingKeywords).not.toContain("and");
		expect(analysis.score).toBeGreaterThan(50);
	});
});
