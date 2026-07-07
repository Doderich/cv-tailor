import type { BaseProfile, GeneratedCv, TailoredCv } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { RotateCcw } from "lucide-react";

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
		<div className="grid gap-1">
			<Label>{label}</Label>
			<Textarea
				value={values.join("\n")}
				onChange={(event) => onChange(splitLines(event.target.value))}
				rows={rows}
			/>
		</div>
	);
}

export function GeneratedCvEditor({
	profile,
	generatedCv,
	onChange,
}: GeneratedCvEditorProps) {
	if (!generatedCv) {
		return (
			<div className="grid min-h-72 place-items-center border border-dashed p-6 text-center text-muted-foreground text-sm">
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
			<div className="grid gap-1">
				<Label>Tailored summary</Label>
				<Textarea
					value={cv.summary}
					onChange={(event) => updateCv({ summary: event.target.value })}
					rows={5}
				/>
			</div>
			<ArrayField
				label="Tailored skills"
				values={cv.skills}
				onChange={(skills) => updateCv({ skills })}
			/>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Experience bullets</h3>
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
					<RotateCcw /> Source bullets
				</Button>
			</div>
			<div className="grid gap-3">
				{cv.experience.map((item) => {
					const source = profile.experience.find(
						(entry) => entry.id === item.experienceId,
					);
					return (
						<Card key={item.experienceId} size="sm">
							<CardHeader>
								<CardTitle>
									{source?.title || "Experience"}{" "}
									{source?.company ? `at ${source.company}` : ""}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ArrayField
									label="Bullets"
									values={item.bullets}
									onChange={(bullets) =>
										updateExperienceBullets(item.experienceId, bullets)
									}
								/>
							</CardContent>
						</Card>
					);
				})}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Project bullets</h3>
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
					<RotateCcw /> Source bullets
				</Button>
			</div>
			<div className="grid gap-3">
				{cv.projects.map((item) => {
					const source = profile.projects.find(
						(entry) => entry.id === item.projectId,
					);
					return (
						<Card key={item.projectId} size="sm">
							<CardHeader>
								<CardTitle>{source?.name || "Project"}</CardTitle>
							</CardHeader>
							<CardContent>
								<ArrayField
									label="Bullets"
									values={item.bullets}
									onChange={(bullets) =>
										updateProjectBullets(item.projectId, bullets)
									}
								/>
							</CardContent>
						</Card>
					);
				})}
			</div>

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
		</div>
	);
}
