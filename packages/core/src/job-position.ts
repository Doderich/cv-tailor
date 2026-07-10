import { z } from "zod";

export const jobPositions = [
	"unspecified",
	"frontend",
	"backend",
	"fullstack",
	"mobile",
	"devops",
	"data",
	"ml",
	"design",
	"product",
	"other",
] as const;

export const jobPositionSchema = z.enum(jobPositions);

export type JobPosition = z.infer<typeof jobPositionSchema>;

const jobPositionLabels: Record<JobPosition, string> = {
	unspecified: "Not specified",
	frontend: "Frontend",
	backend: "Backend",
	fullstack: "Full stack",
	mobile: "Mobile",
	devops: "DevOps / Platform",
	data: "Data engineering",
	ml: "ML / AI",
	design: "Design / UX",
	product: "Product",
	other: "Other",
};

export function jobPositionLabel(position: JobPosition) {
	return jobPositionLabels[position];
}

export function inferJobPositionFromText(text: string): JobPosition {
	const normalized = text.toLowerCase();

	if (/\b(full[\s-]?stack|fullstack)\b/.test(normalized)) {
		return "fullstack";
	}
	if (/\b(mobile|ios|android|flutter|react[\s-]?native|swiftui|kotlin)\b/.test(normalized)) {
		return "mobile";
	}
	if (/\b(devops|sre|site reliability|platform engineer|infrastructure)\b/.test(normalized)) {
		return "devops";
	}
	if (/\b(data engineer|analytics engineer|data platform)\b/.test(normalized)) {
		return "data";
	}
	if (/\b(machine learning|ml engineer|ai engineer|deep learning)\b/.test(normalized)) {
		return "ml";
	}
	if (/\b(frontend|front-end|front end|react developer|vue developer|angular)\b/.test(normalized)) {
		return "frontend";
	}
	if (/\b(backend|back-end|back end|node\.?js developer|java developer|golang)\b/.test(normalized)) {
		return "backend";
	}
	if (/\b(product designer|ux designer|ui designer|product design)\b/.test(normalized)) {
		return "design";
	}
	if (/\b(product manager|product owner|product lead)\b/.test(normalized)) {
		return "product";
	}

	return "unspecified";
}
