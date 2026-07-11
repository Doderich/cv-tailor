import type { CvLanguage, JobPosition } from "@cv-tailor/core";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";

export function translateCvLanguage(language: CvLanguage) {
	return i18n.t(`cvLanguage.${language}`);
}

export function translateJobPosition(position: JobPosition) {
	return i18n.t(`jobPosition.${position}`);
}

export function useCvLanguageLabel() {
	const { t } = useTranslation();
	return (language: CvLanguage) => t(`cvLanguage.${language}`);
}

export function useJobPositionLabel() {
	const { t } = useTranslation();
	return (position: JobPosition) => t(`jobPosition.${position}`);
}

export function formatLocalizedDate(
	value: string | Date,
	options?: Intl.DateTimeFormatOptions,
) {
	const date = value instanceof Date ? value : new Date(value);
	return date.toLocaleString(i18n.language, options);
}
