import { cn } from "@cv-tailor/ui/lib/utils";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
	type FontFamilyOption,
	useFontFamily,
} from "@/components/font-family-provider";

function FontPreview({
	option,
	previewBrand,
	previewText,
}: {
	option: FontFamilyOption;
	previewBrand: string;
	previewText: string;
}) {
	return (
		<div className="grid gap-1 rounded-lg border bg-background/80 p-3">
			<p
				className="text-base leading-tight"
				style={{ fontFamily: option.heading }}
			>
				{previewBrand}
			</p>
			<p
				className="text-muted-foreground text-sm leading-snug"
				style={{ fontFamily: option.sans }}
			>
				{previewText}
			</p>
		</div>
	);
}

function FontCard({
	option,
	selected,
	onSelect,
	label,
	description,
	previewText,
	previewBrand,
}: {
	option: FontFamilyOption;
	selected: boolean;
	onSelect: () => void;
	label: string;
	description: string;
	previewText: string;
	previewBrand: string;
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
			<FontPreview
				option={option}
				previewBrand={previewBrand}
				previewText={previewText}
			/>
			<div className="grid gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-sm">{label}</span>
					{selected ? (
						<span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
							<Check className="size-3" />
						</span>
					) : null}
				</div>
				<span className="text-muted-foreground text-xs">{description}</span>
			</div>
		</button>
	);
}

export function FontPicker() {
	const { t } = useTranslation();
	const { fontFamily, setFontFamily, fontFamilyOptions } = useFontFamily();
	const previewBrand = t("font.previewBrand");

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{fontFamilyOptions.map((option) => (
				<FontCard
					key={option.id}
					option={option}
					selected={fontFamily === option.id}
					onSelect={() => setFontFamily(option.id)}
					label={t(`font.${option.id}.label`)}
					description={t(`font.${option.id}.description`)}
					previewText={t(`font.${option.id}.preview`)}
					previewBrand={previewBrand}
				/>
			))}
		</div>
	);
}
