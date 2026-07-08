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
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Loader2, Printer, WandSparkles } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { PageHeader } from "@/components/app-shell";
import { GeneratedCvEditor } from "@/components/cv/generated-cv-editor";
import { AnalysisPanel } from "@/components/cv/insights";
import { type JobDraft, useCvApp } from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

export const Route = createFileRoute("/generate")({
	component: GenerateComponent,
});

function GenerateComponent() {
	const {
		activeGeneratedCv,
		appState,
		canGenerate,
		canUseSelectedAi,
		createDraftCv,
		exportPdf,
		generateCv,
		generationError,
		isExportingPdf,
		isGenerating,
		jobDraft,
		matchAnalysis,
		rawCliOutput,
		setJobDraft,
		signals,
		updateActiveCv,
	} = useCvApp();

	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="Tailoring"
				title="Generate CV"
				meta={
					activeGeneratedCv
						? `${activeGeneratedCv.jobOffer.title || "Untitled role"} · ${
								activeGeneratedCv.jobOffer.company || "Unknown company"
							}`
						: "No CV selected"
				}
				actions={
					<Button
						variant="outline"
						onClick={() => void exportPdf()}
						disabled={!activeGeneratedCv || isExportingPdf}
					>
						{isExportingPdf ? (
							<Loader2 className="animate-spin" />
						) : (
							<Printer />
						)}
						Export PDF
					</Button>
				}
			/>

			<div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
				<section className="grid content-start gap-4">
					<JobOfferPanel
						canGenerate={canGenerate}
						canUseSelectedAi={canUseSelectedAi}
						isGenerating={isGenerating}
						jobDraft={jobDraft}
						onCreateDraft={createDraftCv}
						onGenerate={() => void generateCv()}
						onJobDraftChange={setJobDraft}
					/>
					<AnalysisPanel matchAnalysis={matchAnalysis} signals={signals} />
					{generationError ? (
						<p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
							{generationError}
						</p>
					) : null}
					{rawCliOutput ? (
						<pre className="max-h-40 overflow-auto rounded-md border p-3 text-xs">
							{rawCliOutput}
						</pre>
					) : null}
				</section>

				<section className="min-w-0">
					<GeneratedCvEditor
						profile={appState.profile}
						generatedCv={activeGeneratedCv}
						onChange={updateActiveCv}
					/>
				</section>
			</div>
		</div>
	);
}

function JobOfferPanel({
	canGenerate,
	canUseSelectedAi,
	isGenerating,
	jobDraft,
	onCreateDraft,
	onGenerate,
	onJobDraftChange,
}: {
	canGenerate: boolean;
	canUseSelectedAi: boolean;
	isGenerating: boolean;
	jobDraft: JobDraft;
	onCreateDraft: () => void;
	onGenerate: () => void;
	onJobDraftChange: Dispatch<SetStateAction<JobDraft>>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Job Offer</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-2 sm:grid-cols-2">
					<div className="grid gap-1">
						<Label>Job title</Label>
						<Input
							value={jobDraft.title}
							onChange={(event) =>
								onJobDraftChange((draft) => ({
									...draft,
									title: event.target.value,
								}))
							}
							placeholder="Senior Frontend Engineer"
						/>
					</div>
					<div className="grid gap-1">
						<Label>Company</Label>
						<Input
							value={jobDraft.company}
							onChange={(event) =>
								onJobDraftChange((draft) => ({
									...draft,
									company: event.target.value,
								}))
							}
							placeholder="Hiring company"
						/>
					</div>
				</div>
				<div className="grid gap-1">
					<Label>Job description</Label>
					<Textarea
						value={jobDraft.rawText}
						onChange={(event) =>
							onJobDraftChange((draft) => ({
								...draft,
								rawText: event.target.value,
							}))
						}
						placeholder="Paste the job offer text."
						rows={12}
					/>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button onClick={onGenerate} disabled={!canGenerate}>
						{isGenerating ? (
							<Loader2 className="animate-spin" />
						) : (
							<WandSparkles />
						)}
						Generate
					</Button>
					<Button
						variant="outline"
						onClick={onCreateDraft}
						disabled={jobDraft.rawText.trim().length === 0}
					>
						<FileText /> Local draft
					</Button>
				</div>
				{!canUseSelectedAi ? (
					<p className="text-destructive text-xs">
						{isTauriRuntime()
							? "Install or authenticate claude/codex, then refresh AI tools."
							: "Open the Tauri desktop app to run local AI CLIs."}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
