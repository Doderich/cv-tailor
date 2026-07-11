import { Button } from "@cv-tailor/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, WandSparkles } from "lucide-react";
import { useEffect } from "react";

import { applicationStepPath } from "@/lib/application-route";
import { useCvApp } from "@/lib/cv-app-context";

export const Route = createFileRoute("/")({
	component: HomeRoute,
});

function HomeRoute() {
	const { activeApplications, activeId, createApplication } = useCvApp();
	const navigate = useNavigate();

	useEffect(() => {
		if (activeApplications.length === 0) {
			return;
		}

		const targetId =
			activeId && activeApplications.some((item) => item.id === activeId)
				? activeId
				: activeApplications[0]?.id;

		if (targetId) {
			void navigate(applicationStepPath(targetId, "job-details"));
		}
	}, [activeApplications, activeId, navigate]);

	function handleCreate() {
		const id = createApplication();
		if (!id) {
			return;
		}

		void navigate(applicationStepPath(id, "job-details"));
	}

	if (activeApplications.length > 0) {
		return null;
	}

	return <EmptyWorkspace onCreate={handleCreate} />;
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="grid min-h-[70vh] place-items-center p-6">
			<div className="grid max-w-md justify-items-center gap-4 text-center">
				<div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
					<Sparkles className="size-6" />
				</div>
				<div className="grid gap-1.5">
					<h2 className="font-semibold text-xl tracking-tight">
						Start a new application
					</h2>
					<p className="text-muted-foreground text-sm">
						Paste a job offer, review how well your profile matches, then tailor
						and export focused CVs in English or German.
					</p>
				</div>
				<Button size="lg" onClick={onCreate}>
					<WandSparkles /> New application
				</Button>
			</div>
		</div>
	);
}
