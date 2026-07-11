import type { Application, CvRun } from "@cv-tailor/core";
import { jobOfferNeedsReview } from "@cv-tailor/core";

export type ApplicationStepId = "job-details" | "review" | "generate-cv";

export interface ApplicationStepMeta {
	id: ApplicationStepId;
	translationKey: string;
	number: number;
}

export const applicationSteps: ApplicationStepMeta[] = [
	{ id: "job-details", translationKey: "application.tab.jobDetails", number: 1 },
	{ id: "review", translationKey: "application.tab.review", number: 2 },
	{ id: "generate-cv", translationKey: "application.tab.generateCv", number: 3 },
];

export interface AnalysisState {
	isReviewingJobOffer: boolean;
	isAnalyzingProfileMatch: boolean;
	canUseSelectedAi: boolean;
}

export function hasJobDetails(application: Pick<Application, "jobOffer">) {
	const { title, company, rawText } = application.jobOffer;
	return (
		title.trim().length > 0 &&
		company.trim().length > 0 &&
		rawText.trim().length > 0
	);
}

export function isAnalysisInProgress(
	application: Application,
	state: AnalysisState,
) {
	if (state.isReviewingJobOffer || state.isAnalyzingProfileMatch) {
		return true;
	}

	if (!hasJobDetails(application)) {
		return false;
	}

	return jobOfferNeedsReview(application.jobOffer) && state.canUseSelectedAi;
}

export function isReviewStepUnlocked(application: Application) {
	return hasJobDetails(application);
}

export function isGenerateCvStepUnlocked(
	application: Application,
	run: CvRun | undefined,
	state: AnalysisState,
) {
	if (!isReviewStepUnlocked(application) || !run) {
		return false;
	}

	return !isAnalysisInProgress(application, state);
}

export function isStepUnlocked(
	step: ApplicationStepId,
	application: Application,
	run: CvRun | undefined,
	state: AnalysisState,
) {
	switch (step) {
		case "job-details":
			return true;
		case "review":
			return isReviewStepUnlocked(application);
		case "generate-cv":
			return isGenerateCvStepUnlocked(application, run, state);
	}
}

export function latestValidStep(
	application: Application,
	run: CvRun | undefined,
	state: AnalysisState,
): ApplicationStepId {
	if (isGenerateCvStepUnlocked(application, run, state)) {
		return "generate-cv";
	}

	if (isReviewStepUnlocked(application)) {
		return "review";
	}

	return "job-details";
}

export function resolveAllowedStep(
	requested: ApplicationStepId,
	application: Application,
	run: CvRun | undefined,
	state: AnalysisState,
): ApplicationStepId {
	if (isStepUnlocked(requested, application, run, state)) {
		return requested;
	}

	return latestValidStep(application, run, state);
}

export function parseApplicationStep(
	pathname: string,
): ApplicationStepId | undefined {
	for (const step of applicationSteps) {
		if (pathname.endsWith(`/${step.id}`)) {
			return step.id;
		}
	}

	return undefined;
}

export function applicationStepMeta(step: ApplicationStepId) {
	return (
		applicationSteps.find((entry) => entry.id === step) ?? applicationSteps[0]
	);
}
