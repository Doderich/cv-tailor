import { createFileRoute, redirect } from "@tanstack/react-router";

import { defaultSettingsStep } from "@/lib/settings-steps";

export const Route = createFileRoute("/settings/")({
	beforeLoad: () => {
		throw redirect({
			to: `/settings/${defaultSettingsStep}`,
		});
	},
});
