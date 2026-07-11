import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/application/$id/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/application/$id/job-details",
			params,
		});
	},
});
