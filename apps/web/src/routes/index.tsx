import { Button } from "@cv-tailor/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, WandSparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { applicationStepPath } from "@/lib/application-route";
import { useCvApp } from "@/lib/cv-app-context";
import { transitionForReduced, transitions } from "@/lib/motion";

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
	const reduced = useReducedMotion();
	const { t } = useTranslation();

	return (
		<div className="grid min-h-[70vh] place-items-center p-6">
			<motion.div
				initial={reduced ? false : { opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={transitionForReduced(reduced, transitions.normal)}
				className="grid max-w-md justify-items-center gap-4 text-center"
			>
				<motion.div
					initial={reduced ? false : { opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={transitionForReduced(reduced, {
						...transitions.spring,
						delay: 0.05,
					})}
					className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
				>
					<Sparkles className="size-6" />
				</motion.div>
				<div className="grid gap-1.5">
					<h2 className="font-semibold text-xl tracking-tight">
						{t("home.title")}
					</h2>
					<p className="text-muted-foreground text-sm">
						{t("home.description")}
					</p>
				</div>
				<Button size="lg" onClick={onCreate}>
					<WandSparkles /> {t("home.newApplication")}
				</Button>
			</motion.div>
		</div>
	);
}
