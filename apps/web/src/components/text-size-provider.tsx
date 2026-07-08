import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type TextSizeId = "small" | "default" | "large" | "larger";

export interface TextSizeOption {
	id: TextSizeId;
	label: string;
	scale: string;
}

export const textSizeOptions: TextSizeOption[] = [
	{ id: "small", label: "Small", scale: "87.5%" },
	{ id: "default", label: "Default", scale: "100%" },
	{ id: "large", label: "Large", scale: "112.5%" },
	{ id: "larger", label: "Larger", scale: "125%" },
];

const storageKey = "cv-tailor-text-size";
const defaultTextSize: TextSizeId = "default";

function isTextSizeId(value: string | null): value is TextSizeId {
	return textSizeOptions.some((option) => option.id === value);
}

interface TextSizeContextValue {
	textSize: TextSizeId;
	setTextSize: (textSize: TextSizeId) => void;
	textSizeOptions: TextSizeOption[];
}

const TextSizeContext = createContext<TextSizeContextValue | undefined>(
	undefined,
);

export function TextSizeProvider({ children }: { children: ReactNode }) {
	const [textSize, setTextSizeState] = useState<TextSizeId>(() => {
		if (typeof window === "undefined") {
			return defaultTextSize;
		}

		const stored = window.localStorage.getItem(storageKey);
		return isTextSizeId(stored) ? stored : defaultTextSize;
	});

	useEffect(() => {
		const scale =
			textSizeOptions.find((option) => option.id === textSize)?.scale ??
			"100%";
		document.documentElement.style.fontSize = scale;
		document.documentElement.dataset.textSize = textSize;
	}, [textSize]);

	const setTextSize = useCallback((next: TextSizeId) => {
		setTextSizeState(next);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(storageKey, next);
		}
	}, []);

	return (
		<TextSizeContext.Provider
			value={{ textSize, setTextSize, textSizeOptions }}
		>
			{children}
		</TextSizeContext.Provider>
	);
}

export function useTextSize() {
	const context = useContext(TextSizeContext);
	if (!context) {
		throw new Error("useTextSize must be used inside TextSizeProvider.");
	}

	return context;
}
