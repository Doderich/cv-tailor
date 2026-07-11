import { Tabs, TabsList, TabsTrigger } from "@cv-tailor/ui/components/tabs";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { applicationStepPath } from "@/lib/application-route";
import {
	applicationSteps,
	isStepUnlocked,
	parseApplicationStep,
} from "@/lib/application-steps";
import { useCvApp } from "@/lib/cv-app-context";

export function ApplicationStepTabBar({
	applicationId,
	className,
}: {
	applicationId: string;
	className?: string;
}) {
	const navigate = useNavigate();
	const {
		applications,
		activeRun,
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		canUseSelectedAi,
	} = useCvApp();
	const application = applications.find((item) => item.id === applicationId);
	const currentStep = useRouterState({
		select: (state) => parseApplicationStep(state.location.pathname),
	});
	const analysisState = {
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		canUseSelectedAi,
	};
	const value = currentStep ?? "job-details";

	if (!application) {
		return null;
	}

	return (
		<Tabs value={value} className={cn("gap-0", className)}>
			<TabsList
				variant="line"
				className="h-9 w-auto justify-start bg-transparent"
			>
				{applicationSteps.map((step) => {
					const unlocked = isStepUnlocked(
						step.id,
						application,
						activeRun,
						analysisState,
					);

					return (
						<TabsTrigger
							key={step.id}
							value={step.id}
							disabled={!unlocked}
							title={unlocked ? undefined : "Complete the previous step first"}
							onClick={() => {
								if (unlocked && step.id !== value) {
									void navigate(applicationStepPath(applicationId, step.id));
								}
							}}
						>
							{step.label}
						</TabsTrigger>
					);
				})}
			</TabsList>
		</Tabs>
	);
}
