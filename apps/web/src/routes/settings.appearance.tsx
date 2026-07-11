import { createFileRoute } from "@tanstack/react-router";

import { SettingsAppearanceSection } from "@/components/settings/settings-sections";

export const Route = createFileRoute("/settings/appearance")({
	component: SettingsAppearanceRoute,
});

function SettingsAppearanceRoute() {
	return <SettingsAppearanceSection />;
}
