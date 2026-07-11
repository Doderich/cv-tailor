import {
	cvTemplateIds,
	type CvTemplateId,
	defaultCvTemplate,
} from "@cv-tailor/core";
import { cn } from "@cv-tailor/ui/lib/utils";
import { interactiveCard } from "@cv-tailor/ui/lib/interactive-styles";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

function TemplatePreview({ template }: { template: CvTemplateId }) {
	const accent =
		template === "modern"
			? "bg-blue-600"
			: template === "sidebar" || template === "executive"
				? "bg-slate-900"
				: "bg-muted-foreground/30";

	if (template === "sidebar") {
		return (
			<div className="flex h-16 overflow-hidden rounded-lg ring-1 ring-black/5">
				<div className={cn("w-1/3 p-2", accent)}>
					<div className="mb-2 h-2 w-3/4 rounded-full bg-white/80" />
					<div className="h-1.5 w-full rounded-full bg-white/40" />
					<div className="mt-3 h-1.5 w-2/3 rounded-full bg-white/30" />
				</div>
				<div className="flex flex-1 flex-col gap-1.5 bg-card p-2">
					<div className="h-1.5 w-full rounded-full bg-muted" />
					<div className="h-1.5 w-5/6 rounded-full bg-muted" />
					<div className="mt-1 h-1.5 w-full rounded-full bg-muted/70" />
				</div>
			</div>
		);
	}

	if (template === "executive") {
		return (
			<div className="overflow-hidden rounded-lg ring-1 ring-black/5">
				<div className={cn("h-7 px-2 py-1.5", accent)}>
					<div className="h-2.5 w-2/3 rounded-full bg-white/80" />
				</div>
				<div className="flex flex-col gap-1.5 bg-card p-2">
					<div className="h-1.5 w-full rounded-full bg-muted" />
					<div className="h-1.5 w-4/5 rounded-full bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-16 flex-col gap-2 rounded-lg bg-card p-2 ring-1 ring-black/5">
			<div
				className={cn(
					"h-2 rounded-full",
					template === "classic" ? "mx-auto w-1/2" : "w-2/3",
					accent,
				)}
			/>
			<div className="h-1.5 w-full rounded-full bg-muted" />
			<div className="h-1.5 w-5/6 rounded-full bg-muted/70" />
			{template === "modern" ? (
				<div className="h-0.5 w-full rounded-full bg-blue-600/40" />
			) : null}
		</div>
	);
}

function TemplateCard({
	template,
	selected,
	onSelect,
}: {
	template: CvTemplateId;
	selected: boolean;
	onSelect: () => void;
}) {
	const { t } = useTranslation();

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			className={cn(
				"group relative grid gap-2.5 rounded-xl border bg-card p-3 text-left",
				interactiveCard,
				selected ? "border-primary ring-2 ring-primary/30" : "border-border",
			)}
		>
			<TemplatePreview template={template} />
			<div className="grid gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-sm">
						{t(`cv.template.${template}.label`)}
					</span>
					{selected ? (
						<span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
							<Check className="size-3" />
						</span>
					) : null}
				</div>
				<span className="text-muted-foreground text-xs">
					{t(`cv.template.${template}.description`)}
				</span>
			</div>
		</button>
	);
}

export function CvTemplatePicker({
	value = defaultCvTemplate,
	onChange,
	className,
}: {
	value?: CvTemplateId;
	onChange: (template: CvTemplateId) => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
				className,
			)}
		>
			{cvTemplateIds.map((template) => (
				<TemplateCard
					key={template}
					template={template}
					selected={value === template}
					onSelect={() => onChange(template)}
				/>
			))}
		</div>
	);
}
