import { createFileRoute } from "@tanstack/react-router";

import { ReviewStep } from "@/components/application-workspace";
import {
	useApplicationRouteContext,
	useApplicationStepGuard,
} from "@/lib/application-route";

export const Route = createFileRoute("/application/$id/review")({
	component: ReviewRoute,
});

function ReviewRoute() {
	useApplicationStepGuard("review");
	const { application, activeRun } = useApplicationRouteContext();

	if (!application) {
		return null;
	}

	return <ReviewStep application={application} run={activeRun} />;
}
