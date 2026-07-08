import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type PaletteId = "graphite" | "violet" | "slate" | "amber" | "emerald";

export interface PaletteSwatch {
	background: string;
	surface: string;
	accent: string;
	foreground: string;
}

export interface PaletteOption {
	id: PaletteId;
	name: string;
	description: string;
	light: PaletteSwatch;
	dark: PaletteSwatch;
}

/**
 * Preview swatches for the picker. These mirror the tokens defined in
 * `globals.css` closely enough to communicate the vibe of each palette.
 */
export const palettes: PaletteOption[] = [
	{
		id: "graphite",
		name: "Graphite & Indigo",
		description: "Calm, neutral, unmistakably Linear.",
		light: {
			background: "#fbfbfc",
			surface: "#ffffff",
			accent: "#5a63d8",
			foreground: "#2a2a35",
		},
		dark: {
			background: "#0f1013",
			surface: "#17181c",
			accent: "#7c86f2",
			foreground: "#f3f3f5",
		},
	},
	{
		id: "violet",
		name: "Obsidian & Violet",
		description: "Premium and creative, a touch more vibrant.",
		light: {
			background: "#fbfaff",
			surface: "#ffffff",
			accent: "#7c5cff",
			foreground: "#2b2836",
		},
		dark: {
			background: "#131019",
			surface: "#1b1724",
			accent: "#9d84ff",
			foreground: "#efecf7",
		},
	},
	{
		id: "slate",
		name: "Slate & Azure",
		description: "Crisp, trustworthy, cool blue SaaS.",
		light: {
			background: "#fafbfd",
			surface: "#ffffff",
			accent: "#2563eb",
			foreground: "#28303d",
		},
		dark: {
			background: "#0f1319",
			surface: "#171c24",
			accent: "#5b8bf5",
			foreground: "#eef1f6",
		},
	},
	{
		id: "amber",
		name: "Warm Graphite & Amber",
		description: "Softer, editorial, inviting warmth.",
		light: {
			background: "#fcfaf6",
			surface: "#fffdfa",
			accent: "#e8730c",
			foreground: "#332d24",
		},
		dark: {
			background: "#1a1611",
			surface: "#221d16",
			accent: "#f0942f",
			foreground: "#f4efe6",
		},
	},
	{
		id: "emerald",
		name: "Zinc & Emerald",
		description: "Your green identity, modern and refined.",
		light: {
			background: "#fbfbfb",
			surface: "#ffffff",
			accent: "#10b981",
			foreground: "#28282b",
		},
		dark: {
			background: "#111214",
			surface: "#191a1c",
			accent: "#34d399",
			foreground: "#f2f2f3",
		},
	},
];

const storageKey = "cv-tailor-palette";
const defaultPalette: PaletteId = "graphite";

function isPaletteId(value: string | null): value is PaletteId {
	return palettes.some((palette) => palette.id === value);
}

interface PaletteContextValue {
	palette: PaletteId;
	setPalette: (palette: PaletteId) => void;
	palettes: PaletteOption[];
}

const PaletteContext = createContext<PaletteContextValue | undefined>(
	undefined,
);

export function PaletteProvider({ children }: { children: ReactNode }) {
	const [palette, setPaletteState] = useState<PaletteId>(() => {
		if (typeof window === "undefined") {
			return defaultPalette;
		}

		const stored = window.localStorage.getItem(storageKey);
		return isPaletteId(stored) ? stored : defaultPalette;
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-palette", palette);
	}, [palette]);

	const setPalette = useCallback((next: PaletteId) => {
		setPaletteState(next);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(storageKey, next);
		}
	}, []);

	return (
		<PaletteContext.Provider value={{ palette, setPalette, palettes }}>
			{children}
		</PaletteContext.Provider>
	);
}

export function usePalette() {
	const context = useContext(PaletteContext);
	if (!context) {
		throw new Error("usePalette must be used inside PaletteProvider.");
	}

	return context;
}
