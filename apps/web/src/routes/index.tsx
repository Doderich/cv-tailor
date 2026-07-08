import type { Application, CvLanguage, CvRun } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { cn } from "@cv-tailor/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	FileText,
	Languages,
	Loader2,
	Printer,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-shell";
import { CvPreview } from "@/components/cv/cv-preview";
import { GeneratedCvEditor } from "@/components/cv/generated-cv-editor";
import { HistoryRunCard } from "@/components/cv/insights";
import { ScoreBadge } from "@/components/cv/score-badge";
import { viewMeta } from "@/lib/application-views";
import {
	applicationCompany,
	applicationTitle,
	cvLanguageLabel,
	cvLanguages,
	useCvApp,
} from "@/lib/cv-app-context";
import { isTauriRuntime } from "@/lib/tauri-ai";

export const Route = createFileRoute("/")({
	component: WorkspaceRoute,
});

type StepId = "paste" | "review" | "tailor";

const steps: { id: StepId; label: string; hint: string }[] = [
	{ id: "paste", label: "Paste job", hint: "Add the offer" },
	{ id: "review", label: "Review", hint: "Check the match" },
	{ id: "tailor", label: "Tailor & export", hint: "Refine and ship" },
];

function WorkspaceRoute() {
	const { activeApplication, activeRun, activeView, createApplication } =
		useCvApp();

	if (!activeApplication) {
		return <EmptyWorkspace onCreate={createApplication} />;
	}

	if (activeView?.type === "versions") {
		return <VersionsWorkspace application={activeApplication} />;
	}

	if (activeView && activeView.type !== "editor") {
		return <ComingSoonView viewType={activeView.type} />;
	}

	return (
		<ApplicationWorkspace
			key={activeApplication.id}
			application={activeApplication}
			run={activeRun}
		/>
	);
}

function ComingSoonView({
	viewType,
}: {
	viewType: Exclude<ReturnType<typeof viewMeta>["type"], "editor" | "versions">;
}) {
	const meta = viewMeta(viewType);
	const Icon = meta.icon;

	return (
		<div className="grid min-h-[70vh] place-items-center p-6">
			<div className="grid max-w-md justify-items-center gap-4 text-center">
				<div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
					<Icon className="size-6" />
				</div>
				<div className="grid gap-1.5">
					<h2 className="font-semibold text-xl tracking-tight">{meta.label}</h2>
					<p className="text-muted-foreground text-sm">{meta.description}</p>
					<p className="mt-1 text-muted-foreground text-xs uppercase tracking-wide">
						Coming soon
					</p>
				</div>
			</div>
		</div>
	);
}

function VersionsWorkspace({ application }: { application: Application }) {
	const { activeRuns, activeRun, switchActiveRun, openView } = useCvApp();
	const sortedRuns = [...activeRuns].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 p-4 sm:p-6">
			<PageHeader
				eyebrow="Versions"
				title={applicationTitle(application)}
				meta={applicationCompany(application)}
				actions={
					<Button variant="outline" onClick={() => openView("editor")}>
						Back to editor
					</Button>
				}
			/>

			{sortedRuns.length === 0 ? (
				<div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
					No tailored versions yet. Generate an English or German CV from the
					editor.
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{sortedRuns.map((run) => (
						<HistoryRunCard
							key={run.id}
							active={run.id === activeRun?.id}
							application={application}
							run={run}
							onOpen={() => {
								switchActiveRun(run.id);
								openView("editor");
							}}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function EmptyWorkspace({ onCreate }: { onCreate: () => string }) {
	return (
		<div className="grid min-h-[70vh] place-items-center p-6">
			<div className="grid max-w-md justify-items-center gap-4 text-center">
				<div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
					<Sparkles className="size-6" />
				</div>
				<div className="grid gap-1.5">
					<h2 className="font-semibold text-xl tracking-tight">
						Start a new application
					</h2>
					<p className="text-muted-foreground text-sm">
						Paste a job offer, review how well your profile matches, then tailor
						and export focused CVs in English or German.
					</p>
				</div>
				<Button size="lg" onClick={() => onCreate()}>
					<WandSparkles /> New application
				</Button>
			</div>
		</div>
	);
}

function Stepper({
	current,
	onSelect,
}: {
	current: StepId;
	onSelect: (step: StepId) => void;
}) {
	const currentIndex = steps.findIndex((step) => step.id === current);

	return (
		<ol className="flex flex-wrap items-center gap-2">
			{steps.map((step, index) => {
				const active = step.id === current;
				const done = index < currentIndex;
				return (
					<li key={step.id} className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onSelect(step.id)}
							className={cn(
								"flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
								active
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:bg-muted",
							)}
						>
							<span
								className={cn(
									"grid size-5 place-items-center rounded-full text-xs tabular-nums",
									active || done
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground",
								)}
							>
								{index + 1}
							</span>
							<span className="font-medium text-sm">{step.label}</span>
						</button>
						{index < steps.length - 1 ? (
							<span className="hidden h-px w-6 bg-border sm:block" />
						) : null}
					</li>
				);
			})}
		</ol>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 rounded-xl border bg-card p-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-semibold text-2xl tracking-tight">{value}</p>
		</div>
	);
}

function LanguagePicker({
	value,
	onChange,
}: {
	value: CvLanguage;
	onChange: (language: CvLanguage) => void;
}) {
	return (
		<div className="inline-flex rounded-lg border bg-card p-1">
			{cvLanguages.map((language) => {
				const active = value === language;
				return (
					<button
						key={language}
						type="button"
						onClick={() => onChange(language)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						<Languages className="size-3.5" />
						{cvLanguageLabel(language)}
					</button>
				);
			})}
		</div>
	);
}

function ApplicationWorkspace({
	application,
	run,
}: {
	application: Application;
	run: CvRun | undefined;
}) {
	const {
		profile,
		selectedLanguage,
		setSelectedLanguage,
		updateActiveJobOffer,
		updateActiveCv,
		generateActive,
		canGenerateActive,
		canUseSelectedAi,
		isGenerating,
		isExportingPdf,
		generationError,
		rawCliOutput,
		exportPdf,
		openView,
	} = useCvApp();
	const hasJob = application.jobOffer.rawText.trim().length > 0;
	const [step, setStep] = useState<StepId>(hasJob ? "review" : "paste");
	const previewRun = run;
	const previewScore = previewRun?.matchAnalysis.score;

	return (
		<div className="mx-auto grid w-full max-w-[1500px] gap-6 p-4 sm:p-6">
			<PageHeader
				eyebrow="Application"
				title={applicationTitle(application)}
				meta={
					<span className="flex flex-wrap items-center gap-2">
						{applicationCompany(application)}
						{hasJob && previewScore !== undefined ? (
							<ScoreBadge score={previewScore} label=" match" />
						) : null}
					</span>
				}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" onClick={() => openView("versions")}>
							Versions
						</Button>
						<Button
							variant="outline"
							onClick={() => void exportPdf()}
							disabled={isExportingPdf || !run}
						>
							{isExportingPdf ? (
								<Loader2 className="animate-spin" />
							) : (
								<Printer />
							)}
							Export PDF
						</Button>
					</div>
				}
			/>

			<Stepper current={step} onSelect={setStep} />

			{step === "paste" ? (
				<PasteStep
					title={application.jobOffer.title}
					company={application.jobOffer.company}
					rawText={application.jobOffer.rawText}
					onChange={updateActiveJobOffer}
					onContinue={() => setStep("review")}
					canContinue={hasJob}
				/>
			) : null}

			{step === "review" ? (
				<ReviewStep
					run={previewRun}
					onBack={() => setStep("paste")}
					onContinue={() => setStep("tailor")}
				/>
			) : null}

			{step === "tailor" ? (
				<TailorStep
					application={application}
					run={run}
					profile={profile}
					selectedLanguage={selectedLanguage}
					onLanguageChange={setSelectedLanguage}
					onBack={() => setStep("review")}
					onGenerate={(language) => void generateActive(language)}
					onEditCv={updateActiveCv}
					canGenerate={canGenerateActive}
					canUseSelectedAi={canUseSelectedAi}
					isGenerating={isGenerating}
					generationError={generationError}
					rawCliOutput={rawCliOutput}
				/>
			) : null}
		</div>
	);
}

function PasteStep({
	title,
	company,
	rawText,
	onChange,
	onContinue,
	canContinue,
}: {
	title: string;
	company: string;
	rawText: string;
	onChange: (patch: {
		title?: string;
		company?: string;
		rawText?: string;
	}) => void;
	onContinue: () => void;
	canContinue: boolean;
}) {
	return (
		<div className="grid max-w-3xl gap-4">
			<div className="grid gap-4 rounded-xl border bg-card p-5">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label>Job title</Label>
						<Input
							value={title}
							onChange={(event) => onChange({ title: event.target.value })}
							placeholder="Senior Frontend Engineer"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label>Company</Label>
						<Input
							value={company}
							onChange={(event) => onChange({ company: event.target.value })}
							placeholder="Acme Inc."
						/>
					</div>
				</div>
				<div className="grid gap-1.5">
					<Label>Job description</Label>
					<Textarea
						value={rawText}
						onChange={(event) => onChange({ rawText: event.target.value })}
						placeholder="Paste the full job offer text here."
						rows={16}
					/>
				</div>
			</div>
			<div className="flex justify-end">
				<Button onClick={onContinue} disabled={!canContinue}>
					Continue to review <ArrowRight />
				</Button>
			</div>
		</div>
	);
}

function ReviewStep({
	run,
	onBack,
	onContinue,
}: {
	run: CvRun | undefined;
	onBack: () => void;
	onContinue: () => void;
}) {
	if (!run) {
		return (
			<div className="rounded-xl border bg-card p-6 text-muted-foreground text-sm">
				No CV run selected yet.
			</div>
		);
	}

	const { matchAnalysis, signals } = run;

	return (
		<div className="grid max-w-4xl gap-4">
			<div className="grid gap-3 sm:grid-cols-3">
				<Metric label="Profile match" value={`${matchAnalysis.score}%`} />
				<Metric label="Seniority" value={signals.seniority} />
				<Metric label="Keywords" value={signals.keywords.length.toString()} />
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				<div className="grid gap-2 rounded-xl border bg-card p-4">
					<h3 className="font-medium text-sm">Detected keywords</h3>
					{signals.keywords.length === 0 ? (
						<p className="text-muted-foreground text-xs">No keywords yet.</p>
					) : (
						<div className="flex flex-wrap gap-1.5">
							{signals.keywords.slice(0, 24).map((keyword) => {
								const matched = matchAnalysis.matchedKeywords.includes(keyword);
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
					)}
				</div>

				<div className="grid gap-2 rounded-xl border bg-card p-4">
					<h3 className="font-medium text-sm">Gaps to address</h3>
					{matchAnalysis.missingRequirements.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							No clear gaps detected.
						</p>
					) : (
						<ul className="grid gap-1.5 text-sm">
							{matchAnalysis.missingRequirements.slice(0, 8).map((item) => (
								<li
									key={item}
									className="border-destructive/60 border-l-2 pl-2 text-muted-foreground"
								>
									{item}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<div className="flex justify-between">
				<Button variant="ghost" onClick={onBack}>
					<ArrowLeft /> Back
				</Button>
				<Button onClick={onContinue}>
					Tailor CV <ArrowRight />
				</Button>
			</div>
		</div>
	);
}

function TailorStep({
	application,
	run,
	profile,
	selectedLanguage,
	onLanguageChange,
	onBack,
	onGenerate,
	onEditCv,
	canGenerate,
	canUseSelectedAi,
	isGenerating,
	generationError,
	rawCliOutput,
}: {
	application: Application;
	run: CvRun | undefined;
	profile: ReturnType<typeof useCvApp>["profile"];
	selectedLanguage: CvLanguage;
	onLanguageChange: (language: CvLanguage) => void;
	onBack: () => void;
	onGenerate: (language: CvLanguage) => void;
	onEditCv: ReturnType<typeof useCvApp>["updateActiveCv"];
	canGenerate: boolean;
	canUseSelectedAi: boolean;
	isGenerating: boolean;
	generationError: string | undefined;
	rawCliOutput: string | undefined;
}) {
	const hasRunForLanguage = run?.language === selectedLanguage;

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
				<div className="grid gap-2">
					<p className="font-medium text-sm">Tailor the CV to this offer</p>
					<p className="text-muted-foreground text-xs">
						Choose a language, generate with your local AI, then refine any
						section. Each language keeps its own version.
					</p>
					<LanguagePicker
						value={selectedLanguage}
						onChange={onLanguageChange}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="ghost" onClick={onBack}>
						<ArrowLeft /> Back
					</Button>
					<Button
						onClick={() => onGenerate(selectedLanguage)}
						disabled={!canGenerate}
					>
						{isGenerating ? (
							<Loader2 className="animate-spin" />
						) : (
							<WandSparkles />
						)}
						{hasRunForLanguage && run?.source !== "draft"
							? `Regenerate ${cvLanguageLabel(selectedLanguage)}`
							: `Generate ${cvLanguageLabel(selectedLanguage)}`}
					</Button>
				</div>
			</div>

			{!canUseSelectedAi ? (
				<p className="flex items-center gap-2 rounded-lg border border-accent bg-accent/40 p-3 text-xs">
					<FileText className="size-4 shrink-0" />
					{isTauriRuntime()
						? "Install or authenticate an AI tool (Claude, Codex, or Cursor), then refresh in settings."
						: "Open the Tauri desktop app to run local AI generation. You can still edit manually."}
				</p>
			) : null}

			{!hasRunForLanguage ? (
				<p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm">
					No {cvLanguageLabel(selectedLanguage)} version yet. Generate one to
					start editing and exporting.
				</p>
			) : null}

			{generationError ? (
				<p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
					{generationError}
				</p>
			) : null}

			{rawCliOutput ? (
				<pre className="max-h-40 overflow-auto rounded-lg border p-3 text-xs">
					{rawCliOutput}
				</pre>
			) : null}

			{hasRunForLanguage && run ? (
				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<section className="min-w-0">
						<GeneratedCvEditor
							profile={profile}
							application={application}
							run={run}
							onChange={onEditCv}
						/>
					</section>
					<section className="min-w-0">
						<div className="xl:sticky xl:top-4">
							<CvPreview
								profile={profile}
								application={application}
								run={run}
							/>
						</div>
					</section>
				</div>
			) : null}
		</div>
	);
}
