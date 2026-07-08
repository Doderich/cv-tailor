import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileClock, Printer } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { AiStatusPanel, HistoryRunCard } from "@/components/cv/insights";
import { useCvApp } from "@/lib/cv-app-context";

export const Route = createFileRoute("/history")({
	component: HistoryComponent,
});

function HistoryComponent() {
	const {
		activeGeneratedCv,
		aiStatuses,
		appState,
		duplicateGeneratedCv,
		exportPdf,
		isExportingPdf,
		reopenGeneratedCv,
	} = useCvApp();
	const navigate = useNavigate();

	function openRun(generatedCv: NonNullable<typeof activeGeneratedCv>) {
		reopenGeneratedCv(generatedCv);
		void navigate({ to: "/generate" });
	}

	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="Runs"
				title="History"
				meta={`${appState.generatedCvs.length} generated CVs`}
				actions={
					<Button
						variant="outline"
						onClick={() => void exportPdf()}
						disabled={!activeGeneratedCv || isExportingPdf}
					>
						<Printer /> Export Active
					</Button>
				}
			/>

			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<section className="min-w-0">
					{appState.generatedCvs.length === 0 ? (
						<EmptyHistory />
					) : (
						<div className="grid gap-3 md:grid-cols-2">
							{appState.generatedCvs.map((generatedCv) => (
								<HistoryRunCard
									key={generatedCv.id}
									active={generatedCv.id === activeGeneratedCv?.id}
									generatedCv={generatedCv}
									onDuplicate={() => duplicateGeneratedCv(generatedCv)}
									onOpen={() => openRun(generatedCv)}
								/>
							))}
						</div>
					)}
				</section>

				<aside className="grid content-start gap-4">
					<AiStatusPanel statuses={aiStatuses} />
					{activeGeneratedCv ? <ActiveRunSummary /> : null}
				</aside>
			</div>
		</div>
	);
}

function EmptyHistory() {
	return (
		<div className="grid min-h-72 place-items-center rounded-md border border-dashed p-6 text-center">
			<div className="grid justify-items-center gap-2">
				<FileClock className="size-8 text-muted-foreground" />
				<p className="font-medium text-sm">No runs yet</p>
			</div>
		</div>
	);
}

function ActiveRunSummary() {
	const { activeGeneratedCv } = useCvApp();

	if (!activeGeneratedCv) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Active Run</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3 text-xs">
				<SummaryRow
					label="Role"
					value={activeGeneratedCv.jobOffer.title || "Untitled role"}
				/>
				<SummaryRow
					label="Company"
					value={activeGeneratedCv.jobOffer.company || "Unknown company"}
				/>
				<SummaryRow
					label="Updated"
					value={new Date(activeGeneratedCv.updatedAt).toLocaleString()}
				/>
				<SummaryRow
					label="Score"
					value={`${activeGeneratedCv.matchAnalysis.score}%`}
				/>
			</CardContent>
		</Card>
	);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 rounded-md border p-2">
			<span className="text-muted-foreground">{label}</span>
			<span className="break-words font-medium">{value}</span>
		</div>
	);
}
