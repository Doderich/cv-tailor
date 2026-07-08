import type { BaseProfile, GeneratedCv } from "@cv-tailor/core";
import type { ReactNode } from "react";

function joinDateRange(startDate: string, endDate: string, current = false) {
	const end = current ? "Present" : endDate;
	return [startDate, end].filter(Boolean).join(" – ");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="grid gap-2">
			<h2 className="border-b pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-widest">
				{title}
			</h2>
			{children}
		</section>
	);
}

function Bullets({ items }: { items: string[] }) {
	if (items.length === 0) {
		return null;
	}

	return (
		<ul className="ml-4 grid list-disc gap-1 text-sm marker:text-muted-foreground">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

export function CvPreview({
	profile,
	generatedCv,
}: {
	profile: BaseProfile;
	generatedCv: GeneratedCv | undefined;
}) {
	const cv = generatedCv?.cv;

	if (!cv) {
		return null;
	}

	const includedEducation = profile.education.filter((item) =>
		cv.educationIds.includes(item.id),
	);
	const contactLine = [
		profile.contact.email,
		profile.contact.phone,
		profile.contact.location,
		...profile.contact.links,
	].filter(Boolean);

	return (
		<article className="mx-auto grid max-w-2xl gap-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm ring-1 ring-foreground/5">
			<header className="grid gap-1 text-center">
				<h1 className="font-semibold text-2xl tracking-tight">
					{profile.contact.name || "Your name"}
				</h1>
				{profile.headline ? (
					<p className="text-muted-foreground text-sm">{profile.headline}</p>
				) : null}
				{contactLine.length > 0 ? (
					<p className="text-muted-foreground text-xs">
						{contactLine.join("  ·  ")}
					</p>
				) : null}
			</header>

			{cv.summary ? (
				<Section title="Summary">
					<p className="text-sm leading-relaxed">{cv.summary}</p>
				</Section>
			) : null}

			{cv.skills.length > 0 ? (
				<Section title="Skills">
					<div className="flex flex-wrap gap-1.5">
						{cv.skills.map((skill) => (
							<span
								key={skill}
								className="rounded-md bg-muted px-2 py-0.5 text-xs"
							>
								{skill}
							</span>
						))}
					</div>
				</Section>
			) : null}

			{cv.experience.length > 0 ? (
				<Section title="Experience">
					<div className="grid gap-4">
						{cv.experience.map((tailored) => {
							const source = profile.experience.find(
								(item) => item.id === tailored.experienceId,
							);
							if (!source) {
								return null;
							}

							return (
								<div key={source.id} className="grid gap-1">
									<div className="flex items-baseline justify-between gap-3">
										<p className="font-medium text-sm">
											{source.title}
											{source.company ? ` · ${source.company}` : ""}
										</p>
										<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
											{joinDateRange(
												source.startDate,
												source.endDate,
												source.current,
											)}
										</span>
									</div>
									<Bullets items={tailored.bullets} />
								</div>
							);
						})}
					</div>
				</Section>
			) : null}

			{cv.projects.length > 0 ? (
				<Section title="Projects">
					<div className="grid gap-4">
						{cv.projects.map((tailored) => {
							const source = profile.projects.find(
								(item) => item.id === tailored.projectId,
							);
							if (!source) {
								return null;
							}

							return (
								<div key={source.id} className="grid gap-1">
									<div className="flex items-baseline justify-between gap-3">
										<p className="font-medium text-sm">{source.name}</p>
										<span className="shrink-0 text-muted-foreground text-xs">
											{source.role}
										</span>
									</div>
									{source.description ? (
										<p className="text-muted-foreground text-sm">
											{source.description}
										</p>
									) : null}
									<Bullets items={tailored.bullets} />
								</div>
							);
						})}
					</div>
				</Section>
			) : null}

			{includedEducation.length > 0 ? (
				<Section title="Education">
					<div className="grid gap-3">
						{includedEducation.map((item) => (
							<div key={item.id} className="grid gap-0.5">
								<div className="flex items-baseline justify-between gap-3">
									<p className="font-medium text-sm">
										{item.degree || item.institution}
									</p>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{joinDateRange(item.startDate, item.endDate)}
									</span>
								</div>
								{item.institution && item.degree ? (
									<p className="text-muted-foreground text-xs">
										{item.institution}
									</p>
								) : null}
								<Bullets items={item.details} />
							</div>
						))}
					</div>
				</Section>
			) : null}

			{profile.languages.length > 0 ? (
				<Section title="Languages">
					<p className="text-sm">{profile.languages.join("  ·  ")}</p>
				</Section>
			) : null}
		</article>
	);
}
