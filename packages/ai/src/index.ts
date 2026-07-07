import {
	type BaseProfile,
	baseProfileSchema,
	type JobOffer,
	type JobSignals,
	type MatchAnalysis,
	type TailoredCv,
	tailoredCvSchema,
} from "@cv-tailor/core";

export type AiToolId = "auto" | "claude" | "codex";

export interface TailorCvInput {
	profile: BaseProfile;
	jobOffer: JobOffer;
	signals: JobSignals;
	matchAnalysis: MatchAnalysis;
}

export type TailoredCvOutput = TailoredCv;

export interface GenerateProfileInput {
	contextText: string;
	sourceUrls: string[];
	fetchedSources: Array<{
		url: string;
		text: string;
		status?: number;
		error?: string;
	}>;
	preferredTone?: string;
}

export type GeneratedProfileOutput = BaseProfile;

export interface AiAdapter {
	generateTailoredCv(input: TailorCvInput): Promise<TailoredCvOutput>;
}

export const tailoredCvOutputJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"summary",
		"skills",
		"experience",
		"projects",
		"educationIds",
		"missingRequirements",
		"warnings",
	],
	properties: {
		summary: {
			type: "string",
			description:
				"A concise CV summary rewritten for the job using only facts from the profile.",
		},
		skills: {
			type: "array",
			items: { type: "string" },
			description:
				"Relevant skills copied or lightly normalized from the base profile.",
		},
		experience: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["experienceId", "bullets"],
				properties: {
					experienceId: { type: "string" },
					bullets: {
						type: "array",
						items: { type: "string" },
						description:
							"Tailored factual bullets for this exact source experience item.",
					},
				},
			},
		},
		projects: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["projectId", "bullets"],
				properties: {
					projectId: { type: "string" },
					bullets: {
						type: "array",
						items: { type: "string" },
						description:
							"Tailored factual bullets for this exact source project item.",
					},
				},
			},
		},
		educationIds: {
			type: "array",
			items: { type: "string" },
			description: "IDs of education entries to include.",
		},
		missingRequirements: {
			type: "array",
			items: { type: "string" },
			description:
				"Requirements that cannot be factually supported by the base profile.",
		},
		warnings: {
			type: "array",
			items: { type: "string" },
			description: "Short factuality or matching caveats for the reviewer.",
		},
	},
} as const;

const experienceItemJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"id",
		"company",
		"title",
		"location",
		"startDate",
		"endDate",
		"current",
		"bullets",
		"technologies",
	],
	properties: {
		id: { type: "string", description: "Stable ID such as exp-1." },
		company: { type: "string" },
		title: { type: "string" },
		location: { type: "string" },
		startDate: { type: "string" },
		endDate: { type: "string" },
		current: { type: "boolean" },
		bullets: { type: "array", items: { type: "string" } },
		technologies: { type: "array", items: { type: "string" } },
	},
} as const;

const educationItemJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"id",
		"institution",
		"degree",
		"location",
		"startDate",
		"endDate",
		"details",
	],
	properties: {
		id: { type: "string", description: "Stable ID such as edu-1." },
		institution: { type: "string" },
		degree: { type: "string" },
		location: { type: "string" },
		startDate: { type: "string" },
		endDate: { type: "string" },
		details: { type: "array", items: { type: "string" } },
	},
} as const;

const projectItemJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"id",
		"name",
		"role",
		"url",
		"description",
		"bullets",
		"technologies",
	],
	properties: {
		id: { type: "string", description: "Stable ID such as project-1." },
		name: { type: "string" },
		role: { type: "string" },
		url: { type: "string" },
		description: { type: "string" },
		bullets: { type: "array", items: { type: "string" } },
		technologies: { type: "array", items: { type: "string" } },
	},
} as const;

export const generatedProfileOutputJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"contact",
		"headline",
		"summary",
		"targetRoles",
		"preferredTone",
		"skills",
		"achievements",
		"experience",
		"education",
		"projects",
		"languages",
	],
	properties: {
		contact: {
			type: "object",
			additionalProperties: false,
			required: ["name", "email", "phone", "location", "links"],
			properties: {
				name: { type: "string" },
				email: { type: "string" },
				phone: { type: "string" },
				location: { type: "string" },
				links: { type: "array", items: { type: "string" } },
			},
		},
		headline: { type: "string" },
		summary: { type: "string" },
		targetRoles: { type: "array", items: { type: "string" } },
		preferredTone: { type: "string" },
		skills: { type: "array", items: { type: "string" } },
		achievements: { type: "array", items: { type: "string" } },
		experience: { type: "array", items: experienceItemJsonSchema },
		education: { type: "array", items: educationItemJsonSchema },
		projects: { type: "array", items: projectItemJsonSchema },
		languages: { type: "array", items: { type: "string" } },
	},
} as const;

export function buildTailorCvPrompt(input: TailorCvInput): string {
	return [
		"You are tailoring a CV for a specific job application.",
		"",
		"Safety rules:",
		"- Use only facts present in the base profile.",
		"- Do not invent employers, dates, titles, degrees, certifications, metrics, tools, clients, or outcomes.",
		"- If a requirement is unsupported, add it to missingRequirements.",
		"- Preserve factual IDs exactly: experienceId, projectId, and educationIds must come from the base profile.",
		"- Return JSON only matching the output schema. Do not include Markdown, prose, or code fences.",
		"",
		"Style rules:",
		`- Preferred tone: ${input.profile.preferredTone || "Clear, concise, confident, and factual."}`,
		"- Optimize for ATS readability.",
		"- Keep bullets specific and evidence-based.",
		"",
		"Output schema:",
		JSON.stringify(tailoredCvOutputJsonSchema, null, 2),
		"",
		"Base profile JSON:",
		JSON.stringify(input.profile, null, 2),
		"",
		"Job offer JSON:",
		JSON.stringify(input.jobOffer, null, 2),
		"",
		"Extracted job signals JSON:",
		JSON.stringify(input.signals, null, 2),
		"",
		"Current deterministic match analysis JSON:",
		JSON.stringify(input.matchAnalysis, null, 2),
	].join("\n");
}

export function buildGenerateProfilePrompt(
	input: GenerateProfileInput,
): string {
	return [
		"You are creating a reusable base CV profile from user-provided career context.",
		"",
		"Safety rules:",
		"- Use only facts present in the supplied context or fetched public source text.",
		"- Do not invent employers, dates, titles, degrees, certifications, metrics, tools, clients, or outcomes.",
		"- If a detail is not present, use an empty string or an empty array.",
		"- Keep each experience, education, and project item factual and traceable to the input.",
		"- Generate stable IDs using exp-1, exp-2, edu-1, project-1, etc.",
		"- Return JSON only matching the output schema. Do not include Markdown, prose, or code fences.",
		"",
		"Profile-writing rules:",
		`- Preferred tone: ${input.preferredTone || "Clear, concise, confident, and factual."}`,
		"- The summary should be reusable across jobs, not tailored to one job posting.",
		"- Bullets should preserve the user's actual accomplishments and scope.",
		"- Contact links should include source URLs when they appear to belong to the user.",
		"",
		"Output schema:",
		JSON.stringify(generatedProfileOutputJsonSchema, null, 2),
		"",
		"Free-text context:",
		input.contextText || "",
		"",
		"User-supplied source URLs:",
		JSON.stringify(input.sourceUrls, null, 2),
		"",
		"Fetched public source text:",
		JSON.stringify(input.fetchedSources, null, 2),
	].join("\n");
}

function parseJson(value: string): unknown {
	return JSON.parse(value);
}

function extractFencedJson(stdout: string) {
	const fenceMatch = stdout.match(/```(?:json)?\s*([\s\S]*?)```/i);
	return fenceMatch?.[1]?.trim();
}

function extractFirstJsonObject(stdout: string) {
	const start = stdout.indexOf("{");
	const end = stdout.lastIndexOf("}");

	if (start === -1 || end === -1 || end <= start) {
		return undefined;
	}

	return stdout.slice(start, end + 1);
}

function parseMaybeNestedJson(
	value: unknown,
	looksLikeExpectedOutput: (value: unknown) => boolean,
): unknown {
	if (typeof value === "string") {
		const trimmed = value.trim();

		if (
			(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
			extractFencedJson(trimmed)
		) {
			return parseCliJsonLike(trimmed, looksLikeExpectedOutput);
		}

		return value;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const parsed = parseMaybeNestedJson(item, looksLikeExpectedOutput);
			if (looksLikeExpectedOutput(parsed)) {
				return parsed;
			}
		}
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const nestedCandidates = [
			record.result,
			record.response,
			record.output,
			record.text,
			record.content,
			record.message,
			record.final,
		];

		for (const candidate of nestedCandidates) {
			const parsed = parseMaybeNestedJson(candidate, looksLikeExpectedOutput);
			if (looksLikeExpectedOutput(parsed)) {
				return parsed;
			}
		}
	}

	return value;
}

function looksLikeTailoredCv(value: unknown) {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	return "summary" in record && "skills" in record && "experience" in record;
}

function looksLikeBaseProfile(value: unknown) {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	return "contact" in record && "headline" in record && "experience" in record;
}

function parseCliJsonLike(
	stdout: string,
	looksLikeExpectedOutput: (value: unknown) => boolean,
): unknown {
	const trimmed = stdout.trim();
	const fenced = extractFencedJson(trimmed);
	const jsonCandidate =
		fenced ??
		(trimmed.startsWith("{") ? trimmed : extractFirstJsonObject(trimmed));

	if (!jsonCandidate) {
		throw new Error("CLI output did not contain a JSON object.");
	}

	return parseMaybeNestedJson(
		parseJson(jsonCandidate),
		looksLikeExpectedOutput,
	);
}

export function parseCliTailoredCvOutput(stdout: string): TailoredCvOutput {
	const parsed = parseCliJsonLike(stdout, looksLikeTailoredCv);
	return tailoredCvSchema.parse(parsed);
}

export function parseCliGeneratedProfileOutput(
	stdout: string,
): GeneratedProfileOutput {
	const parsed = parseCliJsonLike(stdout, looksLikeBaseProfile);
	return baseProfileSchema.parse(parsed);
}
