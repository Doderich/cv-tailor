import { Tabs, TabsList, TabsTrigger } from "@cv-tailor/ui/components/tabs";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { settingsStepPath } from "@/lib/settings-route";
import {
	defaultSettingsStep,
	parseSettingsStep,
	settingsSteps,
} from "@/lib/settings-steps";

export function SettingsTabBar({ className }: { className?: string }) {
	const { t } = useTranslation();
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
						{t(step.translationKey)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
