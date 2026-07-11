import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import de from "./locales/de.json";
import en from "./locales/en.json";

export const supportedUiLanguages = ["en", "de"] as const;
export type UiLanguage = (typeof supportedUiLanguages)[number];

export const uiLanguageStorageKey = "cv-tailor-ui-language";

export function isUiLanguage(value: string | null | undefined): value is UiLanguage {
	return supportedUiLanguages.includes(value as UiLanguage);
}

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			de: { translation: de },
		},
		fallbackLng: "en",
		supportedLngs: [...supportedUiLanguages],
		interpolation: {
			escapeValue: false,
		},
		detection: {
			order: ["localStorage", "navigator"],
			lookupLocalStorage: uiLanguageStorageKey,
			caches: ["localStorage"],
		},
	});

i18n.on("languageChanged", (language) => {
	document.documentElement.lang = language;
});

if (typeof document !== "undefined") {
	document.documentElement.lang = i18n.language;
}

export default i18n;
