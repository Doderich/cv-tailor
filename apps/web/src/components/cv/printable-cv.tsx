import type { Application, BaseProfile, CvRun, CvTemplateId } from "@cv-tailor/core";
import { defaultCvTemplate } from "@cv-tailor/core";

import { useResolvedCvContent } from "./cv-content";
import { CvLayoutTemplate } from "./cv-layout-templates";

interface PrintableCvProps {
	profile: BaseProfile;
	application: Application | undefined;
	run: CvRun | undefined;
	template?: CvTemplateId;
}

export function PrintableCv({
	profile,
	application,
	run,
	template = defaultCvTemplate,
}: PrintableCvProps) {
	const content = useResolvedCvContent({
		profile,
		application,
		run,
		nameFallbackKey: "cv.print.nameFallback",
	});

	if (!content) {
		return null;
	}

	return (
		<CvLayoutTemplate template={template} content={content} mode="print" />
	);
}
