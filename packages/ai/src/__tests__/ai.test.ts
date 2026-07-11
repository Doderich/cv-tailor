import { describe, expect, it } from "vitest";

import {
	buildEvaluateProfileMatchPrompt,
	buildGenerateProfilePrompt,
	buildReviewJobPostingPrompt,
	buildTailorCvPrompt,
	generatedProfileOutputJsonSchema,
	parseCliGeneratedProfileOutput,
	parseCliJobPostingReviewOutput,
	parseCliMatchAnalysisOutput,
	parseCliTailoredCvOutput,
	type TailorCvInput,
	tailoredCvOutputJsonSchema,
} from "../index";

const validOutput = {
	summary: "Frontend engineer focused on React and accessibility.",
	skills: ["React", "TypeScript", "Accessibility"],
	experience: [
		{ experienceId: "exp-1", bullets: ["Built accessible React interfaces."] },
	],
	projects: [
		{ projectId: "project-1", bullets: ["Created a CV tailoring prototype."] },
	],
	educationIds: ["edu-1"],
	missingRequirements: ["Kubernetes experience is not present in the profile."],
	warnings: ["Verify unsupported infrastructure requirements."],
};

const validProfileOutput = {
	contact: {
		name: "Ada Example",
		email: "ada@example.com",
		phone: "",
		location: "Berlin",
		links: ["https://linkedin.com/in/ada-example"],
	},
	headline: "Frontend Engineer",
	summary: "Frontend engineer building accessible React products.",
	targetRoles: ["Frontend Engineer"],
	preferredTone: "Clear and factual.",
	skills: ["React", "TypeScript", "Accessibility"],
	achievements: ["Improved UI accessibility."],
	experience: [
		{
			id: "exp-1",
			company: "Example Co",
			title: "Frontend Engineer",
			location: "Remote",
			startDate: "2021",
			endDate: "",
			current: true,
			bullets: ["Built accessible React interfaces."],
			technologies: ["React", "TypeScript"],
		},
	],
	education: [],
	projects: [],
	languages: ["English"],
};

const promptInput: TailorCvInput = {
	profile: {
		contact: {
			name: "Ada Example",
			email: "ada@example.com",
			phone: "",
			location: "Berlin",
			links: [],
		},
		headline: "Frontend Engineer",
		summary: "Builds accessible React products.",
		targetRoles: ["Frontend Engineer"],
		preferredTone: "Direct and factual.",
		skills: ["React", "TypeScript", "Accessibility"],
		achievements: [],
		experience: [
			{
				id: "exp-1",
				company: "Example Co",
				title: "Frontend Engineer",
				location: "Remote",
				startDate: "2021",
				endDate: "",
				current: true,
				bullets: ["Built accessible React interfaces."],
				technologies: ["React"],
			},
		],
		education: [
			{
				id: "edu-1",
				institution: "Example University",
				degree: "BSc Computer Science",
				location: "",
				startDate: "2014",
				endDate: "2018",
				details: [],
			},
		],
		projects: [
			{
				id: "project-1",
				name: "CV Tailor",
				role: "Builder",
				url: "",
				description: "Desktop CV tool.",
				bullets: ["Created a CV tailoring prototype."],
				technologies: ["TypeScript"],
			},
		],
		languages: ["English"],
	},
	jobOffer: {
		id: "job-1",
		title: "Senior Frontend Engineer",
		company: "Hiring Co",
		position: "frontend",
		links: [],
		rawText: "React and accessibility.",
		createdAt: new Date(0).toISOString(),
	},
	signals: {
		keywords: ["react", "accessibility"],
		requirements: ["Must have React experience"],
		responsibilities: ["Build accessible UI"],
		seniority: "senior",
		technologies: ["react"],
		softSkills: [],
	},
	matchAnalysis: {
		score: 80,
		matchedKeywords: ["react"],
		missingKeywords: [],
		missingRequirements: [],
		goodFit: ["Strong React experience across multiple roles."],
		warnings: [],
		source: "draft",
	},
	targetLanguage: "en",
};

describe("buildTailorCvPrompt", () => {
	it("includes schema, profile, signals, and anti-fabrication instructions", () => {
		const prompt = buildTailorCvPrompt(promptInput);

		expect(prompt).toContain(
			JSON.stringify(tailoredCvOutputJsonSchema, null, 2),
		);
		expect(prompt).toContain("Use only facts present in the base profile.");
		expect(prompt).toContain("Do not invent employers, dates, titles");
		expect(prompt).toContain("Base profile JSON:");
		expect(prompt).toContain("Target output language: English (en)");
		expect(prompt).toContain("Extracted job signals JSON:");
	});
});

describe("buildGenerateProfilePrompt", () => {
	it("includes context, fetched sources, schema, and anti-fabrication instructions", () => {
		const prompt = buildGenerateProfilePrompt({
			contextText: "Ada is a frontend engineer with React experience.",
			sourceUrls: ["https://linkedin.com/in/ada-example"],
			fetchedSources: [
				{
					url: "https://example.com/about",
					text: "Ada built accessible interfaces.",
					status: 200,
				},
			],
		});

		expect(prompt).toContain(
			JSON.stringify(generatedProfileOutputJsonSchema, null, 2),
		);
		expect(prompt).toContain("Use only facts present in the supplied context");
		expect(prompt).toContain("Do not explore repositories, files, directories");
		expect(prompt).toContain("Do not invent employers, dates, titles");
		expect(prompt).toContain("Ada is a frontend engineer");
		expect(prompt).toContain("https://example.com/about");
		expect(prompt).toContain("Uploaded local file text:");
	});

	it("includes the target profile language", () => {
		const prompt = buildGenerateProfilePrompt({
			contextText: "Ada is a frontend engineer.",
			sourceUrls: [],
			fetchedSources: [],
			targetLanguage: "de",
		});

		expect(prompt).toContain("Target profile language: German (de)");
	});
});

describe("parseCliTailoredCvOutput", () => {
	it("parses raw JSON", () => {
		expect(parseCliTailoredCvOutput(JSON.stringify(validOutput))).toEqual(
			validOutput,
		);
	});

	it("parses a Claude-style JSON envelope", () => {
		const envelope = {
			type: "result",
			result: JSON.stringify(validOutput),
		};

		expect(parseCliTailoredCvOutput(JSON.stringify(envelope))).toEqual(
			validOutput,
		);
	});

	it("parses fenced JSON", () => {
		expect(
			parseCliTailoredCvOutput(
				`\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``,
			),
		).toEqual(validOutput);
	});

	it("throws on invalid JSON", () => {
		expect(() => parseCliTailoredCvOutput("not json")).toThrow();
	});
});

describe("parseCliGeneratedProfileOutput", () => {
	it("parses raw profile JSON", () => {
		expect(
			parseCliGeneratedProfileOutput(JSON.stringify(validProfileOutput)),
		).toEqual(validProfileOutput);
	});

	it("parses nested profile JSON", () => {
		const envelope = {
			response: {
				content: JSON.stringify(validProfileOutput),
			},
		};

		expect(parseCliGeneratedProfileOutput(JSON.stringify(envelope))).toEqual(
			validProfileOutput,
		);
	});

	it("parses cursor result envelopes with progress log lines", () => {
		const envelope = {
			type: "result",
			subtype: "success",
			result: JSON.stringify(validProfileOutput),
		};
		const stdout = [
			"Preparing profile context...",
			"Running local AI tool...",
			JSON.stringify(envelope),
			"cursor finished in 20847 ms",
		].join("\n");

		expect(parseCliGeneratedProfileOutput(stdout)).toEqual(validProfileOutput);
	});
});

const validJobReviewOutput = {
	summary: "Backend role focused on Node.js and PostgreSQL.",
	signals: {
		keywords: ["nodejs", "postgresql", "apis"],
		requirements: ["Experience with Node.js and PostgreSQL"],
		responsibilities: ["Build and maintain backend APIs"],
		seniority: "mid",
		technologies: ["nodejs", "postgresql"],
		softSkills: ["ownership"],
	},
};

describe("job posting review prompt and parser", () => {
	it("builds a review prompt with posting text and metadata", () => {
		const prompt = buildReviewJobPostingPrompt({
			jobOffer: {
				id: "job-1",
				title: "Backend Engineer",
				company: "Example Co",
				position: "backend",
				links: ["https://example.com/jobs/1"],
				rawText: "We need Node.js and PostgreSQL experience.",
				createdAt: new Date(0).toISOString(),
			},
			rawText: "We need Node.js and PostgreSQL experience.",
		});

		expect(prompt).toContain("Backend Engineer");
		expect(prompt).toContain("We need Node.js and PostgreSQL experience.");
		expect(prompt).toContain("Output schema:");
		expect(prompt).toContain('"seniority"');
	});

	it("parses fenced job review JSON", () => {
		const stdout = `\`\`\`json\n${JSON.stringify(validJobReviewOutput)}\n\`\`\``;
		expect(parseCliJobPostingReviewOutput(stdout)).toEqual(
			validJobReviewOutput,
		);
	});
});

const validMatchAnalysisOutput = {
	score: 78,
	matchedKeywords: ["typescript", "next.js", "postgresql"],
	missingKeywords: ["aws", "nestjs"],
	missingRequirements: ["AWS production experience is not evidenced."],
	goodFit: [
		"Strong TypeScript and Next.js experience across professional roles and side projects.",
		"PostgreSQL is used in current SaaS work at Montamo.",
		"Startup experience with end-to-end feature ownership matches the role scope.",
	],
	warnings: ["GCP experience may partially cover basic cloud expectations."],
};

describe("profile match evaluation prompt and parser", () => {
	it("builds a semantic match prompt with profile and job signals", () => {
		const prompt = buildEvaluateProfileMatchPrompt({
			profile: promptInput.profile,
			jobOffer: promptInput.jobOffer,
			signals: promptInput.signals,
		});

		expect(prompt).toContain(
			"Judge semantically, not by naive keyword overlap.",
		);
		expect(prompt).toContain("goodFit must list the strongest factual reasons");
		expect(prompt).toContain("Base profile JSON:");
		expect(prompt).toContain("Extracted job signals JSON:");
	});

	it("parses fenced match analysis JSON", () => {
		const stdout = `\`\`\`json\n${JSON.stringify(validMatchAnalysisOutput)}\n\`\`\``;
		expect(parseCliMatchAnalysisOutput(stdout)).toEqual({
			...validMatchAnalysisOutput,
			source: "ai",
		});
	});
});
