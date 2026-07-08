import { cvLanguageLabel, cvLanguages, type CvLanguage } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import { Input } from "@cv-tailor/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { cn } from "@cv-tailor/ui/lib/utils";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useCvApp } from "@/lib/cv-app-context";

function ProfileCard({
	name,
	language,
	active,
	canDelete,
	onSelect,
	onDelete,
	onNameChange,
	onLanguageChange,
}: {
	name: string;
	language: CvLanguage;
	active: boolean;
	canDelete: boolean;
	onSelect: () => void;
	onDelete: () => void;
	onNameChange: (name: string) => void;
	onLanguageChange: (language: CvLanguage) => void;
}) {
	return (
		<div
			className={cn(
				"grid gap-3 rounded-xl border bg-card p-3 transition-all",
				active ? "border-primary ring-2 ring-primary/30" : "border-border",
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<button
					type="button"
					onClick={onSelect}
					className="grid flex-1 gap-1 text-left"
				>
					<span className="font-medium text-sm">{name}</span>
					<span className="text-muted-foreground text-xs">
						{cvLanguageLabel(language)} CV
					</span>
				</button>
				<div className="flex items-center gap-1">
					{active ? (
						<span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
							<Check className="size-3" />
						</span>
					) : null}
					{canDelete ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={onDelete}
							aria-label={`Delete ${name}`}
						>
							<Trash2 className="size-3.5" />
						</Button>
					) : null}
				</div>
			</div>
			{active ? (
				<div className="grid gap-2 sm:grid-cols-2">
					<Input
						value={name}
						onChange={(event) => onNameChange(event.target.value)}
						placeholder="Profile name"
						aria-label="Profile name"
					/>
					<Select
						value={language}
						onValueChange={(value) => {
							if (value) {
								onLanguageChange(value as CvLanguage);
							}
						}}
					>
						<SelectTrigger aria-label="CV language">
							<SelectValue placeholder="Language" />
						</SelectTrigger>
						<SelectContent>
							{cvLanguages.map((option) => (
								<SelectItem key={option} value={option}>
									{cvLanguageLabel(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}
		</div>
	);
}

export function ProfileManager() {
	const {
		profiles,
		profileRecord,
		createProfile,
		switchProfile,
		deleteProfile,
		updateProfileMeta,
	} = useCvApp();
	const [isAdding, setIsAdding] = useState(false);
	const [newName, setNewName] = useState("");
	const [newLanguage, setNewLanguage] = useState<CvLanguage>("en");

	function handleCreate() {
		const name =
			newName.trim() || cvLanguageLabel(newLanguage);
		createProfile(name, newLanguage);
		setNewName("");
		setNewLanguage("en");
		setIsAdding(false);
	}

	return (
		<div className="grid gap-3">
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium text-base">Profiles</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setIsAdding((current) => !current)}
				>
					<Plus />
					Add profile
				</Button>
			</div>
			<div className="grid gap-2 sm:grid-cols-2">
				{profiles.map((item) => (
					<ProfileCard
						key={item.id}
						name={item.name}
						language={item.language}
						active={item.id === profileRecord?.id}
						canDelete={profiles.length > 1}
						onSelect={() => switchProfile(item.id)}
						onDelete={() => deleteProfile(item.id)}
						onNameChange={(name) =>
							updateProfileMeta(item.id, { name })
						}
						onLanguageChange={(language) =>
							updateProfileMeta(item.id, { language })
						}
					/>
				))}
			</div>
			{isAdding ? (
				<div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
					<Input
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						placeholder="Profile name (optional)"
						aria-label="New profile name"
					/>
					<Select
						value={newLanguage}
						onValueChange={(value) => {
							if (value) {
								setNewLanguage(value as CvLanguage);
							}
						}}
					>
						<SelectTrigger className="w-full sm:w-36" aria-label="New profile language">
							<SelectValue placeholder="Language" />
						</SelectTrigger>
						<SelectContent>
							{cvLanguages.map((option) => (
								<SelectItem key={option} value={option}>
									{cvLanguageLabel(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex gap-2">
						<Button type="button" size="sm" onClick={handleCreate}>
							Create
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setIsAdding(false)}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
