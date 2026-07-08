import type { GeneratedCv, JobSignals, MatchAnalysis } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { cn } from "@cv-tailor/ui/lib/utils";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

import type { AiToolStatus } from "@/lib/tauri-ai";

export function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border bg-card p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 break-words font-semibold text-xl">{value}</p>
		</div>
	);
}

export function TokenList({ values }: { values: string[] }) {
	if (values.length === 0) {
		return <p className="text-muted-foreground text-xs">No keywords yet.</p>;
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{values.map((value) => (
				<span
					key={value}
					className="rounded-sm border bg-muted px-1.5 py-0.5 text-[11px]"
				>
					{value}
				</span>
			))}
		</div>
	);
}

export function SmallList({
	empty,
	values,
}: {
	empty: string;
	values: string[];
}) {
	if (values.length === 0) {
		return <p className="text-muted-foreground text-xs">{empty}</p>;
	}

	return (
		<ul className="grid gap-1 text-xs">
			{values.slice(0, 6).map((value) => (
				<li key={value} className="border-destructive border-l-2 pl-2">
					{value}
				</li>
			))}
		</ul>
	);
}

export function AnalysisPanel({
	matchAnalysis,
	signals,
}: {
	matchAnalysis: MatchAnalysis;
	signals: JobSignals;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Job Signals</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2 sm:grid-cols-3">
					<Metric label="Match" value={`${matchAnalysis.score}%`} />
					<Metric label="Level" value={signals.seniority} />
					<Metric label="Terms" value={signals.keywords.length.toString()} />
				</div>
				<div className="grid gap-2">
					<h3 className="font-medium text-sm">Detected Keywords</h3>
					<TokenList values={signals.keywords.slice(0, 18)} />
				</div>
				<div className="grid gap-2">
					<h3 className="font-medium text-sm">Missing Requirements</h3>
					<SmallList
						values={matchAnalysis.missingRequirements}
						empty="No clear gaps detected."
					/>
				</div>
			</CardContent>
		</Card>
	);
}

export function AiStatusPanel({ statuses }: { statuses: AiToolStatus[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Tool Status</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-2">
				{statuses.map((status) => (
					<div key={status.id} className="rounded-md border p-2 text-xs">
						<div className="flex items-center justify-between gap-2">
							<span className="font-medium">{status.label}</span>
							<span
								className={cn(
									"font-medium",
									status.available ? "text-primary" : "text-destructive",
								)}
							>
								{status.available ? "Ready" : "Unavailable"}
							</span>
						</div>
						<p className="mt-1 truncate text-muted-foreground">
							{status.version || status.error || "Not checked"}
						</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

export function HistoryRunCard({
	active,
	generatedCv,
	onDuplicate,
	onOpen,
}: {
	active: boolean;
	generatedCv: GeneratedCv;
	onDuplicate: () => void;
	onOpen: () => void;
}) {
	return (
		<Card
			size="sm"
			role="button"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onOpen();
				}
			}}
			className={cn(
				"cursor-pointer transition-colors hover:bg-muted/60",
				active && "ring-2 ring-primary",
			)}
		>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<span className="truncate">
						{generatedCv.jobOffer.title || "Untitled role"}
					</span>
					{active ? <CheckCircle2 className="size-4 text-primary" /> : null}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-1 text-xs">
					<p className="text-muted-foreground">
						{generatedCv.jobOffer.company || "Unknown company"} ·{" "}
						{generatedCv.aiTool}
					</p>
					<p className="text-muted-foreground">
						{new Date(generatedCv.updatedAt).toLocaleString()}
					</p>
				</div>
				<div className="grid gap-2 text-xs sm:grid-cols-3">
					<Metric label="Match" value={`${generatedCv.matchAnalysis.score}%`} />
					<Metric
						label="Keywords"
						value={generatedCv.signals.keywords.length.toString()}
					/>
					<Metric label="Level" value={generatedCv.signals.seniority} />
				</div>
				<TokenList values={generatedCv.signals.keywords.slice(0, 10)} />
				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={(event) => {
							event.stopPropagation();
							onOpen();
						}}
					>
						<ExternalLink /> Open
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={(event) => {
							event.stopPropagation();
							onDuplicate();
						}}
						title="Duplicate"
					>
						<Copy />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
