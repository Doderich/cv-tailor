import {
	FileText,
	Layers,
	type LucideIcon,
	MessageSquareText,
	PenLine,
} from "lucide-react";

/**
 * A "view" is a tab shown in the top bar for the currently active job
 * application. Today only the guided editor exists, but the model is designed
 * so additional view types (PDF preview, CV versions, chat editing) can be
 * added later without changing the tab-bar or workspace plumbing.
 */
export type ApplicationViewType = "editor" | "pdf" | "versions" | "chat";

export interface ApplicationView {
	id: string;
	type: ApplicationViewType;
}

export interface ApplicationViewMeta {
	type: ApplicationViewType;
	label: string;
	icon: LucideIcon;
	description: string;
	/** Whether the view is fully implemented. Future views render a placeholder. */
	available: boolean;
}

export const applicationViewRegistry: ApplicationViewMeta[] = [
	{
		type: "editor",
		label: "Editor",
		icon: PenLine,
		description: "Paste the job, review the match, and tailor the CV.",
		available: true,
	},
	{
		type: "pdf",
		label: "PDF preview",
		icon: FileText,
		description: "Preview the exported PDF for this application.",
		available: false,
	},
	{
		type: "versions",
		label: "Versions",
		icon: Layers,
		description: "Compare multiple tailored CV versions for this role.",
		available: false,
	},
	{
		type: "chat",
		label: "Edit with chat",
		icon: MessageSquareText,
		description: "Refine the CV conversationally with AI.",
		available: false,
	},
];

export function viewMeta(type: ApplicationViewType): ApplicationViewMeta {
	return (
		applicationViewRegistry.find((meta) => meta.type === type) ??
		applicationViewRegistry[0]
	);
}
