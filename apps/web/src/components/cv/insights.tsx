import type {
	Application,
	CvRun,
	JobSignals,
	MatchAnalysis,
} from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { cn } from "@cv-tailor/ui/lib/utils";
import { CheckCircle2, ExternalLink, TriangleAlert } from "lucide-react";

import type { AiToolStatus } from "@/lib/tauri-ai";

export function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border bg-card p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 break-words font-semibold text-2xl">{value}</p>
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
	tone = "negative",
}: {
	empty: string;
	values: string[];
	tone?: "positive" | "negative";
}) {
	if (values.length === 0) {
		return <p className="text-muted-foreground text-xs">{empty}</p>;
	}

	return (
		<ul className="grid gap-1.5 text-sm">
			{values.slice(0, 8).map((value) => (
				<li
					key={value}
					className={cn(
						"pl-2",
						tone === "positive"
							? "border-primary/60 border-l-2 text-foreground"
							: "border-destructive/60 border-l-2 text-muted-foreground",
					)}
				>
					{value}
				</li>
			))}
		</ul>
	);
}

export function KeywordMatchGrid({
	keywords,
	matchedKeywords,
	loading = false,
	limit = 32,
}: {
	keywords: string[];
	matchedKeywords: string[];
	loading?: boolean;
	limit?: number;
}) {
	if (loading) {
		return <p className="text-muted-foreground text-xs">Analyzing posting…</p>;
	}

	if (keywords.length === 0) {
		return <p className="text-muted-foreground text-xs">No keywords yet.</p>;
	}

	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap gap-1.5">
				{keywords.slice(0, limit).map((keyword) => {
					const matched = matchedKeywords.includes(keyword);
					return (
						<span
							key={keyword}
							className={cn(
								"rounded-md px-2 py-0.5 text-xs",
								matched
									? "bg-primary/15 text-primary"
									: "bg-muted text-muted-foreground",
							)}
						>
							{keyword}
						</span>
					);
				})}
			</div>
			<p className="text-muted-foreground text-xs">
				Highlighted tags appear in your profile. Muted tags still need stronger
				coverage.
			</p>
		</div>
	);
}

export function MatchBulletList({
	title,
	icon: Icon,
	items,
	empty,
	loading = false,
	tone = "negative",
	limit = 6,
	embedded = false,
}: {
	title: string;
	icon?: typeof CheckCircle2;
	items: string[];
	empty: string;
	loading?: boolean;
	tone?: "positive" | "negative";
	limit?: number;
	embedded?: boolean;
}) {
	return (
		<section
			className={cn(
				"flex flex-col gap-3",
				!embedded && "rounded-xl border bg-card p-4",
			)}
		>
			<div className="flex items-center gap-2">
				{Icon ? (
					<Icon
						className={cn(
							"size-4 shrink-0",
							tone === "positive" ? "text-primary" : "text-destructive",
						)}
					/>
				) : null}
				<h3 className="font-medium text-sm">{title}</h3>
				{!loading && items.length > 0 ? (
					<span className="ml-auto text-muted-foreground text-xs">
						{Math.min(items.length, limit)}
						{items.length > limit ? ` of ${items.length}` : ""}
					</span>
				) : null}
			</div>
			{loading ? (
				<p className="text-muted-foreground text-xs">Analyzing profile fit…</p>
			) : items.length === 0 ? (
				<p className="text-muted-foreground text-sm">{empty}</p>
			) : (
				<ul className="grid gap-2.5">
					{items.slice(0, limit).map((item) => (
						<li
							key={item}
							className={cn(
								"break-words border-l-2 pl-3 text-sm leading-relaxed",
								tone === "positive"
									? "border-primary/60 text-foreground"
									: "border-destructive/60 text-muted-foreground",
							)}
						>
							{item}
						</li>
					))}
				</ul>
			)}
		</section>
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
					<KeywordMatchGrid
						keywords={signals.keywords}
						matchedKeywords={matchAnalysis.matchedKeywords}
						limit={18}
					/>
				</div>
				<div className="grid gap-3 md:grid-cols-2">
					<MatchBulletList
						title="Good fit"
						icon={CheckCircle2}
						items={matchAnalysis.goodFit ?? []}
						empty="No clear strengths detected yet."
						tone="positive"
						embedded
					/>
					<MatchBulletList
						title="Gaps to address"
						icon={TriangleAlert}
						items={matchAnalysis.missingRequirements}
						empty="No clear gaps detected."
						tone="negative"
						embedded
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
					<div key={status.id} className="rounded-md border p-3 text-sm">
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
	application,
	run,
	onOpen,
}: {
	active: boolean;
	application: Application;
	run: CvRun;
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
					<span className="truncate">{run.label}</span>
					{active ? <CheckCircle2 className="size-4 text-primary" /> : null}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-1 text-xs">
					<p className="text-muted-foreground">
						{applicationTitle(application)} · {run.aiTool}
					</p>
					<p className="text-muted-foreground">
						{new Date(run.updatedAt).toLocaleString()}
					</p>
				</div>
				<div className="grid gap-2 text-xs sm:grid-cols-3">
					<Metric label="Match" value={`${run.matchAnalysis.score}%`} />
					<Metric
						label="Keywords"
						value={run.signals.keywords.length.toString()}
					/>
					<Metric label="Level" value={run.signals.seniority} />
				</div>
				<TokenList values={run.signals.keywords.slice(0, 10)} />
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
				</div>
			</CardContent>
		</Card>
	);
}

function applicationTitle(application: Application) {
	return application.jobOffer.title.trim() || "Untitled role";
}
