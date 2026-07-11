import type { Application, BaseProfile, CvRun } from "@cv-tailor/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export interface ResolvedExperienceItem {
	id: string;
	title: string;
	company: string;
	location: string;
	technologies: string;
	dateRange: string;
	bullets: string[];
}

export interface ResolvedProjectItem {
	id: string;
	name: string;
	role: string;
	url: string;
	technologies: string;
	description: string;
	bullets: string[];
}

export interface ResolvedEducationItem {
	id: string;
	degree: string;
	institution: string;
	location: string;
	dateRange: string;
	details: string[];
}

export interface ResolvedCvLabels {
	summary: string;
	skills: string;
	experience: string;
	projects: string;
	education: string;
	languages: string;
	present: string;
	nameFallback: string;
}

export interface ResolvedCvContent {
	name: string;
	headline: string;
	contactLine: string[];
	summary: string;
	skills: string[];
	experience: ResolvedExperienceItem[];
	projects: ResolvedProjectItem[];
	education: ResolvedEducationItem[];
	languages: string[];
	labels: ResolvedCvLabels;
}

function joinDateRange(
	startDate: string,
	endDate: string,
	current = false,
	presentLabel = "Present",
) {
	const end = current ? presentLabel : endDate;
	return [startDate, end].filter(Boolean).join(" – ");
}

export function useResolvedCvContent({
	profile,
	run,
	nameFallbackKey = "cv.preview.nameFallback",
}: {
	profile: BaseProfile;
	application: Application | undefined;
	run: CvRun | undefined;
	nameFallbackKey?: string;
}): ResolvedCvContent | null {
	const { t } = useTranslation();
	const cv = run?.cv;

	return useMemo(() => {
		if (!cv) {
			return null;
		}

		const presentLabel = t("cv.present");
		const labels: ResolvedCvLabels = {
			summary: t("cv.section.summary"),
			skills: t("cv.section.skills"),
			experience: t("cv.section.experience"),
			projects: t("cv.section.projects"),
			education: t("cv.section.education"),
			languages: t("cv.section.languages"),
			present: presentLabel,
			nameFallback: t(nameFallbackKey),
		};

		const includedEducation = profile.education.filter((item) =>
			cv.educationIds.includes(item.id),
		);

		return {
			name: profile.contact.name || labels.nameFallback,
			headline: profile.headline,
			contactLine: [
				profile.contact.email,
				profile.contact.phone,
				profile.contact.location,
				...profile.contact.links,
			].filter(Boolean),
			summary: cv.summary,
			skills: cv.skills,
			experience: cv.experience
				.map((tailoredItem) => {
					const source = profile.experience.find(
						(item) => item.id === tailoredItem.experienceId,
					);
					if (!source) {
						return null;
					}

					return {
						id: source.id,
						title: source.title,
						company: source.company,
						location: source.location,
						technologies: source.technologies.join(", "),
						dateRange: joinDateRange(
							source.startDate,
							source.endDate,
							source.current,
							presentLabel,
						),
						bullets: tailoredItem.bullets,
					};
				})
				.filter((item): item is ResolvedExperienceItem => item !== null),
			projects: cv.projects
				.map((tailoredItem) => {
					const source = profile.projects.find(
						(item) => item.id === tailoredItem.projectId,
					);
					if (!source) {
						return null;
					}

					return {
						id: source.id,
						name: source.name,
						role: source.role,
						url: source.url,
						technologies: source.technologies.join(", "),
						description: source.description,
						bullets: tailoredItem.bullets,
					};
				})
				.filter((item): item is ResolvedProjectItem => item !== null),
			education: includedEducation.map((item) => ({
				id: item.id,
				degree: item.degree || item.institution,
				institution: item.institution,
				location: item.location,
				dateRange: joinDateRange(
					item.startDate,
					item.endDate,
					false,
					presentLabel,
				),
				details: item.details,
			})),
			languages: profile.languages,
			labels,
		};
	}, [cv, nameFallbackKey, profile, t]);
}
