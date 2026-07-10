import { inferJobPositionFromText, type JobPosition } from "./job-position";

const companyLegalSuffixes = new Set([
	"gmbh",
	"ag",
	"se",
	"inc",
	"ltd",
	"llc",
	"kg",
	"co",
	"corp",
	"corporation",
	"limited",
]);

function humanizeSlugParts(parts: string[]) {
	return parts
		.join(" ")
		.replace(/\bnode\s+js\b/gi, "Node.js")
		.replace(/\btype\s+script\b/gi, "TypeScript")
		.replace(/\bm\s+w\s+d\b/gi, "m/w/d")
		.replace(/\s+/g, " ")
		.trim();
}

function splitSlugSegments(slug: string) {
	return slug
		.split("-")
		.map((part) => part.trim())
		.filter(Boolean);
}

function parseSlugJobFields(slug: string) {
	const segments = splitSlugSegments(slug);
	if (segments.length === 0) {
		return { title: "", company: "" };
	}

	let suffixIndex = -1;
	for (let index = segments.length - 1; index >= 0; index -= 1) {
		if (companyLegalSuffixes.has(segments[index].toLowerCase())) {
			suffixIndex = index;
			break;
		}
	}

	if (suffixIndex >= 1) {
		const companyStart = suffixIndex - 1;
		const companyParts = segments.slice(companyStart, suffixIndex + 1);
		const titleParts = segments.slice(0, companyStart);

		while (
			titleParts.length >= 2 &&
			titleParts[titleParts.length - 1]?.toLowerCase() ===
				titleParts[titleParts.length - 2]?.toLowerCase()
		) {
			titleParts.pop();
		}

		return {
			title: humanizeSlugParts(titleParts),
			company: humanizeSlugParts(companyParts),
		};
	}

	return {
		title: humanizeSlugParts(segments),
		company: "",
	};
}

export function parseJobPostingUrl(url: string) {
	try {
		const parsed = new URL(url);
		const path = decodeURIComponent(parsed.pathname);

		const stepStoneMatch = path.match(/stellenangebote--(.+?)--\d+/i);
		if (stepStoneMatch) {
			return parseSlugJobFields(stepStoneMatch[1]);
		}

		const indeedMatch = path.match(/\/viewjob\/?$/i);
		if (indeedMatch && parsed.searchParams.get("jk")) {
			return { title: "", company: "" };
		}

		const linkedInMatch = path.match(/jobs\/view\/\d+/i);
		if (linkedInMatch) {
			return { title: "", company: "" };
		}

		const genericSlugMatch = path.match(
			/(?:jobs?|careers?|stellenangebote?)--(.+?)--[\w-]+\.html?$/i,
		);
		if (genericSlugMatch) {
			return parseSlugJobFields(genericSlugMatch[1]);
		}

		return { title: "", company: "" };
	} catch {
		return { title: "", company: "" };
	}
}

function cleanJobLine(line: string) {
	return line.replace(/\s+/g, " ").trim();
}

function isLikelyTitleLine(line: string) {
	if (line.length < 4 || line.length > 160) {
		return false;
	}

	if (/^(home|jobs?|careers?|login|cookie|privacy)/i.test(line)) {
		return false;
	}

	return true;
}

export function extractTitleCompanyFromJobText(text: string) {
	const lines = text
		.split(/\r?\n/)
		.map(cleanJobLine)
		.filter((line) => line.length > 0);

	let title = "";
	for (const line of lines.slice(0, 8)) {
		if (isLikelyTitleLine(line)) {
			title = line;
			break;
		}
	}

	const companyPatterns = [
		/\b(?:bei|at|@|von)\s+([A-ZÄÖÜ][\wÄÖÜäöüß.&+\-/ ]{2,80})/u,
		/\b([A-ZÄÖÜ][\wÄÖÜäöüß.&+\-/ ]{2,60}\s+(?:GmbH|AG|SE|Inc\.?|Ltd\.?|LLC|KG))\b/u,
		/(?:company|unternehmen|arbeitgeber)\s*[:|-]\s*([^\n|]{2,80})/iu,
	];

	let company = "";
	for (const pattern of companyPatterns) {
		const match = text.match(pattern);
		if (match?.[1]) {
			company = cleanJobLine(match[1]);
			break;
		}
	}

	return { title, company };
}

export function buildJobOfferFromFetchedPage(input: {
	text: string;
	url?: string;
}): {
	title: string;
	company: string;
	position: JobPosition;
	rawText: string;
	links: string[];
} {
	const rawText = input.text.trim();
	const urlHints = input.url ? parseJobPostingUrl(input.url) : { title: "", company: "" };
	const textHints = extractTitleCompanyFromJobText(rawText);
	const title = textHints.title || urlHints.title || "";

	return {
		title,
		company: textHints.company || urlHints.company || "",
		position: inferJobPositionFromText(`${title}\n${rawText}`),
		rawText,
		links: input.url ? [input.url] : [],
	};
}

export function normalizeJobOffer<
	T extends { links?: string[]; position?: JobPosition },
>(jobOffer: T): T & { links: string[]; position: JobPosition } {
	return {
		...jobOffer,
		links: [...(jobOffer.links ?? [])],
		position: jobOffer.position ?? "unspecified",
	};
}
