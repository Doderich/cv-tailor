import { z } from "zod";

export const cvTemplateIds = [
	"classic",
	"modern",
	"sidebar",
	"minimal",
	"executive",
] as const;

export const cvTemplateSchema = z.enum(cvTemplateIds);

export type CvTemplateId = z.infer<typeof cvTemplateSchema>;

export const defaultCvTemplate: CvTemplateId = "classic";

export function normalizeCvTemplate(
	value: string | undefined,
): CvTemplateId {
	const parsed = cvTemplateSchema.safeParse(value);
	return parsed.success ? parsed.data : defaultCvTemplate;
}
