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

interface ProfileEditorProps {
	profile: BaseProfile;
	onChange: (profile: BaseProfile) => void;
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
		<div className="grid gap-1">
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
		<div className="grid gap-1">
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

export function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
	const updateProfile = (patch: Partial<BaseProfile>) =>
		onChange({ ...profile, ...patch });
	const updateContact = (patch: Partial<BaseProfile["contact"]>) =>
		updateProfile({ contact: { ...profile.contact, ...patch } });
	const updateExperience = (id: string, patch: Partial<ExperienceItem>) =>
		updateProfile({
			experience: profile.experience.map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			),
		});
	const updateEducation = (id: string, patch: Partial<EducationItem>) =>
		updateProfile({
			education: profile.education.map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			),
		});
	const updateProject = (id: string, patch: Partial<ProjectItem>) =>
		updateProfile({
			projects: profile.projects.map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			),
		});

	return (
		<div className="grid gap-4">
			<div className="grid gap-3">
				<div className="grid grid-cols-2 gap-2">
					<Field
						label="Name"
						value={profile.contact.name}
						onChange={(name) => updateContact({ name })}
					/>
					<Field
						label="Email"
						value={profile.contact.email}
						onChange={(email) => updateContact({ email })}
					/>
					<Field
						label="Phone"
						value={profile.contact.phone}
						onChange={(phone) => updateContact({ phone })}
					/>
					<Field
						label="Location"
						value={profile.contact.location}
						onChange={(location) => updateContact({ location })}
					/>
				</div>
				<ArrayField
					label="Links"
					values={profile.contact.links}
					onChange={(links) => updateContact({ links })}
					placeholder="https://linkedin.com/in/..."
					rows={3}
				/>
				<Field
					label="Headline"
					value={profile.headline}
					onChange={(headline) => updateProfile({ headline })}
				/>
				<TextField
					label="Base summary"
					value={profile.summary}
					onChange={(summary) => updateProfile({ summary })}
					placeholder="A factual reusable summary."
				/>
				<ArrayField
					label="Target roles"
					values={profile.targetRoles}
					onChange={(targetRoles) => updateProfile({ targetRoles })}
					placeholder="Frontend Engineer"
					rows={3}
				/>
				<TextField
					label="Preferred tone"
					value={profile.preferredTone}
					onChange={(preferredTone) => updateProfile({ preferredTone })}
					rows={3}
				/>
				<ArrayField
					label="Skills"
					values={profile.skills}
					onChange={(skills) => updateProfile({ skills })}
					placeholder="React"
				/>
				<ArrayField
					label="Achievements"
					values={profile.achievements}
					onChange={(achievements) => updateProfile({ achievements })}
				/>
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Experience</h3>
				<Button
					size="sm"
					variant="outline"
					onClick={() =>
						updateProfile({
							experience: [...profile.experience, createExperience()],
						})
					}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{profile.experience.map((item) => (
					<Card key={item.id} size="sm">
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
								onClick={() =>
									updateProfile({
										experience: profile.experience.filter(
											(entry) => entry.id !== item.id,
										),
									})
								}
							>
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Projects</h3>
				<Button
					size="sm"
					variant="outline"
					onClick={() =>
						updateProfile({ projects: [...profile.projects, createProject()] })
					}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{profile.projects.map((item) => (
					<Card key={item.id} size="sm">
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
								onClick={() =>
									updateProfile({
										projects: profile.projects.filter(
											(entry) => entry.id !== item.id,
										),
									})
								}
							>
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Education</h3>
				<Button
					size="sm"
					variant="outline"
					onClick={() =>
						updateProfile({
							education: [...profile.education, createEducation()],
						})
					}
				>
					<Plus /> Add
				</Button>
			</div>
			<div className="grid gap-3">
				{profile.education.map((item) => (
					<Card key={item.id} size="sm">
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
								onClick={() =>
									updateProfile({
										education: profile.education.filter(
											(entry) => entry.id !== item.id,
										),
									})
								}
							>
								<Trash2 /> Remove
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			<ArrayField
				label="Languages"
				values={profile.languages}
				onChange={(languages) => updateProfile({ languages })}
				placeholder="English"
				rows={3}
			/>
		</div>
	);
}
