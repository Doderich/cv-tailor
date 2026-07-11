export const interactiveTransition =
	"transition-[transform,box-shadow,background-color,border-color,color,filter,opacity] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none motion-reduce:transform-none motion-reduce:shadow-none";

export const interactiveButton =
	"active:not-aria-[haspopup]:scale-[0.97] hover:not-aria-[haspopup]:-translate-y-0.5 hover:not-aria-[haspopup]:shadow-md active:not-aria-[haspopup]:translate-y-0 active:not-aria-[haspopup]:shadow-sm";

export const interactiveFocusGlow =
	"focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--ring)_14%,transparent)]";

export const interactiveField =
	`hover:border-ring/45 hover:shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/45 ${interactiveFocusGlow} active:scale-[0.998] dark:hover:bg-input/45`;

export const interactiveMenuItem =
	"hover:bg-accent/75 active:scale-[0.99] active:bg-accent";

export const interactiveCheckbox =
	"hover:border-ring/50 hover:shadow-sm active:scale-95 data-checked:hover:brightness-110";

export const interactiveTab =
	"hover:bg-background/55 active:scale-[0.98] data-active:shadow-sm";

export const interactiveSegment =
	`${interactiveTransition} hover:bg-muted/80 active:scale-[0.98]`;

export const interactiveCard =
	`${interactiveTransition} hover:border-ring/60 hover:shadow-sm active:scale-[0.99]`;

export const interactiveListItem =
	`${interactiveTransition} active:scale-[0.995]`;
