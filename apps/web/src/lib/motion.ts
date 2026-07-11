import type { Transition } from "motion/react";

export const easeOut = [0.32, 0.72, 0, 1] as const;

export const transitions = {
	fast: { duration: 0.15, ease: easeOut } satisfies Transition,
	normal: { duration: 0.22, ease: easeOut } satisfies Transition,
	page: { duration: 0.12, ease: easeOut } satisfies Transition,
	spring: { type: "spring", stiffness: 380, damping: 32 } satisfies Transition,
	drawer: { type: "spring", stiffness: 420, damping: 36 } satisfies Transition,
	sidebar: {
		type: "spring",
		stiffness: 850,
		damping: 52,
		mass: 0.3,
	} satisfies Transition,
} as const;

export function transitionForReduced(
	reduced: boolean | null,
	transition: Transition,
): Transition {
	return reduced ? { duration: 0 } : transition;
}
