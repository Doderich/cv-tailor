import type { CvTemplateId } from "@cv-tailor/core";
import type { ReactNode } from "react";

import type { ResolvedCvContent } from "./cv-content";

export type CvLayoutMode = "preview" | "print";

interface CvLayoutTemplateProps {
	content: ResolvedCvContent;
	mode: CvLayoutMode;
}

function BulletList({
	items,
	mode,
	className,
}: {
	items: string[];
	mode: CvLayoutMode;
	className?: string;
}) {
	if (items.length === 0) {
		return null;
	}

	if (mode === "print") {
		return (
			<ul className={className}>
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		);
	}

	return (
		<ul
			className={
				className ??
				"ml-4 list-disc space-y-1 pl-1 text-sm marker:text-muted-foreground"
			}
		>
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

function PreviewSection({
	title,
	children,
	titleClassName,
}: {
	title: string;
	children: ReactNode;
	titleClassName?: string;
}) {
	return (
		<section className="grid gap-2">
			<h2
				className={
					titleClassName ??
					"border-b pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-widest"
				}
			>
				{title}
			</h2>
			{children}
		</section>
	);
}

function PrintSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="print-section">
			<h2>{title}</h2>
			{children}
		</section>
	);
}

function ExperienceEntries({
	content,
	mode,
}: {
	content: ResolvedCvContent;
	mode: CvLayoutMode;
}) {
	if (content.experience.length === 0) {
		return null;
	}

	if (mode === "print") {
		return (
			<>
				{content.experience.map((item) => (
					<div key={item.id} className="print-item">
						<div className="print-item-heading">
							<strong>
								{item.title}
								{item.company ? ` · ${item.company}` : ""}
							</strong>
							<span>{item.dateRange}</span>
						</div>
						<div className="print-item-meta">
							{[item.location, item.technologies].filter(Boolean).join("  ·  ")}
						</div>
						<BulletList items={item.bullets} mode={mode} />
					</div>
				))}
			</>
		);
	}

	return (
		<div className="grid gap-4">
			{content.experience.map((item) => (
				<div key={item.id} className="grid gap-1">
					<div className="flex items-baseline justify-between gap-3">
						<p className="font-medium text-sm">
							{item.title}
							{item.company ? ` · ${item.company}` : ""}
						</p>
						<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
							{item.dateRange}
						</span>
					</div>
					{item.location || item.technologies ? (
						<p className="text-muted-foreground text-xs">
							{[item.location, item.technologies].filter(Boolean).join("  ·  ")}
						</p>
					) : null}
					<BulletList items={item.bullets} mode={mode} />
				</div>
			))}
		</div>
	);
}

function ProjectEntries({
	content,
	mode,
}: {
	content: ResolvedCvContent;
	mode: CvLayoutMode;
}) {
	if (content.projects.length === 0) {
		return null;
	}

	if (mode === "print") {
		return (
			<>
				{content.projects.map((item) => (
					<div key={item.id} className="print-item">
						<div className="print-item-heading">
							<strong>{item.name}</strong>
							<span>{item.role}</span>
						</div>
						<div className="print-item-meta">
							{[item.url, item.technologies].filter(Boolean).join("  ·  ")}
						</div>
						{item.description ? <p>{item.description}</p> : null}
						<BulletList items={item.bullets} mode={mode} />
					</div>
				))}
			</>
		);
	}

	return (
		<div className="grid gap-4">
			{content.projects.map((item) => (
				<div key={item.id} className="grid gap-1">
					<div className="flex items-baseline justify-between gap-3">
						<p className="font-medium text-sm">{item.name}</p>
						<span className="shrink-0 text-muted-foreground text-xs">
							{item.role}
						</span>
					</div>
					{item.description ? (
						<p className="text-muted-foreground text-sm">{item.description}</p>
					) : null}
					<BulletList items={item.bullets} mode={mode} />
				</div>
			))}
		</div>
	);
}

function EducationEntries({
	content,
	mode,
}: {
	content: ResolvedCvContent;
	mode: CvLayoutMode;
}) {
	if (content.education.length === 0) {
		return null;
	}

	if (mode === "print") {
		return (
			<>
				{content.education.map((item) => (
					<div key={item.id} className="print-item">
						<div className="print-item-heading">
							<strong>{item.degree}</strong>
							<span>{item.dateRange}</span>
						</div>
						<div className="print-item-meta">
							{[item.institution, item.location].filter(Boolean).join("  ·  ")}
						</div>
						<BulletList items={item.details} mode={mode} />
					</div>
				))}
			</>
		);
	}

	return (
		<div className="grid gap-3">
			{content.education.map((item) => (
				<div key={item.id} className="grid gap-0.5">
					<div className="flex items-baseline justify-between gap-3">
						<p className="font-medium text-sm">{item.degree}</p>
						<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
							{item.dateRange}
						</span>
					</div>
					{item.institution && item.degree !== item.institution ? (
						<p className="text-muted-foreground text-xs">{item.institution}</p>
					) : null}
					<BulletList items={item.details} mode={mode} />
				</div>
			))}
		</div>
	);
}

function ClassicLayout({ content, mode }: CvLayoutTemplateProps) {
	if (mode === "print") {
		return (
			<article className="print-cv" data-template="classic">
				<header>
					<h1>{content.name}</h1>
					{content.headline ? (
						<p className="print-headline">{content.headline}</p>
					) : null}
					{content.contactLine.length > 0 ? (
						<p className="print-contact">{content.contactLine.join("  ·  ")}</p>
					) : null}
				</header>

				{content.summary ? (
					<PrintSection title={content.labels.summary}>
						<p>{content.summary}</p>
					</PrintSection>
				) : null}

				{content.skills.length > 0 ? (
					<PrintSection title={content.labels.skills}>
						<p>{content.skills.join("  ·  ")}</p>
					</PrintSection>
				) : null}

				{content.experience.length > 0 ? (
					<PrintSection title={content.labels.experience}>
						<ExperienceEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.projects.length > 0 ? (
					<PrintSection title={content.labels.projects}>
						<ProjectEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.education.length > 0 ? (
					<PrintSection title={content.labels.education}>
						<EducationEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.languages.length > 0 ? (
					<PrintSection title={content.labels.languages}>
						<p>{content.languages.join("  ·  ")}</p>
					</PrintSection>
				) : null}
			</article>
		);
	}

	return (
		<article className="mx-auto grid max-w-2xl gap-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm ring-1 ring-foreground/5">
			<header className="grid gap-1 text-center">
				<h1 className="font-semibold text-2xl tracking-tight">{content.name}</h1>
				{content.headline ? (
					<p className="text-muted-foreground text-sm">{content.headline}</p>
				) : null}
				{content.contactLine.length > 0 ? (
					<p className="text-muted-foreground text-xs">
						{content.contactLine.join("  ·  ")}
					</p>
				) : null}
			</header>

			{content.summary ? (
				<PreviewSection title={content.labels.summary}>
					<p className="text-sm leading-relaxed">{content.summary}</p>
				</PreviewSection>
			) : null}

			{content.skills.length > 0 ? (
				<PreviewSection title={content.labels.skills}>
					<div className="flex flex-wrap gap-1.5">
						{content.skills.map((skill) => (
							<span
								key={skill}
								className="rounded-md bg-muted px-2 py-0.5 text-xs"
							>
								{skill}
							</span>
						))}
					</div>
				</PreviewSection>
			) : null}

			{content.experience.length > 0 ? (
				<PreviewSection title={content.labels.experience}>
					<ExperienceEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.projects.length > 0 ? (
				<PreviewSection title={content.labels.projects}>
					<ProjectEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.education.length > 0 ? (
				<PreviewSection title={content.labels.education}>
					<EducationEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.languages.length > 0 ? (
				<PreviewSection title={content.labels.languages}>
					<p className="text-sm">{content.languages.join("  ·  ")}</p>
				</PreviewSection>
			) : null}
		</article>
	);
}

function ModernLayout({ content, mode }: CvLayoutTemplateProps) {
	if (mode === "print") {
		return (
			<article className="print-cv" data-template="modern">
				<header className="print-modern-header">
					<h1>{content.name}</h1>
					{content.headline ? (
						<p className="print-headline">{content.headline}</p>
					) : null}
					{content.contactLine.length > 0 ? (
						<p className="print-contact">{content.contactLine.join("  ·  ")}</p>
					) : null}
				</header>

				{content.summary ? (
					<PrintSection title={content.labels.summary}>
						<p>{content.summary}</p>
					</PrintSection>
				) : null}

				{content.skills.length > 0 ? (
					<PrintSection title={content.labels.skills}>
						<p>{content.skills.join("  ·  ")}</p>
					</PrintSection>
				) : null}

				{content.experience.length > 0 ? (
					<PrintSection title={content.labels.experience}>
						<ExperienceEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.projects.length > 0 ? (
					<PrintSection title={content.labels.projects}>
						<ProjectEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.education.length > 0 ? (
					<PrintSection title={content.labels.education}>
						<EducationEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.languages.length > 0 ? (
					<PrintSection title={content.labels.languages}>
						<p>{content.languages.join("  ·  ")}</p>
					</PrintSection>
				) : null}
			</article>
		);
	}

	return (
		<article className="mx-auto grid max-w-2xl gap-6 rounded-xl border border-blue-200/60 bg-card p-8 text-card-foreground shadow-sm ring-1 ring-blue-500/10 dark:border-blue-900/50">
			<header className="grid gap-1 border-blue-600 border-b-2 pb-4 dark:border-blue-400">
				<h1 className="font-semibold text-3xl tracking-tight">{content.name}</h1>
				{content.headline ? (
					<p className="text-muted-foreground text-sm">{content.headline}</p>
				) : null}
				{content.contactLine.length > 0 ? (
					<p className="text-muted-foreground text-xs">
						{content.contactLine.join("  ·  ")}
					</p>
				) : null}
			</header>

			{content.summary ? (
				<PreviewSection
					title={content.labels.summary}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<p className="text-sm leading-relaxed">{content.summary}</p>
				</PreviewSection>
			) : null}

			{content.skills.length > 0 ? (
				<PreviewSection
					title={content.labels.skills}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<p className="text-sm">{content.skills.join("  ·  ")}</p>
				</PreviewSection>
			) : null}

			{content.experience.length > 0 ? (
				<PreviewSection
					title={content.labels.experience}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<ExperienceEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.projects.length > 0 ? (
				<PreviewSection
					title={content.labels.projects}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<ProjectEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.education.length > 0 ? (
				<PreviewSection
					title={content.labels.education}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<EducationEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.languages.length > 0 ? (
				<PreviewSection
					title={content.labels.languages}
					titleClassName="border-blue-600 border-b-2 pb-1 font-semibold text-blue-700 text-sm tracking-wide dark:border-blue-400 dark:text-blue-300"
				>
					<p className="text-sm">{content.languages.join("  ·  ")}</p>
				</PreviewSection>
			) : null}
		</article>
	);
}

function SidebarLayout({ content, mode }: CvLayoutTemplateProps) {
	const sidebar = (
		<>
			<h1>{content.name}</h1>
			{content.headline ? <p className="print-headline">{content.headline}</p> : null}
			{content.contactLine.length > 0 ? (
				<p className="print-contact">{content.contactLine.join("  ·  ")}</p>
			) : null}
			{content.skills.length > 0 ? (
				<div className="print-sidebar-block">
					<h2>{content.labels.skills}</h2>
					<p>{content.skills.join("  ·  ")}</p>
				</div>
			) : null}
			{content.languages.length > 0 ? (
				<div className="print-sidebar-block">
					<h2>{content.labels.languages}</h2>
					<p>{content.languages.join("  ·  ")}</p>
				</div>
			) : null}
		</>
	);

	const main = (
		<>
			{content.summary ? (
				<PrintSection title={content.labels.summary}>
					<p>{content.summary}</p>
				</PrintSection>
			) : null}
			{content.experience.length > 0 ? (
				<PrintSection title={content.labels.experience}>
					<ExperienceEntries content={content} mode={mode} />
				</PrintSection>
			) : null}
			{content.projects.length > 0 ? (
				<PrintSection title={content.labels.projects}>
					<ProjectEntries content={content} mode={mode} />
				</PrintSection>
			) : null}
			{content.education.length > 0 ? (
				<PrintSection title={content.labels.education}>
					<EducationEntries content={content} mode={mode} />
				</PrintSection>
			) : null}
		</>
	);

	if (mode === "print") {
		return (
			<article className="print-cv print-cv-sidebar" data-template="sidebar">
				<aside className="print-sidebar">{sidebar}</aside>
				<div className="print-main">{main}</div>
			</article>
		);
	}

	return (
		<article className="mx-auto grid max-w-3xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
			<aside className="grid gap-4 bg-slate-900 p-6 text-slate-50 md:min-h-full">
				<div className="grid gap-1">
					<h1 className="font-semibold text-xl tracking-tight">{content.name}</h1>
					{content.headline ? (
						<p className="text-slate-300 text-sm">{content.headline}</p>
					) : null}
				</div>
				{content.contactLine.length > 0 ? (
					<p className="text-slate-300 text-xs leading-relaxed">
						{content.contactLine.join("  ·  ")}
					</p>
				) : null}
				{content.skills.length > 0 ? (
					<section className="grid gap-2">
						<h2 className="font-semibold text-[11px] text-slate-400 uppercase tracking-widest">
							{content.labels.skills}
						</h2>
						<div className="flex flex-wrap gap-1.5">
							{content.skills.map((skill) => (
								<span
									key={skill}
									className="rounded-md bg-slate-800 px-2 py-0.5 text-xs"
								>
									{skill}
								</span>
							))}
						</div>
					</section>
				) : null}
				{content.languages.length > 0 ? (
					<section className="grid gap-2">
						<h2 className="font-semibold text-[11px] text-slate-400 uppercase tracking-widest">
							{content.labels.languages}
						</h2>
						<p className="text-slate-200 text-sm">
							{content.languages.join("  ·  ")}
						</p>
					</section>
				) : null}
			</aside>
			<div className="grid gap-6 p-8">
				{content.summary ? (
					<PreviewSection title={content.labels.summary}>
						<p className="text-sm leading-relaxed">{content.summary}</p>
					</PreviewSection>
				) : null}
				{content.experience.length > 0 ? (
					<PreviewSection title={content.labels.experience}>
						<ExperienceEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}
				{content.projects.length > 0 ? (
					<PreviewSection title={content.labels.projects}>
						<ProjectEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}
				{content.education.length > 0 ? (
					<PreviewSection title={content.labels.education}>
						<EducationEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}
			</div>
		</article>
	);
}

function MinimalLayout({ content, mode }: CvLayoutTemplateProps) {
	if (mode === "print") {
		return (
			<article className="print-cv" data-template="minimal">
				<header className="print-minimal-header">
					<h1>{content.name}</h1>
					{content.headline ? (
						<p className="print-headline">{content.headline}</p>
					) : null}
					{content.contactLine.length > 0 ? (
						<p className="print-contact">{content.contactLine.join("  ·  ")}</p>
					) : null}
				</header>

				{content.summary ? (
					<PrintSection title={content.labels.summary}>
						<p>{content.summary}</p>
					</PrintSection>
				) : null}

				{content.skills.length > 0 ? (
					<PrintSection title={content.labels.skills}>
						<p>{content.skills.join("  ·  ")}</p>
					</PrintSection>
				) : null}

				{content.experience.length > 0 ? (
					<PrintSection title={content.labels.experience}>
						<ExperienceEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.projects.length > 0 ? (
					<PrintSection title={content.labels.projects}>
						<ProjectEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.education.length > 0 ? (
					<PrintSection title={content.labels.education}>
						<EducationEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.languages.length > 0 ? (
					<PrintSection title={content.labels.languages}>
						<p>{content.languages.join("  ·  ")}</p>
					</PrintSection>
				) : null}
			</article>
		);
	}

	return (
		<article className="mx-auto grid max-w-2xl gap-8 rounded-xl border bg-card p-10 text-card-foreground shadow-sm ring-1 ring-foreground/5">
			<header className="grid gap-2">
				<h1 className="font-light text-3xl tracking-tight">{content.name}</h1>
				{content.headline ? (
					<p className="text-muted-foreground text-sm">{content.headline}</p>
				) : null}
				{content.contactLine.length > 0 ? (
					<p className="text-muted-foreground text-xs">
						{content.contactLine.join("  ·  ")}
					</p>
				) : null}
			</header>

			{content.summary ? (
				<PreviewSection
					title={content.labels.summary}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<p className="text-sm leading-relaxed">{content.summary}</p>
				</PreviewSection>
			) : null}

			{content.skills.length > 0 ? (
				<PreviewSection
					title={content.labels.skills}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<p className="text-sm">{content.skills.join("  ·  ")}</p>
				</PreviewSection>
			) : null}

			{content.experience.length > 0 ? (
				<PreviewSection
					title={content.labels.experience}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<ExperienceEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.projects.length > 0 ? (
				<PreviewSection
					title={content.labels.projects}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<ProjectEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.education.length > 0 ? (
				<PreviewSection
					title={content.labels.education}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<EducationEntries content={content} mode={mode} />
				</PreviewSection>
			) : null}

			{content.languages.length > 0 ? (
				<PreviewSection
					title={content.labels.languages}
					titleClassName="font-medium text-muted-foreground text-sm"
				>
					<p className="text-sm">{content.languages.join("  ·  ")}</p>
				</PreviewSection>
			) : null}
		</article>
	);
}

function ExecutiveLayout({ content, mode }: CvLayoutTemplateProps) {
	if (mode === "print") {
		return (
			<article className="print-cv" data-template="executive">
				<header className="print-executive-header">
					<h1>{content.name}</h1>
					{content.headline ? (
						<p className="print-headline">{content.headline}</p>
					) : null}
					{content.contactLine.length > 0 ? (
						<p className="print-contact">{content.contactLine.join("  ·  ")}</p>
					) : null}
				</header>

				{content.summary ? (
					<PrintSection title={content.labels.summary}>
						<p>{content.summary}</p>
					</PrintSection>
				) : null}

				{content.skills.length > 0 ? (
					<PrintSection title={content.labels.skills}>
						<p>{content.skills.join("  ·  ")}</p>
					</PrintSection>
				) : null}

				{content.experience.length > 0 ? (
					<PrintSection title={content.labels.experience}>
						<ExperienceEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.projects.length > 0 ? (
					<PrintSection title={content.labels.projects}>
						<ProjectEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.education.length > 0 ? (
					<PrintSection title={content.labels.education}>
						<EducationEntries content={content} mode={mode} />
					</PrintSection>
				) : null}

				{content.languages.length > 0 ? (
					<PrintSection title={content.labels.languages}>
						<p>{content.languages.join("  ·  ")}</p>
					</PrintSection>
				) : null}
			</article>
		);
	}

	return (
		<article className="mx-auto grid max-w-2xl gap-6 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5">
			<header className="grid gap-2 bg-slate-900 px-8 py-6 text-slate-50">
				<h1 className="font-bold text-4xl tracking-tight">{content.name}</h1>
				{content.headline ? (
					<p className="text-slate-300 text-sm">{content.headline}</p>
				) : null}
				{content.contactLine.length > 0 ? (
					<p className="text-slate-400 text-xs">
						{content.contactLine.join("  ·  ")}
					</p>
				) : null}
			</header>
			<div className="grid gap-6 p-8">
				{content.summary ? (
					<PreviewSection
						title={content.labels.summary}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<p className="text-sm leading-relaxed">{content.summary}</p>
					</PreviewSection>
				) : null}

				{content.skills.length > 0 ? (
					<PreviewSection
						title={content.labels.skills}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<p className="text-sm">{content.skills.join("  ·  ")}</p>
					</PreviewSection>
				) : null}

				{content.experience.length > 0 ? (
					<PreviewSection
						title={content.labels.experience}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<ExperienceEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}

				{content.projects.length > 0 ? (
					<PreviewSection
						title={content.labels.projects}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<ProjectEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}

				{content.education.length > 0 ? (
					<PreviewSection
						title={content.labels.education}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<EducationEntries content={content} mode={mode} />
					</PreviewSection>
				) : null}

				{content.languages.length > 0 ? (
					<PreviewSection
						title={content.labels.languages}
						titleClassName="border-slate-900 border-l-4 pl-3 font-bold text-sm uppercase tracking-wide dark:border-slate-100"
					>
						<p className="text-sm">{content.languages.join("  ·  ")}</p>
					</PreviewSection>
				) : null}
			</div>
		</article>
	);
}

const templateComponents: Record<
	CvTemplateId,
	(props: CvLayoutTemplateProps) => ReactNode
> = {
	classic: ClassicLayout,
	modern: ModernLayout,
	sidebar: SidebarLayout,
	minimal: MinimalLayout,
	executive: ExecutiveLayout,
};

export function CvLayoutTemplate({
	template,
	content,
	mode,
}: {
	template: CvTemplateId;
	content: ResolvedCvContent;
	mode: CvLayoutMode;
}) {
	const Component = templateComponents[template];
	return <Component content={content} mode={mode} />;
}
