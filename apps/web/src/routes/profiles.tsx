import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell";
import { ProfileEditor } from "@/components/cv/profile-editor";
import { ProfileImporter } from "@/components/cv/profile-importer";
import { toolIsReady, useCvApp } from "@/lib/cv-app-context";

export const Route = createFileRoute("/profiles")({
	component: ProfilesComponent,
});

function ProfilesComponent() {
	const { aiStatuses, appState, replaceProfile, selectedTool, updateProfile } =
		useCvApp();
	const profile = appState.profile;

	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="Base Profile"
				title="Profiles"
				meta={`${profile.experience.length} roles · ${profile.skills.length} skills · ${profile.projects.length} projects`}
			/>

			<div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
				<section className="grid content-start gap-4">
					<ProfileImporter
						selectedTool={selectedTool}
						canUseAi={toolIsReady(selectedTool, aiStatuses)}
						preferredTone={profile.preferredTone}
						onProfileGenerated={replaceProfile}
					/>
					<ProfileSnapshot />
				</section>

				<section className="min-w-0">
					<ProfileEditor profile={profile} onChange={updateProfile} />
				</section>
			</div>
		</div>
	);
}

function ProfileSnapshot() {
	const { appState } = useCvApp();
	const { profile } = appState;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Profile Snapshot</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 text-xs">
				<SnapshotRow label="Name" value={profile.contact.name || "Not set"} />
				<SnapshotRow label="Headline" value={profile.headline || "Not set"} />
				<SnapshotRow
					label="Target Roles"
					value={profile.targetRoles.slice(0, 3).join(", ") || "Not set"}
				/>
				<SnapshotRow
					label="Languages"
					value={profile.languages.join(", ") || "Not set"}
				/>
			</CardContent>
		</Card>
	);
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 rounded-md border p-2">
			<span className="text-muted-foreground">{label}</span>
			<span className="break-words font-medium">{value}</span>
		</div>
	);
}
