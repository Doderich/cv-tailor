import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { useApplicationRouteContext } from "@/lib/application-route";

export const Route = createFileRoute("/application/$id")({
	component: ApplicationLayout,
});

function ApplicationLayout() {
	const { application } = useApplicationRouteContext();

	if (!application) {
		return null;
	}

	return <Outlet />;
}
