import { cn } from "@cv-tailor/ui/lib/utils";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	type PaletteOption,
	type PaletteSwatch,
	usePalette,
} from "@/components/palette-provider";
import { useTheme } from "@/components/theme-provider";

function SwatchPreview({ swatch }: { swatch: PaletteSwatch }) {
	return (
		<div
			className="flex h-16 items-end gap-1.5 rounded-lg p-2 ring-1 ring-black/5"
			style={{ backgroundColor: swatch.background }}
		>
			<span
				className="h-full w-8 rounded-md"
				style={{ backgroundColor: swatch.surface }}
			/>
			<div className="flex flex-1 flex-col justify-end gap-1">
				<span
					className="h-2 w-3/4 rounded-full"
					style={{ backgroundColor: swatch.accent }}
				/>
				<span
					className="h-2 w-1/2 rounded-full opacity-40"
					style={{ backgroundColor: swatch.foreground }}
				/>
			</div>
			<span
				className="size-6 shrink-0 rounded-full"
				style={{ backgroundColor: swatch.accent }}
			/>
		</div>
	);
}

function PaletteCard({
	option,
	isDark,
	selected,
	onSelect,
	name,
	description,
}: {
	option: PaletteOption;
	isDark: boolean;
	selected: boolean;
	onSelect: () => void;
	name: string;
	description: string;
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
			<SwatchPreview swatch={isDark ? option.dark : option.light} />
			<div className="grid gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-sm">{name}</span>
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

export function PalettePicker() {
	const { t } = useTranslation();
	const { palette, setPalette, palettes } = usePalette();
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{palettes.map((option) => (
				<PaletteCard
					key={option.id}
					option={option}
					isDark={isDark}
					selected={palette === option.id}
					onSelect={() => setPalette(option.id)}
					name={t(`palette.${option.id}.name`)}
					description={t(`palette.${option.id}.description`)}
				/>
			))}
		</div>
	);
}
