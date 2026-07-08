import type { BaseProfile, GeneratedCv, TailoredCv } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

interface GeneratedCvEditorProps {
	profile: BaseProfile;
	generatedCv: GeneratedCv | undefined;
	onChange: (cv: TailoredCv) => void;
}

function splitLines(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid gap-1.5">
			<Label className="text-muted-foreground text-xs">{label}</Label>
			{children}
		</div>
	);
}

function ArrayField({
	label,
	values,
	onChange,
	rows = 4,
}: {
	label: string;
	values: string[];
	onChange: (values: string[]) => void;
	rows?: number;
}) {
	return (
		<Field label={label}>
			<Textarea
				value={values.join("\n")}
				onChange={(event) => onChange(splitLines(event.target.value))}
				rows={rows}
			/>
		</Field>
	);
}

function EditorSection({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-3 rounded-xl border bg-card p-4">
			<div className="flex items-center justify-between gap-2">
				<h3 className="font-medium text-sm">{title}</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

export function GeneratedCvEditor({
	profile,
	generatedCv,
	onChange,
}: GeneratedCvEditorProps) {
	if (!generatedCv) {
		return (
			<div className="grid min-h-72 place-items-center rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
				Generate or reopen a CV to edit the tailored output.
			</div>
		);
	}

	const cv = generatedCv.cv;
	const updateCv = (patch: Partial<TailoredCv>) =>
		onChange({ ...cv, ...patch });
	const updateExperienceBullets = (experienceId: string, bullets: string[]) =>
		updateCv({
			experience: cv.experience.map((item) =>
				item.experienceId === experienceId ? { ...item, bullets } : item,
			),
		});
	const updateProjectBullets = (projectId: string, bullets: string[]) =>
		updateCv({
			projects: cv.projects.map((item) =>
				item.projectId === projectId ? { ...item, bullets } : item,
			),
		});

	return (
		<div className="grid gap-4">
			<EditorSection title="Summary & skills">
				<Field label="Tailored summary">
					<Textarea
						value={cv.summary}
						onChange={(event) => updateCv({ summary: event.target.value })}
						rows={5}
					/>
				</Field>
				<ArrayField
					label="Tailored skills (one per line)"
					values={cv.skills}
					onChange={(skills) => updateCv({ skills })}
				/>
			</EditorSection>

			<EditorSection
				title="Experience bullets"
				action={
					<Button
						size="sm"
						variant="outline"
						onClick={() =>
							updateCv({
								experience: profile.experience.map((item) => ({
									experienceId: item.id,
									bullets: item.bullets,
								})),
							})
						}
					>
						<RotateCcw /> Reset to source
					</Button>
				}
			>
				<div className="grid gap-3">
					{cv.experience.map((item) => {
						const source = profile.experience.find(
							(entry) => entry.id === item.experienceId,
						);
						return (
							<ArrayField
								key={item.experienceId}
								label={`${source?.title || "Experience"}${
									source?.company ? ` · ${source.company}` : ""
								}`}
								values={item.bullets}
								onChange={(bullets) =>
									updateExperienceBullets(item.experienceId, bullets)
								}
							/>
						);
					})}
				</div>
			</EditorSection>

			{cv.projects.length > 0 ? (
				<EditorSection
					title="Project bullets"
					action={
						<Button
							size="sm"
							variant="outline"
							onClick={() =>
								updateCv({
									projects: profile.projects.map((item) => ({
										projectId: item.id,
										bullets: item.bullets,
									})),
								})
							}
						>
							<RotateCcw /> Reset to source
						</Button>
					}
				>
					<div className="grid gap-3">
						{cv.projects.map((item) => {
							const source = profile.projects.find(
								(entry) => entry.id === item.projectId,
							);
							return (
								<ArrayField
									key={item.projectId}
									label={source?.name || "Project"}
									values={item.bullets}
									onChange={(bullets) =>
										updateProjectBullets(item.projectId, bullets)
									}
								/>
							);
						})}
					</div>
				</EditorSection>
			) : null}

			<EditorSection title="Review notes">
				<ArrayField
					label="Missing requirements"
					values={cv.missingRequirements}
					onChange={(missingRequirements) => updateCv({ missingRequirements })}
				/>
				<ArrayField
					label="Reviewer warnings"
					values={cv.warnings}
					onChange={(warnings) => updateCv({ warnings })}
				/>
			</EditorSection>
		</div>
	);
}
