import type { Application, BaseProfile, CvRun, CvTemplateId } from "@cv-tailor/core";
import { defaultCvTemplate } from "@cv-tailor/core";

import { useResolvedCvContent } from "./cv-content";
import { CvLayoutTemplate } from "./cv-layout-templates";

export function CvPreview({
	profile,
	application,
	run,
	template = defaultCvTemplate,
}: {
	profile: BaseProfile;
	application: Application | undefined;
	run: CvRun | undefined;
	template?: CvTemplateId;
}) {
	const content = useResolvedCvContent({
		profile,
		application,
		run,
	});

	if (!content) {
		return null;
	}

	return (
		<CvLayoutTemplate template={template} content={content} mode="preview" />
	);
}
