import { createFileRoute } from "@tanstack/react-router";

import { JobDetailsStep } from "@/components/application-workspace";
import {
	useApplicationRouteContext,
	useApplicationStepGuard,
} from "@/lib/application-route";

export const Route = createFileRoute("/application/$id/job-details")({
	component: JobDetailsRoute,
});

function JobDetailsRoute() {
	useApplicationStepGuard("job-details");
	const { application } = useApplicationRouteContext();

	if (!application) {
		return null;
	}

	return <JobDetailsStep application={application} />;
}
