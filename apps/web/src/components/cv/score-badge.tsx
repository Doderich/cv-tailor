import { cn } from "@cv-tailor/ui/lib/utils";

function toneForScore(score: number) {
	if (score >= 70) {
		return "border-transparent bg-primary/15 text-primary";
	}

	if (score >= 40) {
		return "border-transparent bg-accent text-accent-foreground";
	}

	return "border-transparent bg-destructive/15 text-destructive";
}

export function ScoreBadge({
	score,
	className,
	label,
}: {
	score: number;
	className?: string;
	label?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs tabular-nums",
				toneForScore(score),
				className,
			)}
		>
			{score}%{label ? <span className="opacity-70">{label}</span> : null}
		</span>
	);
}
