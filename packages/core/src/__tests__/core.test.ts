import { describe, expect, it } from "vitest";

import {
	type BaseProfile,
	createDefaultAppSettings,
	createDefaultBaseProfile,
	extractJobSignals,
	hasMeaningfulProfileContent,
	isUsableJobReviewSummary,
	type JobOffer,
	jobOfferNeedsReview,
	migrateAppSettings,
	normalizeMatchAnalysis,
	profilesHaveSameContent,
	resolveJobSignals,
	scoreProfileAgainstJob,
	summarizeProfileContent,
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

describe("job posting review helpers", () => {
	const baseJob: JobOffer = {
		id: "job-1",
		title: "Backend Engineer",
		company: "Example Co",
		position: "backend",
		links: [],
		rawText: "Wir suchen Node.js und PostgreSQL Erfahrung.",
		createdAt: new Date(0).toISOString(),
	};

	it("prefers saved AI review signals when raw text matches", () => {
		const reviewSignals = {
			keywords: ["nodejs", "postgresql"],
			requirements: ["Node.js experience"],
			responsibilities: ["Build APIs"],
			seniority: "mid" as const,
			technologies: ["nodejs", "postgresql"],
			softSkills: [],
		};
		const job: JobOffer = {
			...baseJob,
			review: {
				signals: reviewSignals,
				summary: "Backend role focused on Node.js.",
				rawText: baseJob.rawText,
				reviewedAt: new Date(0).toISOString(),
				reviewTool: "claude",
			},
		};

		expect(resolveJobSignals(job)).toEqual(reviewSignals);
	});

	it("detects when a posting still needs review", () => {
		expect(jobOfferNeedsReview(baseJob)).toBe(true);
		expect(
			jobOfferNeedsReview({
				...baseJob,
				review: {
					signals: extractJobSignals(baseJob.rawText),
					summary:
						"Backend role focused on Node.js APIs and PostgreSQL data modeling.",
					rawText: baseJob.rawText,
					reviewedAt: new Date(0).toISOString(),
					reviewTool: "claude",
				},
			}),
		).toBe(false);
		expect(
			jobOfferNeedsReview({
				...baseJob,
				review: {
					signals: extractJobSignals(baseJob.rawText),
					summary: "We ...",
					rawText: baseJob.rawText,
					reviewedAt: new Date(0).toISOString(),
					reviewTool: "lmstudio",
				},
			}),
		).toBe(true);
		expect(
			jobOfferNeedsReview({
				...baseJob,
				rawText: "Updated posting text",
				review: {
					signals: extractJobSignals(baseJob.rawText),
					summary: "Backend role.",
					rawText: baseJob.rawText,
					reviewedAt: new Date(0).toISOString(),
					reviewTool: "claude",
				},
			}),
		).toBe(true);
	});

	it("rejects truncated job review summaries", () => {
		expect(isUsableJobReviewSummary("We ...")).toBe(false);
		expect(
			isUsableJobReviewSummary(
				"Backend role focused on Node.js APIs and PostgreSQL data modeling.",
			),
		).toBe(true);
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
			position: "frontend",
			links: [],
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
		expect(analysis.goodFit.length).toBeGreaterThan(0);
		expect(analysis.missingKeywords).not.toContain("and");
		expect(analysis.score).toBeGreaterThan(50);
	});

	it("normalizes legacy match analysis without goodFit", () => {
		const analysis = normalizeMatchAnalysis({
			score: 70,
			matchedKeywords: ["react"],
			missingKeywords: [],
			missingRequirements: [],
			warnings: [],
		});

		expect(analysis.goodFit).toEqual([]);
		expect(analysis.source).toBe("draft");
	});
});

describe("profile content helpers", () => {
	it("detects meaningful profile content", () => {
		expect(hasMeaningfulProfileContent(createDefaultBaseProfile())).toBe(false);
		expect(
			hasMeaningfulProfileContent(
				profileWith({
					experience: [
						{
							id: "exp-1",
							company: "",
							title: "",
							location: "",
							startDate: "",
							endDate: "",
							current: false,
							bullets: [],
							technologies: [],
						},
					],
				}),
			),
		).toBe(false);
		expect(
			hasMeaningfulProfileContent(
				profileWith({
					contact: {
						name: "Ada Example",
						email: "",
						phone: "",
						location: "",
						links: [],
					},
				}),
			),
		).toBe(true);
	});

	it("summarizes parsed profile content", () => {
		expect(
			summarizeProfileContent(
				profileWith({
					contact: {
						name: "Ada Example",
						email: "",
						phone: "",
						location: "",
						links: [],
					},
					experience: [
						{
							id: "exp-1",
							company: "Example Co",
							title: "Engineer",
							location: "",
							startDate: "2021",
							endDate: "",
							current: true,
							bullets: ["Built things"],
							technologies: ["TypeScript"],
						},
					],
					skills: ["TypeScript"],
				}),
			),
		).toContain("Ada Example");
	});

	it("compares normalized profile content", () => {
		const left = profileWith({ summary: "Backend engineer" });
		const right = profileWith({ summary: "Backend engineer", skills: [] });

		expect(profilesHaveSameContent(left, right)).toBe(true);
		expect(
			profilesHaveSameContent(left, profileWith({ summary: "Different" })),
		).toBe(false);
	});
});

describe("migrateAppSettings", () => {
	it("maps legacy auto selection to claude", () => {
		const defaults = createDefaultAppSettings();
		const migrated = migrateAppSettings({
			...defaults,
			schemaVersion: 2,
			selectedAiTool: "auto",
			selectedAiProvider: undefined,
		});

		expect(migrated.schemaVersion).toBe(4);
		expect(migrated.selectedAiProvider).toBe("claude");
		expect(migrated.lmStudio?.baseUrl).toBe("http://localhost:1234");
	});

	it("preserves explicit lmstudio selection", () => {
		const defaults = createDefaultAppSettings();
		const migrated = migrateAppSettings({
			...defaults,
			schemaVersion: 2,
			selectedAiTool: "lmstudio",
			selectedAiProvider: undefined,
		});

		expect(migrated.selectedAiProvider).toBe("lmstudio");
	});

	it("upgrades schema v3 settings to v4", () => {
		const defaults = createDefaultAppSettings();
		const migrated = migrateAppSettings({
			...defaults,
			schemaVersion: 3,
			cloudBackup: undefined,
		});

		expect(migrated.schemaVersion).toBe(4);
	});
});
