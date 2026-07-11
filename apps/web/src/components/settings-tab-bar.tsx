import { Tabs, TabsList, TabsTrigger } from "@cv-tailor/ui/components/tabs";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { settingsStepPath } from "@/lib/settings-route";
import {
	defaultSettingsStep,
	parseSettingsStep,
	settingsSteps,
} from "@/lib/settings-steps";

export function SettingsTabBar({ className }: { className?: string }) {
	const navigate = useNavigate();
	const currentStep = useRouterState({
		select: (state) => parseSettingsStep(state.location.pathname),
	});
	const value = currentStep ?? defaultSettingsStep;

	return (
		<Tabs value={value} className={cn("gap-0", className)}>
			<TabsList
				variant="line"
				className="h-9 w-auto justify-start bg-transparent"
			>
				{settingsSteps.map((step) => (
					<TabsTrigger
						key={step.id}
						value={step.id}
						onClick={() => {
							if (step.id !== value) {
								void navigate(settingsStepPath(step.id));
							}
						}}
					>
						{step.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
