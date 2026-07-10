import {
	type BaseProfile,
	baseProfileSchema,
	type CvLanguage,
	cvLanguageLabel,
	type JobOffer,
	type JobSignals,
	jobSignalsSchema,
	type MatchAnalysis,
	type TailoredCv,
	tailoredCvSchema,
} from "@cv-tailor/core";

export type AiToolId = "auto" | "claude" | "codex" | "cursor";
export type AiProviderId = "claude" | "codex" | "cursor";

export type ClaudeModelId = "opus" | "sonnet" | "haiku";
export type CodexModelId = "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.3-codex";

export interface AiModels {
	claude: ClaudeModelId;
	codex: CodexModelId;
	cursor: string;
}

export const defaultAiModels: AiModels = {
	claude: "sonnet",
	codex: "gpt-5.4",
	cursor: "composer-2.5",
};

export const claudeModelOptions: { id: ClaudeModelId; label: string }[] = [
	{ id: "sonnet", label: "Sonnet" },
	{ id: "opus", label: "Opus" },
	{ id: "haiku", label: "Haiku" },
];

export const codexModelOptions: { id: CodexModelId; label: string }[] = [
	{ id: "gpt-5.4", label: "GPT-5.4" },
	{ id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
	{ id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
];

export const cursorModelOptions: { id: string; label: string }[] = [
	{ id: "auto", label: "Auto" },
	{ id: "composer-2.5", label: "Composer 2.5" },
	{ id: "gpt-5.4-high", label: "GPT-5.4 High" },
	{ id: "claude-opus-4-8-thinking-high", label: "Opus 4.8 Thinking" },
];

export interface TailorCvInput {
	profile: BaseProfile;
	jobOffer: JobOffer;
	signals: JobSignals;
	matchAnalysis: MatchAnalysis;
	targetLanguage: CvLanguage;
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
	fileSources?: Array<{
		name: string;
		text: string;
		error?: string;
	}>;
	preferredTone?: string;
	targetLanguage?: CvLanguage;
}

export type GeneratedProfileOutput = BaseProfile;

export interface ReviewJobPostingInput {
	jobOffer: JobOffer;
	rawText: string;
}

export interface JobPostingReviewOutput {
	signals: JobSignals;
	summary: string;
}

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

export const jobPostingReviewOutputJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: ["signals", "summary"],
	properties: {
		summary: {
			type: "string",
			description:
				"Brief plain-language overview of the role, seniority, and key expectations.",
		},
		signals: {
			type: "object",
			additionalProperties: false,
			required: [
				"keywords",
				"requirements",
				"responsibilities",
				"seniority",
				"technologies",
				"softSkills",
			],
			properties: {
				keywords: {
					type: "array",
					items: { type: "string" },
					description:
						"Meaningful role-specific terms such as domains, tools, and methodologies. Exclude stopwords and filler words.",
				},
				requirements: {
					type: "array",
					items: { type: "string" },
					description:
						"Must-have criteria quoted or closely paraphrased from the posting.",
				},
				responsibilities: {
					type: "array",
					items: { type: "string" },
					description: "Key duties paraphrased from the posting.",
				},
				seniority: {
					type: "string",
					enum: [
						"unspecified",
						"intern",
						"junior",
						"mid",
						"senior",
						"lead",
						"executive",
					],
				},
				technologies: {
					type: "array",
					items: { type: "string" },
					description:
						"Concrete tools, languages, frameworks, platforms, and infrastructure.",
				},
				softSkills: {
					type: "array",
					items: { type: "string" },
					description:
						"Interpersonal or working-style skills explicitly mentioned in the posting.",
				},
			},
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
		"Task constraints:",
		"- This is a data transformation task, not a coding task.",
		"- Do not explore repositories, files, directories, or the internet.",
		"- Use only the JSON inputs provided in this prompt.",
		"- Your entire response must be one JSON object matching the output schema.",
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
		`- Target output language: ${cvLanguageLabel(input.targetLanguage)} (${input.targetLanguage}). Write all CV text in this language.`,
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

export function buildReviewJobPostingPrompt(
	input: ReviewJobPostingInput,
): string {
	return [
		"You are analyzing a job posting to extract structured hiring signals for CV tailoring.",
		"",
		"Task constraints:",
		"- This is a data extraction task, not a coding task.",
		"- Do not explore repositories, files, directories, or the internet.",
		"- Use only the job posting text and metadata provided in this prompt.",
		"- Your entire response must be one JSON object matching the output schema.",
		"",
		"Extraction rules:",
		"- keywords: meaningful role-specific terms only. Exclude articles, conjunctions, pronouns, and filler words.",
		"- technologies: concrete tools, languages, frameworks, platforms, and infrastructure.",
		"- requirements: factual must-have criteria quoted or closely paraphrased from the posting.",
		"- responsibilities: key duties paraphrased from the posting.",
		"- softSkills: interpersonal or working-style skills explicitly mentioned.",
		"- seniority: infer from title, scope, and experience expectations.",
		"- summary: 2-4 sentences describing the role, seniority, and main expectations.",
		"- Normalize keywords and technologies to lowercase.",
		"- Preserve the posting language in requirements, responsibilities, summary, and softSkills.",
		"- Return JSON only matching the output schema. Do not include Markdown, prose, or code fences.",
		"",
		"Output schema:",
		JSON.stringify(jobPostingReviewOutputJsonSchema, null, 2),
		"",
		"Job metadata JSON:",
		JSON.stringify(
			{
				title: input.jobOffer.title,
				company: input.jobOffer.company,
				position: input.jobOffer.position,
				links: input.jobOffer.links,
			},
			null,
			2,
		),
		"",
		"Job posting text:",
		input.rawText,
	].join("\n");
}

export function buildGenerateProfilePrompt(
	input: GenerateProfileInput,
): string {
	return [
		"You are creating a reusable base CV profile from user-provided career context.",
		"",
		"Task constraints:",
		"- This is a data extraction task, not a coding task.",
		"- Do not explore repositories, files, directories, or the internet.",
		"- Use only the career context provided in this prompt.",
		"- Your entire response must be one JSON object matching the output schema.",
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
		`- Target profile language: ${cvLanguageLabel(input.targetLanguage ?? "en")} (${input.targetLanguage ?? "en"}). Write all profile text in this language.`,
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
		"",
		"Uploaded local file text:",
		JSON.stringify(input.fileSources ?? [], null, 2),
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

function looksLikeJobPostingReview(value: unknown) {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	return "signals" in record && "summary" in record;
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

export function parseCliJobPostingReviewOutput(
	stdout: string,
): JobPostingReviewOutput {
	const parsed = parseCliJsonLike(stdout, looksLikeJobPostingReview);
	const record = parsed as Record<string, unknown>;
	return {
		signals: jobSignalsSchema.parse(record.signals),
		summary: typeof record.summary === "string" ? record.summary : "",
	};
}
