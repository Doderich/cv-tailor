import { Button } from "@cv-tailor/ui/components/button";
import { cn } from "@cv-tailor/ui/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ActionVersionItem = {
	id: string;
	label: string;
	subtitle?: string;
	meta?: string;
};

export function ActionVersionList({
	title,
	items,
	activeId,
	onSelect,
	emptyLabel,
}: {
	title: string;
	items: ActionVersionItem[];
	activeId?: string;
	onSelect: (id: string) => void;
	emptyLabel: string;
}) {
	const { t } = useTranslation();

	if (items.length === 0) {
		return (
			<div className="rounded-xl border border-dashed bg-background px-3 py-4 text-muted-foreground text-sm">
				{emptyLabel}
			</div>
		);
	}

	return (
		<section className="grid gap-2">
			<h3 className="font-medium text-sm">{title}</h3>
			<div className="grid gap-2">
				{[...items].reverse().map((item) => {
					const active = item.id === activeId;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => onSelect(item.id)}
							className={cn(
								"grid gap-1 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
								active && "ring-2 ring-primary",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="truncate font-medium">{item.label}</span>
								{active ? (
									<span className="inline-flex items-center gap-1 text-primary text-xs">
										<CheckCircle2 className="size-3.5" />
										{t("application.versions.active")}
									</span>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 px-2"
										onClick={(event) => {
											event.stopPropagation();
											onSelect(item.id);
										}}
									>
										{t("application.versions.open")}
									</Button>
								)}
							</div>
							{item.subtitle ? (
								<p className="truncate text-muted-foreground text-xs">
									{item.subtitle}
								</p>
							) : null}
							{item.meta ? (
								<p className="text-muted-foreground text-xs">{item.meta}</p>
							) : null}
						</button>
					);
				})}
			</div>
		</section>
	);
}
