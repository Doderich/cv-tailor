import {
	type BaseProfile,
	createId,
	type EducationItem,
	type ExperienceItem,
	type ProjectItem,
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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/cv-app-context";

interface ProfileEditorProps {
	profile: BaseProfile;
	onPatch: (patch: Partial<BaseProfile>) => void;
	profileRevision?: number;
}

function splitLines(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
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
		<TextField
			label={label}
			value={values.join("\n")}
			onChange={(value) => onChange(splitLines(value))}
			placeholder={placeholder}
			rows={rows}
		/>
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
	const [draft, setDraft] = useState(() => normalizeDraft(profile));

	useEffect(() => {
		setDraft(normalizeDraft(profile));
	}, [profileRevision]);

	const persistPatch = useCallback(
		(patch: Partial<BaseProfile>) => {
			queueMicrotask(() => {
				try {
					onPatch(patch);
				} catch (error) {
					toast.error("Could not save profile", {
						description: getErrorMessage(error),
					});
				}
			});
		},
		[onPatch],
	);

	const updateProfile = (patch: Partial<BaseProfile>) => {
		setDraft((current) => {
			const next = { ...current, ...patch };
			persistPatch(patch);
			return next;
		});
	};
	const updateContact = (patch: Partial<BaseProfile["contact"]>) => {
		setDraft((current) => {
			const contact = { ...current.contact, ...patch };
			persistPatch({ contact });
			return { ...current, contact };
		});
	};
	const updateExperience = (id: string, patch: Partial<ExperienceItem>) => {
		setDraft((current) => {
			const experience = (current.experience ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ experience });
			return { ...current, experience };
		});
	};
	const updateEducation = (id: string, patch: Partial<EducationItem>) => {
		setDraft((current) => {
			const education = (current.education ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ education });
			return { ...current, education };
		});
	};
	const updateProject = (id: string, patch: Partial<ProjectItem>) => {
		setDraft((current) => {
			const projects = (current.projects ?? []).map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			);
			persistPatch({ projects });
			return { ...current, projects };
		});
	};
	const appendExperience = () => {
		const item = createExperience();
		setDraft((current) => {
			const experience = [...(current.experience ?? []), item];
			persistPatch({ experience });
			return { ...current, experience };
		});
		scrollToSection(`experience-${item.id}`);
	};
	const removeExperience = (id: string) => {
		setDraft((current) => {
			const experience = (current.experience ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ experience });
			return { ...current, experience };
		});
	};
	const appendProject = () => {
		const item = createProject();
		setDraft((current) => {
			const projects = [...(current.projects ?? []), item];
			persistPatch({ projects });
			return { ...current, projects };
		});
		scrollToSection(`project-${item.id}`);
	};
	const removeProject = (id: string) => {
		setDraft((current) => {
			const projects = (current.projects ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ projects });
			return { ...current, projects };
		});
	};
	const appendEducation = () => {
		const item = createEducation();
		setDraft((current) => {
			const education = [...(current.education ?? []), item];
			persistPatch({ education });
			return { ...current, education };
		});
		scrollToSection(`education-${item.id}`);
	};
	const removeEducation = (id: string) => {
		setDraft((current) => {
			const education = (current.education ?? []).filter(
				(entry) => entry.id !== id,
			);
			persistPatch({ education });
			return { ...current, education };
		});
	};

	return (
		<div id="profile-editor" className="grid gap-4">
			<div className="grid gap-3">
				<div className="grid grid-cols-2 gap-2">
					<Field
						label="Name"
						value={draft.contact.name}
						onChange={(name) => updateContact({ name })}
					/>
					<Field
						label="Email"
						value={draft.contact.email}
						onChange={(email) => updateContact({ email })}
					/>
					<Field
						label="Phone"
						value={draft.contact.phone}
						onChange={(phone) => updateContact({ phone })}
					/>
					<Field
						label="Location"
						value={draft.contact.location}
						onChange={(location) => updateContact({ location })}
					/>
				</div>
				<ArrayField
					label="Links"
					values={draft.contact.links}
					onChange={(links) => updateContact({ links })}
					placeholder="https://linkedin.com/in/..."
					rows={3}
				/>
				<Field
					label="Headline"
					value={draft.headline}
					onChange={(headline) => updateProfile({ headline })}
				/>
				<TextField
					label="Base summary"
					value={draft.summary}
					onChange={(summary) => updateProfile({ summary })}
					placeholder="A factual reusable summary."
				/>
				<ArrayField
					label="Target roles"
					values={draft.targetRoles}
					onChange={(targetRoles) => updateProfile({ targetRoles })}
					placeholder="Frontend Engineer"
					rows={3}
				/>
				<TextField
					label="Preferred tone"
					value={draft.preferredTone}
					onChange={(preferredTone) => updateProfile({ preferredTone })}
					rows={3}
				/>
				<ArrayField
					label="Skills"
					values={draft.skills}
					onChange={(skills) => updateProfile({ skills })}
					placeholder="React"
				/>
				<ArrayField
					label="Achievements"
					values={draft.achievements}
					onChange={(achievements) => updateProfile({ achievements })}
				/>
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">Experience</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendExperience}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{(draft.experience ?? []).map((item) => (
					<Card key={item.id} id={`experience-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>
								{item.title || item.company || "Experience"}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label="Title"
									value={item.title}
									onChange={(title) => updateExperience(item.id, { title })}
								/>
								<Field
									label="Company"
									value={item.company}
									onChange={(company) => updateExperience(item.id, { company })}
								/>
								<Field
									label="Start"
									value={item.startDate}
									onChange={(startDate) =>
										updateExperience(item.id, { startDate })
									}
								/>
								<Field
									label="End"
									value={item.endDate}
									onChange={(endDate) => updateExperience(item.id, { endDate })}
								/>
							</div>
							<Field
								label="Location"
								value={item.location}
								onChange={(location) => updateExperience(item.id, { location })}
							/>
							<ArrayField
								label="Bullets"
								values={item.bullets}
								onChange={(bullets) => updateExperience(item.id, { bullets })}
							/>
							<ArrayField
								label="Technologies"
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
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">Projects</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendProject}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{(draft.projects ?? []).map((item) => (
					<Card key={item.id} id={`project-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>{item.name || "Project"}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label="Name"
									value={item.name}
									onChange={(name) => updateProject(item.id, { name })}
								/>
								<Field
									label="Role"
									value={item.role}
									onChange={(role) => updateProject(item.id, { role })}
								/>
							</div>
							<Field
								label="URL"
								value={item.url}
								onChange={(url) => updateProject(item.id, { url })}
							/>
							<TextField
								label="Description"
								value={item.description}
								onChange={(description) =>
									updateProject(item.id, { description })
								}
								rows={3}
							/>
							<ArrayField
								label="Bullets"
								values={item.bullets}
								onChange={(bullets) => updateProject(item.id, { bullets })}
							/>
							<ArrayField
								label="Technologies"
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
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm font-heading">Education</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={appendEducation}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{(draft.education ?? []).map((item) => (
					<Card key={item.id} id={`education-${item.id}`} size="sm">
						<CardHeader>
							<CardTitle>
								{item.degree || item.institution || "Education"}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<div className="grid grid-cols-2 gap-2">
								<Field
									label="Institution"
									value={item.institution}
									onChange={(institution) =>
										updateEducation(item.id, { institution })
									}
								/>
								<Field
									label="Degree"
									value={item.degree}
									onChange={(degree) => updateEducation(item.id, { degree })}
								/>
								<Field
									label="Start"
									value={item.startDate}
									onChange={(startDate) =>
										updateEducation(item.id, { startDate })
									}
								/>
								<Field
									label="End"
									value={item.endDate}
									onChange={(endDate) => updateEducation(item.id, { endDate })}
								/>
							</div>
							<Field
								label="Location"
								value={item.location}
								onChange={(location) => updateEducation(item.id, { location })}
							/>
							<ArrayField
								label="Details"
								values={item.details}
								onChange={(details) => updateEducation(item.id, { details })}
								rows={3}
							/>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => removeEducation(item.id)}
							>
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<ArrayField
				label="Languages"
				values={draft.languages}
				onChange={(languages) => updateProfile({ languages })}
				placeholder="English"
				rows={3}
			/>
		</div>
	);
}
