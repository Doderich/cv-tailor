import { createFileRoute } from "@tanstack/react-router";

import { SettingsDataSection } from "@/components/settings/settings-sections";

export const Route = createFileRoute("/settings/data")({
	component: SettingsDataRoute,
});

function SettingsDataRoute() {
	return <SettingsDataSection />;
}
