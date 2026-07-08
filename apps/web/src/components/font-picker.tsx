import { cn } from "@cv-tailor/ui/lib/utils";
import { Check } from "lucide-react";

import {
	type FontFamilyOption,
	useFontFamily,
} from "@/components/font-family-provider";

function FontPreview({ option }: { option: FontFamilyOption }) {
	return (
		<div className="grid gap-1 rounded-lg border bg-background/80 p-3">
			<p
				className="text-base leading-tight"
				style={{ fontFamily: option.heading }}
			>
				CV Tailor
			</p>
			<p
				className="text-muted-foreground text-sm leading-snug"
				style={{ fontFamily: option.sans }}
			>
				{option.preview}
			</p>
		</div>
	);
}

function FontCard({
	option,
	selected,
	onSelect,
}: {
	option: FontFamilyOption;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			className={cn(
				"group relative grid gap-2.5 rounded-xl border bg-card p-3 text-left transition-all hover:border-ring/60 hover:shadow-sm",
				selected ? "border-primary ring-2 ring-primary/30" : "border-border",
			)}
		>
			<FontPreview option={option} />
			<div className="grid gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-sm">{option.label}</span>
					{selected ? (
						<span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
							<Check className="size-3" />
						</span>
					) : null}
				</div>
				<span className="text-muted-foreground text-xs">
					{option.description}
				</span>
			</div>
		</button>
	);
}

export function FontPicker() {
	const { fontFamily, setFontFamily, fontFamilyOptions } = useFontFamily();

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{fontFamilyOptions.map((option) => (
				<FontCard
					key={option.id}
					option={option}
					selected={fontFamily === option.id}
					onSelect={() => setFontFamily(option.id)}
				/>
			))}
		</div>
	);
}
