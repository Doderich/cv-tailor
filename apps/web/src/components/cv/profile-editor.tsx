import {
	type BaseProfile,
	createId,
	type EducationItem,
	type ExperienceItem,
	type ProjectItem,
	summarizeProfileContent,
} from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/cv-app-context";
import { ArrayLinesField } from "@/components/array-lines-field";

interface ProfileEditorProps {
	profile: BaseProfile;
	onPatch: (patch: Partial<BaseProfile>) => void;
	profileRevision?: number;
}

function ArrayField({
	label,
	values,
	onChange,
	placeholder,
	rows = 4,
}: {
	label: string;
	values: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	rows?: number;
}) {
	return (
		<ArrayLinesField
			label={label}
			values={values}
			onChange={onChange}
			placeholder={placeholder}
			rows={rows}
		/>
	);
}

function Field({
	label,
	value,
	onChange,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	return (
		<div className="grid gap-3">
			<Label>{label}</Label>
			<Input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
}

function TextField({
	label,
	value,
	onChange,
	placeholder,
	rows = 4,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	rows?: number;
}) {
	return (
		<div className="grid gap-3">
			<Label>{label}</Label>
			<Textarea
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				rows={rows}
			/>
		</div>
	);
}

function createExperience(): ExperienceItem {
	return {
		id: createId("exp"),
		company: "",
		title: "",
		location: "",
		startDate: "",
		endDate: "",
		current: false,
		bullets: [],
		technologies: [],
	};
}

function createEducation(): EducationItem {
	return {
		id: createId("edu"),
		institution: "",
		degree: "",
		location: "",
		startDate: "",
		endDate: "",
		details: [],
	};
}

function createProject(): ProjectItem {
	return {
		id: createId("project"),
		name: "",
		role: "",
		url: "",
		description: "",
		bullets: [],
		technologies: [],
	};
}

function normalizeDraft(profile: BaseProfile): BaseProfile {
	return {
		...profile,
		contact: {
			...profile.contact,
			links: profile.contact?.links ?? [],
		},
		targetRoles: profile.targetRoles ?? [],
		skills: profile.skills ?? [],
		achievements: profile.achievements ?? [],
		experience: profile.experience ?? [],
		education: profile.education ?? [],
		projects: profile.projects ?? [],
		languages: profile.languages ?? [],
	};
}

function scrollToSection(id: string) {
	requestAnimationFrame(() => {
		document.getElementById(id)?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	});
}

export function ProfileEditor({
	profile,
	onPatch,
	profileRevision = 0,
}: ProfileEditorProps) {
	const { t } = useTranslation();
	const profileRef = useRef(profile);
	profileRef.current = profile;
	const [draft, setDraft] = useState(() => normalizeDraft(profile));
	const [isDirty, setIsDirty] = useState(false);
	const visible = isDirty ? draft : normalizeDraft(profile);
	const profileContentKey = summarizeProfileContent(profile);

	// biome-ignore lint/correctness/useExhaustiveDependencies: revision bumps and content keys are explicit external profile replacements.
	useEffect(() => {
		setDraft(normalizeDraft(profile));
		setIsDirty(false);
	}, [profileRevision, profileContentKey]);

	const persistPatch = useCallback(
		(patch: Partial<BaseProfile>) => {
			queueMicrotask(() => {
				try {
					onPatch(patch);
				} catch (error) {
					toast.error(t("profile.editor.toast.saveFailed"), {
						description: getErrorMessage(error),
					});
				}
			});
		},
		[onPatch, t],
	);

	const updateProfile = (patch: Partial<BaseProfile>) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const next = { ...base, ...patch };
			persistPatch(patch);
			return next;
		});
	};
	const updateContact = (patch: Partial<BaseProfile["contact"]>) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const contact = { ...base.contact, ...patch };
			persistPatch({ contact });
			return { ...base, contact };
		});
	};
	const updateExperience = (id: string, patch: Partial<ExperienceItem>) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const experience = (base.experience ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ experience });
			return { ...base, experience };
		});
	};
	const updateEducation = (id: string, patch: Partial<EducationItem>) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const education = (base.education ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ education });
			return { ...base, education };
		});
	};
	const updateProject = (id: string, patch: Partial<ProjectItem>) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const projects = (base.projects ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ projects });
			return { ...base, projects };
		});
	};
	const appendExperience = () => {
		const item = createExperience();
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const experience = [...(base.experience ?? []), item];
			persistPatch({ experience });
			return { ...base, experience };
		});
		scrollToSection(`experience-${item.id}`);
	};
	const removeExperience = (id: string) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const experience = (base.experience ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ experience });
			return { ...base, experience };
		});
	};
	const appendProject = () => {
		const item = createProject();
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const projects = [...(base.projects ?? []), item];
			persistPatch({ projects });
			return { ...base, projects };
		});
		scrollToSection(`project-${item.id}`);
	};
	const removeProject = (id: string) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const projects = (base.projects ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ projects });
			return { ...base, projects };
		});
	};
	const appendEducation = () => {
		const item = createEducation();
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const education = [...(base.education ?? []), item];
			persistPatch({ education });
			return { ...base, education };
		});
		scrollToSection(`education-${item.id}`);
	};
	const removeEducation = (id: string) => {
		setIsDirty(true);
		setDraft((current) => {
			const base = isDirty ? current : normalizeDraft(profileRef.current);
			const education = (base.education ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ education });
			return { ...base, education };
		});
	};

	return (
		<div id="profile-editor" className="grid gap-4">
			<div className="grid gap-3">
				<div className="grid grid-cols-2 gap-2">
					<Field
						label={t("profile.editor.name")}
						value={visible.contact.name}
						onChange={(name) => updateContact({ name })}
					/>
					<Field
						label={t("profile.editor.email")}
						value={visible.contact.email}
						onChange={(email) => updateContact({ email })}
					/>
					<Field
						label={t("profile.editor.phone")}
						value={visible.contact.phone}
						onChange={(phone) => updateContact({ phone })}
					/>
					<Field
						label={t("profile.editor.location")}
						value={visible.contact.location}
						onChange={(location) => updateContact({ location })}
					/>
				</div>
				<ArrayField
					label={t("profile.editor.links")}
					values={visible.contact.links}
					onChange={(links) => updateContact({ links })}
					placeholder={t("profile.editor.linksPlaceholder")}
					rows={3}
				/>
				<Field
					label={t("profile.editor.headline")}
					value={visible.headline}
					onChange={(headline) => updateProfile({ headline })}
				/>
				<TextField
					label={t("profile.editor.summary")}
					value={visible.summary}
					onChange={(summary) => updateProfile({ summary })}
					placeholder={t("profile.editor.summaryPlaceholder")}
				/>
				<ArrayField
					label={t("profile.editor.targetRoles")}
					values={visible.targetRoles}
					onChange={(targetRoles) => updateProfile({ targetRoles })}
					placeholder={t("profile.editor.targetRolesPlaceholder")}
					rows={3}
				/>
				<TextField
					label={t("profile.editor.preferredTone")}
					value={visible.preferredTone}
					onChange={(preferredTone) => updateProfile({ preferredTone })}
					rows={3}
				/>
				<ArrayField
					label={t("profile.editor.skills")}
					values={visible.skills}
					onChange={(skills) => updateProfile({ skills })}
					placeholder={t("profile.editor.skillsPlaceholder")}
				/>
				<ArrayField
					label={t("profile.editor.achievements")}
					values={visible.achievements}
					onChange={(achievements) => updateProfile({ achievements })}
				/>
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">
					{t("profile.editor.experience.section")}
				</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendExperience}
				>
					<Plus /> {t("common.add")}
				</Button>
			</div>
			<div className="grid gap-3">
				{(visible.experience ?? []).map((item) => (
					<Card key={item.id} id={`experience-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>
								{item.title ||
									item.company ||
									t("profile.editor.experience.fallbackTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label={t("profile.editor.experience.title")}
									value={item.title}
									onChange={(title) => updateExperience(item.id, { title })}
								/>
								<Field
									label={t("profile.editor.experience.company")}
									value={item.company}
									onChange={(company) => updateExperience(item.id, { company })}
								/>
								<Field
									label={t("profile.editor.experience.start")}
									value={item.startDate}
									onChange={(startDate) =>
										updateExperience(item.id, { startDate })
									}
								/>
								<Field
									label={t("profile.editor.experience.end")}
									value={item.endDate}
									onChange={(endDate) => updateExperience(item.id, { endDate })}
								/>
							</div>
							<Field
								label={t("profile.editor.location")}
								value={item.location}
								onChange={(location) => updateExperience(item.id, { location })}
							/>
							<ArrayField
								label={t("profile.editor.experience.bullets")}
								values={item.bullets}
								onChange={(bullets) => updateExperience(item.id, { bullets })}
							/>
							<ArrayField
								label={t("profile.editor.experience.technologies")}
								values={item.technologies}
								onChange={(technologies) =>
									updateExperience(item.id, { technologies })
								}
								rows={3}
							/>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => removeExperience(item.id)}
							>
								<Trash2 /> {t("common.remove")}
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">
					{t("profile.editor.projects.section")}
				</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendProject}
				>
					<Plus /> {t("common.add")}
				</Button>
			</div>
			<div className="grid gap-3">
				{(visible.projects ?? []).map((item) => (
					<Card key={item.id} id={`project-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>
								{item.name || t("profile.editor.projects.fallbackTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label={t("profile.editor.projects.name")}
									value={item.name}
									onChange={(name) => updateProject(item.id, { name })}
								/>
								<Field
									label={t("profile.editor.projects.role")}
									value={item.role}
									onChange={(role) => updateProject(item.id, { role })}
								/>
							</div>
							<Field
								label={t("profile.editor.projects.url")}
								value={item.url}
								onChange={(url) => updateProject(item.id, { url })}
							/>
							<TextField
								label={t("profile.editor.projects.description")}
								value={item.description}
								onChange={(description) =>
									updateProject(item.id, { description })
								}
								rows={3}
							/>
							<ArrayField
								label={t("profile.editor.experience.bullets")}
								values={item.bullets}
								onChange={(bullets) => updateProject(item.id, { bullets })}
							/>
							<ArrayField
								label={t("profile.editor.experience.technologies")}
								values={item.technologies}
								onChange={(technologies) =>
									updateProject(item.id, { technologies })
								}
								rows={3}
							/>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => removeProject(item.id)}
							>
								<Trash2 /> {t("common.remove")}
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">
					{t("profile.editor.education.section")}
				</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendEducation}
				>
					<Plus /> {t("common.add")}
				</Button>
			</div>
			<div className="grid gap-3">
				{(visible.education ?? []).map((item) => (
					<Card key={item.id} id={`education-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>
								{item.degree ||
									item.institution ||
									t("profile.editor.education.fallbackTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label={t("profile.editor.education.institution")}
									value={item.institution}
									onChange={(institution) =>
										updateEducation(item.id, { institution })
									}
								/>
								<Field
									label={t("profile.editor.education.degree")}
									value={item.degree}
									onChange={(degree) => updateEducation(item.id, { degree })}
								/>
								<Field
									label={t("profile.editor.experience.start")}
									value={item.startDate}
									onChange={(startDate) =>
										updateEducation(item.id, { startDate })
									}
								/>
								<Field
									label={t("profile.editor.experience.end")}
									value={item.endDate}
									onChange={(endDate) => updateEducation(item.id, { endDate })}
								/>
							</div>
							<Field
								label={t("profile.editor.location")}
								value={item.location}
								onChange={(location) => updateEducation(item.id, { location })}
							/>
							<ArrayField
								label={t("profile.editor.education.details")}
								values={item.details}
								onChange={(details) => updateEducation(item.id, { details })}
								rows={3}
							/>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => removeEducation(item.id)}
							>
								<Trash2 /> {t("common.remove")}
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<ArrayField
				label={t("profile.editor.languages")}
				values={visible.languages}
				onChange={(languages) => updateProfile({ languages })}
				placeholder={t("profile.editor.languagesPlaceholder")}
				rows={3}
			/>
		</div>
	);
}
