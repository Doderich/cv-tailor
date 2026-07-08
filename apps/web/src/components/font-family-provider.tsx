import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type FontFamilyId = "product" | "editorial" | "magazine" | "literary";

export interface FontFamilyOption {
	id: FontFamilyId;
	label: string;
	description: string;
	sans: string;
	heading: string;
	googleFonts: string;
	preview: string;
}

export const fontFamilyOptions: FontFamilyOption[] = [
	{
		id: "product",
		label: "Product",
		description: "Neutral sans-serif for dense UI work.",
		sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
		heading: '"Inter", ui-sans-serif, system-ui, sans-serif',
		googleFonts:
			"https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap",
		preview: "Clear and efficient",
	},
	{
		id: "editorial",
		label: "Editorial",
		description: "Readable serif body with expressive display headings.",
		sans: '"Source Serif 4", ui-serif, Georgia, serif',
		heading: '"Fraunces", ui-serif, Georgia, serif',
		googleFonts:
			"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap",
		preview: "Refined and literary",
	},
	{
		id: "magazine",
		label: "Magazine",
		description: "Newsreader text with sharp instrument-serif titles.",
		sans: '"Newsreader", ui-serif, Georgia, serif',
		heading: '"Instrument Serif", ui-serif, Georgia, serif',
		googleFonts:
			"https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:opsz,wght@6..72,400..600&display=swap",
		preview: "Contemporary editorial",
	},
	{
		id: "literary",
		label: "Literary",
		description: "Warm classic serif throughout, like a printed CV.",
		sans: '"Lora", ui-serif, Georgia, serif',
		heading: '"Lora", ui-serif, Georgia, serif',
		googleFonts:
			"https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap",
		preview: "Timeless and personal",
	},
];

const storageKey = "cv-tailor-font-family";
const defaultFontFamily: FontFamilyId = "editorial";
const fontLinkId = "cv-tailor-fonts";

function isFontFamilyId(value: string | null): value is FontFamilyId {
	return fontFamilyOptions.some((option) => option.id === value);
}

function applyFontFamily(option: FontFamilyOption) {
	const root = document.documentElement;
	root.style.setProperty("--font-sans", option.sans);
	root.style.setProperty("--font-heading", option.heading);
	root.dataset.fontFamily = option.id;

	let link = document.getElementById(fontLinkId) as HTMLLinkElement | null;
	if (!link) {
		link = document.createElement("link");
		link.id = fontLinkId;
		link.rel = "stylesheet";
		document.head.appendChild(link);
	}
	link.href = option.googleFonts;
}

interface FontFamilyContextValue {
	fontFamily: FontFamilyId;
	setFontFamily: (fontFamily: FontFamilyId) => void;
	fontFamilyOptions: FontFamilyOption[];
}

const FontFamilyContext = createContext<FontFamilyContextValue | undefined>(
	undefined,
);

export function FontFamilyProvider({ children }: { children: ReactNode }) {
	const [fontFamily, setFontFamilyState] = useState<FontFamilyId>(() => {
		if (typeof window === "undefined") {
			return defaultFontFamily;
		}

		const stored = window.localStorage.getItem(storageKey);
		return isFontFamilyId(stored) ? stored : defaultFontFamily;
	});

	useEffect(() => {
		const option =
			fontFamilyOptions.find((entry) => entry.id === fontFamily) ??
			fontFamilyOptions[1];
		applyFontFamily(option);
	}, [fontFamily]);

	const setFontFamily = useCallback((next: FontFamilyId) => {
		setFontFamilyState(next);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(storageKey, next);
		}
	}, []);

	return (
		<FontFamilyContext.Provider
			value={{ fontFamily, setFontFamily, fontFamilyOptions }}
		>
			{children}
		</FontFamilyContext.Provider>
	);
}

export function useFontFamily() {
	const context = useContext(FontFamilyContext);
	if (!context) {
		throw new Error("useFontFamily must be used inside FontFamilyProvider.");
	}

	return context;
}
