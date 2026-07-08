import { z } from "zod";

const seniorityValues = [
	"unspecified",
	"intern",
	"junior",
	"mid",
	"senior",
	"lead",
	"executive",
] as const;

export const contactSchema = z.object({
	name: z.string(),
	email: z.string(),
	phone: z.string(),
	location: z.string(),
	links: z.array(z.string()),
});

export const experienceItemSchema = z.object({
	id: z.string(),
	company: z.string(),
	title: z.string(),
	location: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	current: z.boolean(),
	bullets: z.array(z.string()),
	technologies: z.array(z.string()),
});

export const educationItemSchema = z.object({
	id: z.string(),
	institution: z.string(),
	degree: z.string(),
	location: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	details: z.array(z.string()),
});

export const projectItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	role: z.string(),
	url: z.string(),
	description: z.string(),
	bullets: z.array(z.string()),
	technologies: z.array(z.string()),
});

export const baseProfileSchema = z.object({
	contact: contactSchema,
	headline: z.string(),
	summary: z.string(),
	targetRoles: z.array(z.string()),
	preferredTone: z.string(),
	skills: z.array(z.string()),
	achievements: z.array(z.string()),
	experience: z.array(experienceItemSchema),
	education: z.array(educationItemSchema),
	projects: z.array(projectItemSchema),
	languages: z.array(z.string()),
});

export const jobSignalsSchema = z.object({
	keywords: z.array(z.string()),
	requirements: z.array(z.string()),
	responsibilities: z.array(z.string()),
	seniority: z.enum(seniorityValues),
	technologies: z.array(z.string()),
	softSkills: z.array(z.string()),
});

export const jobOfferSchema = z.object({
	id: z.string(),
	title: z.string(),
	company: z.string(),
	rawText: z.string(),
	createdAt: z.string(),
	signals: jobSignalsSchema.optional(),
});

export const tailoredExperienceSchema = z.object({
	experienceId: z.string(),
	bullets: z.array(z.string()),
});

export const tailoredProjectSchema = z.object({
	projectId: z.string(),
	bullets: z.array(z.string()),
});

export const tailoredCvSchema = z.object({
	summary: z.string(),
	skills: z.array(z.string()),
	experience: z.array(tailoredExperienceSchema),
	projects: z.array(tailoredProjectSchema),
	educationIds: z.array(z.string()),
	missingRequirements: z.array(z.string()),
	warnings: z.array(z.string()),
});

export const matchAnalysisSchema = z.object({
	score: z.number().min(0).max(100),
	matchedKeywords: z.array(z.string()),
	missingKeywords: z.array(z.string()),
	missingRequirements: z.array(z.string()),
	warnings: z.array(z.string()),
});

export const cvLanguages = ["en", "de"] as const;

export const cvLanguageSchema = z.enum(cvLanguages);

export const cvRunSourceSchema = z.enum(["draft", "ai", "manual"]);

export const profileRecordSchema = baseProfileSchema.extend({
	id: z.string(),
	name: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const applicationSchema = z.object({
	id: z.string(),
	profileId: z.string(),
	jobOffer: jobOfferSchema,
	archived: z.boolean().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const cvRunSchema = z.object({
	id: z.string(),
	applicationId: z.string(),
	profileId: z.string(),
	language: cvLanguageSchema,
	label: z.string(),
	cv: tailoredCvSchema,
	signals: jobSignalsSchema,
	matchAnalysis: matchAnalysisSchema,
	aiTool: z.string(),
	source: cvRunSourceSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const aiOutputSchema = z.object({
	id: z.string(),
	cvRunId: z.string(),
	stdout: z.string(),
});

export const appSettingsSchema = z.object({
	id: z.literal("settings"),
	schemaVersion: z.literal(2),
	activeProfileId: z.string(),
	activeApplicationId: z.string().optional(),
	activeRunId: z.string().optional(),
	selectedAiTool: z.string().optional(),
	aiModels: z
		.object({
			claude: z.string(),
			codex: z.string(),
			cursor: z.string(),
		})
		.partial()
		.optional(),
});

export type Contact = z.infer<typeof contactSchema>;
export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;
export type BaseProfile = z.infer<typeof baseProfileSchema>;
export type JobSignals = z.infer<typeof jobSignalsSchema>;
export type JobOffer = z.infer<typeof jobOfferSchema>;
export type TailoredCv = z.infer<typeof tailoredCvSchema>;
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
export type CvLanguage = z.infer<typeof cvLanguageSchema>;
export type CvRunSource = z.infer<typeof cvRunSourceSchema>;
export type ProfileRecord = z.infer<typeof profileRecordSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type CvRun = z.infer<typeof cvRunSchema>;
export type AiOutput = z.infer<typeof aiOutputSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

const stopWords = new Set([
	"a",
	"about",
	"across",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"can",
	"for",
	"from",
	"has",
	"have",
	"in",
	"into",
	"is",
	"it",
	"of",
	"on",
	"or",
	"our",
	"that",
	"the",
	"their",
	"this",
	"to",
	"we",
	"with",
	"you",
	"your",
]);

const knownTechnologies = [
	"accessibility",
	"aws",
	"azure",
	"ci/cd",
	"css",
	"docker",
	"figma",
	"gcp",
	"graphql",
	"html",
	"javascript",
	"kubernetes",
	"node",
	"postgres",
	"python",
	"react",
	"rust",
	"sql",
	"tailwind",
	"tauri",
	"typescript",
	"vite",
];

const knownSoftSkills = [
	"communication",
	"collaboration",
	"leadership",
	"mentoring",
	"ownership",
	"prioritization",
	"stakeholder management",
	"teamwork",
];

const requirementMarkers = [
	"require",
	"qualification",
	"must",
	"need",
	"experience with",
	"proficient",
	"familiar",
	"you have",
	"what you bring",
];

const responsibilityMarkers = [
	"responsibil",
	"you will",
	"you'll",
	"what you'll do",
	"own",
	"build",
	"deliver",
	"lead",
	"design",
];

function cleanLine(line: string) {
	return line
		.replace(/^[\s\-*•\d.)]+/, "")
		.replace(/\s+/g, " ")
		.trim();
}

function uniqueSorted(values: string[]) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
		(a, b) => a.localeCompare(b),
	);
}

function normalizeText(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9+#/.\s-]/g, " ");
}

function extractTerms(value: string) {
	return normalizeText(value)
		.split(/\s+/)
		.map((term) => term.trim())
		.filter((term) => term.length > 2 && !stopWords.has(term));
}

function includesAnyMarker(value: string, markers: string[]) {
	const normalized = normalizeText(value);
	return markers.some((marker) => normalized.includes(marker));
}

function detectSeniority(text: string): JobSignals["seniority"] {
	const normalized = normalizeText(text);

	if (
		/\b(chief|cto|vp|vice president|director|head of|executive)\b/.test(
			normalized,
		)
	) {
		return "executive";
	}
	if (/\b(staff|principal|lead|manager)\b/.test(normalized)) {
		return "lead";
	}
	if (/\b(senior|sr\.?)\b/.test(normalized)) {
		return "senior";
	}
	if (/\b(mid|intermediate)\b/.test(normalized)) {
		return "mid";
	}
	if (/\b(junior|jr\.?|entry level|graduate)\b/.test(normalized)) {
		return "junior";
	}
	if (/\b(intern|internship|working student)\b/.test(normalized)) {
		return "intern";
	}

	return "unspecified";
}

function extractKnownPhrases(text: string, dictionary: string[]) {
	const normalized = normalizeText(text);
	return dictionary.filter((term) => {
		const normalizedTerm = term.toLowerCase();
		const stem = normalizedTerm.endsWith("ing")
			? normalizedTerm.slice(0, -3)
			: normalizedTerm;
		return normalized.includes(normalizedTerm) || normalized.includes(stem);
	});
}

function extractKeywordCandidates(text: string) {
	const terms = extractTerms(text);
	const counts = new Map<string, number>();

	for (const term of terms) {
		counts.set(term, (counts.get(term) ?? 0) + 1);
	}

	return [...counts.entries()]
		.sort(
			(left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
		)
		.slice(0, 24)
		.map(([term]) => term);
}

export function extractJobSignals(rawText: string): JobSignals {
	const text = rawText.trim();

	if (!text) {
		return {
			keywords: [],
			requirements: [],
			responsibilities: [],
			seniority: "unspecified",
			technologies: [],
			softSkills: [],
		};
	}

	const lines = text
		.split(/\r?\n/)
		.map(cleanLine)
		.filter((line) => line.length > 0);
	const requirements = lines
		.filter((line) => includesAnyMarker(line, requirementMarkers))
		.slice(0, 16);
	const responsibilities = lines
		.filter((line) => includesAnyMarker(line, responsibilityMarkers))
		.slice(0, 16);
	const technologies = extractKnownPhrases(text, knownTechnologies);
	const softSkills = extractKnownPhrases(text, knownSoftSkills);

	return {
		keywords: uniqueSorted([
			...extractKeywordCandidates(text),
			...technologies,
			...softSkills,
		]),
		requirements: uniqueSorted(requirements),
		responsibilities: uniqueSorted(responsibilities),
		seniority: detectSeniority(text),
		technologies: uniqueSorted(technologies),
		softSkills: uniqueSorted(softSkills),
	};
}

function profileSearchText(profile: BaseProfile) {
	const sections = [
		profile.contact.name,
		profile.contact.email,
		profile.contact.phone,
		profile.contact.location,
		profile.contact.links.join(" "),
		profile.headline,
		profile.summary,
		profile.targetRoles.join(" "),
		profile.preferredTone,
		profile.skills.join(" "),
		profile.achievements.join(" "),
		profile.languages.join(" "),
		...profile.experience.flatMap((item) => [
			item.company,
			item.title,
			item.location,
			item.bullets.join(" "),
			item.technologies.join(" "),
		]),
		...profile.projects.flatMap((item) => [
			item.name,
			item.role,
			item.url,
			item.description,
			item.bullets.join(" "),
			item.technologies.join(" "),
		]),
		...profile.education.flatMap((item) => [
			item.institution,
			item.degree,
			item.location,
			item.details.join(" "),
		]),
	];

	return normalizeText(sections.join(" "));
}

function requirementIsMatched(
	requirement: string,
	profileTerms: Set<string>,
	profileText: string,
) {
	const requirementTerms = extractTerms(requirement);

	if (requirementTerms.length === 0) {
		return true;
	}

	const strongTerms = requirementTerms.filter((term) => term.length > 3);
	const termsToCheck = strongTerms.length > 0 ? strongTerms : requirementTerms;
	const matchedTerms = termsToCheck.filter(
		(term) => profileTerms.has(term) || profileText.includes(term),
	);

	return matchedTerms.length / termsToCheck.length >= 0.35;
}

export function scoreProfileAgainstJob(
	profile: BaseProfile,
	job: JobOffer,
): MatchAnalysis {
	const signals = job.signals ?? extractJobSignals(job.rawText);
	const profileText = profileSearchText(profile);
	const profileTerms = new Set(extractTerms(profileText));
	const jobKeywords = uniqueSorted([
		...signals.keywords,
		...signals.technologies,
		...signals.softSkills,
	]);
	const matchedKeywords = jobKeywords.filter((keyword) => {
		const normalizedKeyword = normalizeText(keyword).trim();
		return (
			profileText.includes(normalizedKeyword) ||
			extractTerms(keyword).some((term) => profileTerms.has(term))
		);
	});
	const missingKeywords = jobKeywords.filter(
		(keyword) => !matchedKeywords.includes(keyword),
	);
	const missingRequirements = signals.requirements.filter(
		(requirement) =>
			!requirementIsMatched(requirement, profileTerms, profileText),
	);
	const keywordScore =
		jobKeywords.length === 0
			? 100
			: Math.round((matchedKeywords.length / jobKeywords.length) * 100);
	const requirementPenalty =
		signals.requirements.length === 0
			? 0
			: Math.round(
					(missingRequirements.length / signals.requirements.length) * 35,
				);
	const score = Math.max(0, Math.min(100, keywordScore - requirementPenalty));
	const warnings = [
		...(missingRequirements.length > 0
			? [
					`${missingRequirements.length} stated requirement(s) are not clearly supported by the base profile.`,
				]
			: []),
		...(signals.seniority === "senior" ||
		signals.seniority === "lead" ||
		signals.seniority === "executive"
			? [
					`Detected ${signals.seniority} seniority; verify leadership and scope are represented factually.`,
				]
			: []),
	];

	return {
		score,
		matchedKeywords,
		missingKeywords,
		missingRequirements,
		warnings,
	};
}

export function createDefaultBaseProfile(): BaseProfile {
	return {
		contact: {
			name: "",
			email: "",
			phone: "",
			location: "",
			links: [],
		},
		headline: "",
		summary: "",
		targetRoles: [],
		preferredTone: "Clear, concise, confident, and factual.",
		skills: [],
		achievements: [],
		experience: [],
		education: [],
		projects: [],
		languages: [],
	};
}

export function createDefaultTailoredCv(profile: BaseProfile): TailoredCv {
	return {
		summary: profile.summary,
		skills: profile.skills,
		experience: profile.experience.map((item) => ({
			experienceId: item.id,
			bullets: item.bullets,
		})),
		projects: profile.projects.map((item) => ({
			projectId: item.id,
			bullets: item.bullets,
		})),
		educationIds: profile.education.map((item) => item.id),
		missingRequirements: [],
		warnings: [],
	};
}

export const defaultProfileId = "profile-default";

export function cvLanguageLabel(language: CvLanguage) {
	return language === "de" ? "German" : "English";
}

export function createDefaultProfileRecord(
	now = new Date().toISOString(),
): ProfileRecord {
	return {
		id: defaultProfileId,
		name: "Default",
		...createDefaultBaseProfile(),
		createdAt: now,
		updatedAt: now,
	};
}

export function createDefaultAppSettings(
	profileId = defaultProfileId,
): AppSettings {
	return {
		id: "settings",
		schemaVersion: 2,
		activeProfileId: profileId,
		selectedAiTool: "auto",
		aiModels: {
			claude: "sonnet",
			codex: "gpt-5.4",
			cursor: "composer-2.5",
		},
	};
}

export function createDraftCvRun(input: {
	id: string;
	applicationId: string;
	profileId: string;
	profile: BaseProfile;
	jobOffer: JobOffer;
	language: CvLanguage;
	now?: string;
}): CvRun {
	const now = input.now ?? new Date().toISOString();
	const signals =
		input.jobOffer.signals ?? extractJobSignals(input.jobOffer.rawText);

	return cvRunSchema.parse({
		id: input.id,
		applicationId: input.applicationId,
		profileId: input.profileId,
		language: input.language,
		label: cvLanguageLabel(input.language),
		cv: createDefaultTailoredCv(input.profile),
		signals,
		matchAnalysis: scoreProfileAgainstJob(input.profile, {
			...input.jobOffer,
			signals,
		}),
		aiTool: "draft",
		source: "draft",
		createdAt: now,
		updatedAt: now,
	});
}

export function createEmptyApplication(input: {
	id: string;
	profileId: string;
	profile: BaseProfile;
	now?: string;
}): { application: Application; draftRun: CvRun } {
	const now = input.now ?? new Date().toISOString();
	const signals = extractJobSignals("");
	const jobOffer: JobOffer = {
		id: createId("job"),
		title: "",
		company: "",
		rawText: "",
		createdAt: now,
		signals,
	};
	const runId = createId("run");

	return {
		application: applicationSchema.parse({
			id: input.id,
			profileId: input.profileId,
			jobOffer,
			createdAt: now,
			updatedAt: now,
		}),
		draftRun: createDraftCvRun({
			id: runId,
			applicationId: input.id,
			profileId: input.profileId,
			profile: input.profile,
			jobOffer,
			language: "en",
			now,
		}),
	};
}

export function createId(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureUniqueId(
	id: string,
	prefix: string,
	index: number,
	seen: Set<string>,
) {
	const fallback = `${prefix}-${index + 1}`;
	const candidate = id.trim() || fallback;
	const uniqueId = seen.has(candidate) ? createId(prefix) : candidate;
	seen.add(uniqueId);
	return uniqueId;
}

export function normalizeBaseProfile(profile: BaseProfile): BaseProfile {
	const experienceIds = new Set<string>();
	const educationIds = new Set<string>();
	const projectIds = new Set<string>();

	return baseProfileSchema.parse({
		...profile,
		contact: {
			...profile.contact,
			links: uniqueSorted(profile.contact.links),
		},
		targetRoles: uniqueSorted(profile.targetRoles),
		skills: uniqueSorted(profile.skills),
		achievements: uniqueSorted(profile.achievements),
		languages: uniqueSorted(profile.languages),
		experience: profile.experience.map((item, index) => ({
			...item,
			id: ensureUniqueId(item.id, "exp", index, experienceIds),
			technologies: uniqueSorted(item.technologies),
		})),
		education: profile.education.map((item, index) => ({
			...item,
			id: ensureUniqueId(item.id, "edu", index, educationIds),
		})),
		projects: profile.projects.map((item, index) => ({
			...item,
			id: ensureUniqueId(item.id, "project", index, projectIds),
			technologies: uniqueSorted(item.technologies),
		})),
	});
}
