import { Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { transitionForReduced, transitions } from "@/lib/motion";

export function AnimatedPage() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const reduced = useReducedMotion();

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={pathname}
				initial={reduced ? false : { opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				exit={reduced ? undefined : { opacity: 0 }}
				transition={transitionForReduced(reduced, transitions.page)}
				className="min-h-0"
			>
				<Outlet />
			</motion.div>
		</AnimatePresence>
	);
}
