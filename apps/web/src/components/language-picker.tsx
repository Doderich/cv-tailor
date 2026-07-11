import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { useTranslation } from "react-i18next";

import {
	isUiLanguage,
	supportedUiLanguages,
	type UiLanguage,
	uiLanguageStorageKey,
} from "@/i18n";

const uiLanguageLabels: Record<UiLanguage, string> = {
	en: "English",
	de: "Deutsch",
};

export function LanguagePicker() {
	const { i18n, t } = useTranslation();
	const value = isUiLanguage(i18n.language) ? i18n.language : "en";

	return (
		<Select
			value={value}
			onValueChange={(next) => {
				if (!next || !isUiLanguage(next)) {
					return;
				}

				void i18n.changeLanguage(next);
				window.localStorage.setItem(uiLanguageStorageKey, next);
			}}
		>
			<SelectTrigger className="max-w-xs" size="sm" aria-label={t("settings.appearance.language")}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{supportedUiLanguages.map((language) => (
					<SelectItem key={language} value={language}>
						{uiLanguageLabels[language]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
