import { createFileRoute } from "@tanstack/react-router";

import { SettingsAiSection } from "@/components/settings/settings-sections";

export const Route = createFileRoute("/settings/ai")({
	component: SettingsAiRoute,
});

function SettingsAiRoute() {
	return <SettingsAiSection />;
}
