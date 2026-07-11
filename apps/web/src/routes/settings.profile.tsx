import { createFileRoute } from "@tanstack/react-router";

import { SettingsProfileSection } from "@/components/settings/settings-sections";

export const Route = createFileRoute("/settings/profile")({
	component: SettingsProfileRoute,
});

function SettingsProfileRoute() {
	return <SettingsProfileSection />;
}
