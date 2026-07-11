import {
	getRouteApi,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import {
	type AnalysisState,
	type ApplicationStepId,
	parseApplicationStep,
	resolveAllowedStep,
} from "@/lib/application-steps";
import { useCvApp } from "@/lib/cv-app-context";

const applicationRouteApi = getRouteApi("/application/$id");

export function applicationStepPath(
	id: string,
	step: ApplicationStepId = "job-details",
) {
	return {
		to: `/application/$id/${step}` as const,
		params: { id },
	};
}

/** @deprecated Use applicationStepPath */
export function applicationPath(
	id: string,
	step: ApplicationStepId = "job-details",
) {
	return applicationStepPath(id, step);
}

export function useApplicationAnalysisState(): AnalysisState {
	const { isReviewingJobOffer, isAnalyzingProfileMatch, canUseSelectedAi } =
		useCvApp();

	return {
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		canUseSelectedAi,
	};
}

export function useApplicationRouteContext() {
	const { id } = applicationRouteApi.useParams();
	const navigate = useNavigate();
	const { applications, activeRun, openApplication, ...appState } = useCvApp();
	const analysisState = useApplicationAnalysisState();
	const application = applications.find((item) => item.id === id);
	const currentStep = useRouterState({
		select: (state) => parseApplicationStep(state.location.pathname),
	});

	useEffect(() => {
		if (!application) {
			return;
		}

		openApplication(application.id);
	}, [application, openApplication]);

	useEffect(() => {
		if (applications.length === 0) {
			void navigate({ to: "/" });
			return;
		}

		if (!application) {
			void navigate({ to: "/" });
		}
	}, [application, applications.length, navigate]);

	return {
		id,
		application,
		activeRun,
		currentStep,
		analysisState,
		navigate,
		...appState,
	};
}

export function useApplicationStepGuard(step: ApplicationStepId) {
	const { application, activeRun, analysisState, navigate, id } =
		useApplicationRouteContext();

	useEffect(() => {
		if (!application) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			const allowed = resolveAllowedStep(
				step,
				application,
				activeRun,
				analysisState,
			);

			if (allowed !== step) {
				void navigate(applicationStepPath(id, allowed));
			}
		});

		return () => cancelAnimationFrame(frame);
	}, [activeRun, analysisState, application, id, navigate, step]);
}
