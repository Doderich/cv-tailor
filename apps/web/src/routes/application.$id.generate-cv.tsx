import { createFileRoute } from "@tanstack/react-router";

import { GenerateCvStep } from "@/components/application-workspace";
import {
	useApplicationRouteContext,
	useApplicationStepGuard,
} from "@/lib/application-route";

export const Route = createFileRoute("/application/$id/generate-cv")({
	component: GenerateCvRoute,
});

function GenerateCvRoute() {
	useApplicationStepGuard("generate-cv");
	const { application, activeRun } = useApplicationRouteContext();

	if (!application) {
		return null;
	}

	return <GenerateCvStep application={application} run={activeRun} />;
}
