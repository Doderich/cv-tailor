import type { Application, BaseProfile, CvRun } from "@cv-tailor/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface PrintableCvProps {
	profile: BaseProfile;
	application: Application | undefined;
	run: CvRun | undefined;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="print-section">
			<h2>{title}</h2>
			{children}
		</section>
	);
}

function BulletList({ items }: { items: string[] }) {
	if (items.length === 0) {
		return null;
	}

	return (
		<ul>
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

export function PrintableCv({
	profile,
	application: _application,
	run,
}: PrintableCvProps) {
	const { t } = useTranslation();
	const cv = run?.cv;

	if (!cv) {
		return null;
	}

	const includedEducation = profile.education.filter((item) =>
		cv.educationIds.includes(item.id),
	);

	return (
		<article className="print-cv">
			<header>
				<h1>{profile.contact.name || t("cv.print.nameFallback")}</h1>
				<p className="print-headline">{profile.headline}</p>
				<p className="print-contact">
					{[
						profile.contact.email,
						profile.contact.phone,
						profile.contact.location,
						...profile.contact.links,
					]
						.filter(Boolean)
						.join("  ·  ")}
				</p>
			</header>

			<Section title={t("cv.section.summary")}>
				<p>{cv.summary}</p>
			</Section>

			<Section title={t("cv.section.skills")}>
				<p>{cv.skills.join("  ·  ")}</p>
			</Section>

			<Section title={t("cv.section.experience")}>
				{cv.experience.map((tailoredItem) => {
					const source = profile.experience.find(
						(item) => item.id === tailoredItem.experienceId,
					);

					if (!source) {
						return null;
					}

					return (
						<div key={source.id} className="print-item">
							<div className="print-item-heading">
								<strong>
									{source.title}
									{source.company ? ` · ${source.company}` : ""}
								</strong>
								<span>
									{joinDateRange(
										source.startDate,
										source.endDate,
										source.current,
										t("cv.present"),
									)}
								</span>
							</div>
							<div className="print-item-meta">
								{[source.location, source.technologies.join(", ")]
									.filter(Boolean)
									.join("  ·  ")}
							</div>
							<BulletList items={tailoredItem.bullets} />
						</div>
					);
				})}
			</Section>

			{cv.projects.length > 0 ? (
				<Section title={t("cv.section.projects")}>
					{cv.projects.map((tailoredItem) => {
						const source = profile.projects.find(
							(item) => item.id === tailoredItem.projectId,
						);

						if (!source) {
							return null;
						}

						return (
							<div key={source.id} className="print-item">
								<div className="print-item-heading">
									<strong>{source.name}</strong>
									<span>{source.role}</span>
								</div>
								<div className="print-item-meta">
									{[source.url, source.technologies.join(", ")]
										.filter(Boolean)
										.join("  ·  ")}
								</div>
								<p>{source.description}</p>
								<BulletList items={tailoredItem.bullets} />
							</div>
						);
					})}
				</Section>
			) : null}

			{includedEducation.length > 0 ? (
				<Section title={t("cv.section.education")}>
					{includedEducation.map((item) => (
						<div key={item.id} className="print-item">
							<div className="print-item-heading">
								<strong>{item.degree || item.institution}</strong>
								<span>
									{joinDateRange(
										item.startDate,
										item.endDate,
										false,
										t("cv.present"),
									)}
								</span>
							</div>
							<div className="print-item-meta">
								{[item.institution, item.location]
									.filter(Boolean)
									.join("  ·  ")}
							</div>
							<BulletList items={item.details} />
						</div>
					))}
				</Section>
			) : null}

			{profile.languages.length > 0 ? (
				<Section title={t("cv.section.languages")}>
					<p>{profile.languages.join("  ·  ")}</p>
				</Section>
			) : null}
		</article>
	);
}
