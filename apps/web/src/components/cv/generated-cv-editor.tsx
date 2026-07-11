import type {
	Application,
	BaseProfile,
	CvRun,
	TailoredCv,
} from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ArrayLinesTextarea } from "@/components/array-lines-field";

interface GeneratedCvEditorProps {
	profile: BaseProfile;
	application: Application | undefined;
	run: CvRun | undefined;
	onChange: (cv: TailoredCv) => void;
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
			<ArrayLinesTextarea values={values} onChange={onChange} rows={rows} />
		</Field>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid gap-3">
			<Label className="text-muted-foreground text-xs">{label}</Label>
			{children}
		</div>
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
	application: _application,
	run,
	onChange,
}: GeneratedCvEditorProps) {
	const { t } = useTranslation();

	if (!run) {
		return (
			<div className="grid min-h-72 place-items-center rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
				{t("cv.editor.empty")}
			</div>
		);
	}

	const cv = run.cv;
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
	const resetExperienceToSource = () =>
		updateCv({
			experience: cv.experience.map((item) => {
				const source = profile.experience.find(
					(entry) => entry.id === item.experienceId,
				);
				return {
					experienceId: item.experienceId,
					bullets: source ? [...source.bullets] : [...item.bullets],
				};
			}),
		});
	const resetProjectsToSource = () =>
		updateCv({
			projects: cv.projects.map((item) => {
				const source = profile.projects.find(
					(entry) => entry.id === item.projectId,
				);
				return {
					projectId: item.projectId,
					bullets: source ? [...source.bullets] : [...item.bullets],
				};
			}),
		});

	return (
		<div className="grid gap-4">
			<EditorSection title={t("cv.editor.summarySkills")}>
				<Field label={t("cv.editor.summary")}>
					<Textarea
						value={cv.summary}
						onChange={(event) => updateCv({ summary: event.target.value })}
						rows={5}
					/>
				</Field>
				<ArrayField
					label={t("cv.editor.skills")}
					values={cv.skills}
					onChange={(skills) => updateCv({ skills })}
				/>
			</EditorSection>

			<EditorSection
				title={t("cv.editor.experience")}
				action={
					<Button size="sm" variant="outline" onClick={resetExperienceToSource}>
						<RotateCcw /> {t("cv.editor.resetSource")}
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
								label={
									source?.company
										? t("cv.editor.experienceLabel", {
												title:
													source.title || t("cv.editor.experienceFallback"),
												company: source.company,
											})
										: source?.title || t("cv.editor.experienceFallback")
								}
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
					title={t("cv.editor.projects")}
					action={
						<Button size="sm" variant="outline" onClick={resetProjectsToSource}>
							<RotateCcw /> {t("cv.editor.resetSource")}
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
									label={source?.name || t("cv.editor.projectFallback")}
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

			<EditorSection title={t("cv.editor.reviewNotes")}>
				<ArrayField
					label={t("cv.editor.missingRequirements")}
					values={cv.missingRequirements}
					onChange={(missingRequirements) => updateCv({ missingRequirements })}
				/>
				<ArrayField
					label={t("cv.editor.warnings")}
					values={cv.warnings}
					onChange={(warnings) => updateCv({ warnings })}
				/>
			</EditorSection>
		</div>
	);
}
