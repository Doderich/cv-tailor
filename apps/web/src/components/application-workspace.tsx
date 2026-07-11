import { buildJobOfferFromFetchedPage, type Application, type CvLanguage, type CvRun, type JobPosition, jobOfferNeedsReview, jobPositions } from "@cv-tailor/core";
import { Button } from "@cv-tailor/ui/components/button";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@cv-tailor/ui/components/select";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	FileText,
	Languages,
	Link2,
	Loader2,
	Printer,
	Sparkles,
	TriangleAlert,
	WandSparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ArrayLinesField } from "@/components/array-lines-field";
import { CvPreview } from "@/components/cv/cv-preview";
import { GeneratedCvEditor } from "@/components/cv/generated-cv-editor";
import {
	KeywordMatchGrid,
	MatchBulletList,
} from "@/components/cv/insights";
import { applicationStepPath } from "@/lib/application-route";
import { isAnalysisInProgress } from "@/lib/application-steps";
import { cvLanguages, useCvApp } from "@/lib/cv-app-context";
import { useCvLanguageLabel, useJobPositionLabel } from "@/lib/i18n-labels";
import { formatSourceError, parseSourceUrls } from "@/lib/profile-source-urls";
import {
	fetchUrlText,
	isTauriRuntime,
} from "@/lib/tauri-ai";

function ApplicationStepShell({
	children,
	actions,
}: {
	children: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="mx-auto grid w-full max-w-[1500px] gap-6 p-4 sm:p-6">
			{actions ? <div className="flex justify-end">{actions}</div> : null}
			{children}
		</div>
	);
}

export function JobDetailsStep({ application }: { application: Application }) {
	const navigate = useNavigate();
	const { updateActiveJobOffer, flushActiveJobOffer } = useCvApp();

	return (
		<ApplicationStepShell>
			<PasteStep
				title={application.jobOffer.title}
				company={application.jobOffer.company}
				position={application.jobOffer.position ?? "unspecified"}
				links={application.jobOffer.links ?? []}
				rawText={application.jobOffer.rawText}
				onChange={updateActiveJobOffer}
				onContinue={() => {
					flushActiveJobOffer();
					void navigate(applicationStepPath(application.id, "review"));
				}}
			/>
		</ApplicationStepShell>
	);
}

export function ReviewStep({
	application,
	run,
}: {
	application: Application;
	run: CvRun | undefined;
}) {
	const navigate = useNavigate();

	return (
		<ApplicationStepShell>
			<ReviewStepContent
				application={application}
				run={run}
				onBack={() =>
					void navigate(applicationStepPath(application.id, "job-details"))
				}
				onContinue={() =>
					void navigate(applicationStepPath(application.id, "generate-cv"))
				}
			/>
		</ApplicationStepShell>
	);
}

export function GenerateCvStep({
	application,
	run,
}: {
	application: Application;
	run: CvRun | undefined;
}) {
	const navigate = useNavigate();
	const {
		profile,
		selectedLanguage,
		setSelectedLanguage,
		updateActiveCv,
		generateActive,
		canGenerateActive,
		canUseSelectedAi,
		isGenerating,
		isExportingPdf,
		generationError,
		rawCliOutput,
		exportPdf,
	} = useCvApp();

	return (
		<ApplicationStepShell>
			<TailorStep
				application={application}
				run={run}
				profile={profile}
				selectedLanguage={selectedLanguage}
				onLanguageChange={setSelectedLanguage}
				onBack={() =>
					void navigate(applicationStepPath(application.id, "review"))
				}
				onGenerate={(language) => void generateActive(language)}
				onEditCv={updateActiveCv}
				onExportPdf={() => void exportPdf()}
				canGenerate={canGenerateActive}
				canUseSelectedAi={canUseSelectedAi}
				isGenerating={isGenerating}
				isExportingPdf={isExportingPdf}
				generationError={generationError}
				rawCliOutput={rawCliOutput}
			/>
		</ApplicationStepShell>
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
	const cvLanguageLabel = useCvLanguageLabel();

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

function PasteStep({
	title,
	company,
	position,
	links,
	rawText,
	onChange,
	onContinue,
}: {
	title: string;
	company: string;
	position: JobPosition;
	links: string[];
	rawText: string;
	onChange: (patch: {
		title?: string;
		company?: string;
		position?: JobPosition;
		links?: string[];
		rawText?: string;
	}) => void;
	onContinue: () => void;
}) {
	const { t } = useTranslation();
	const jobPositionLabel = useJobPositionLabel();
	const [importMode, setImportMode] = useState<"paste" | "url">("paste");
	const [sourceUrl, setSourceUrl] = useState(links[0] ?? "");
	const [isFetching, setIsFetching] = useState(false);
	const [draft, setDraft] = useState({
		title,
		company,
		position,
		links,
		rawText,
	});
	const canImportUrl = isTauriRuntime();
	const canContinue =
		draft.title.trim().length > 0 &&
		draft.company.trim().length > 0 &&
		draft.rawText.trim().length > 0;

	useEffect(() => {
		setDraft({ title, company, position, links, rawText });
	}, [title, company, position, links, rawText]);

	function updateDraft(patch: Partial<typeof draft>) {
		const next = { ...draft, ...patch };
		setDraft(next);
		onChange(patch);
	}

	async function handleImportFromUrl() {
		const urls = parseSourceUrls(sourceUrl);
		const url = urls[0];
		if (!url) {
			toast.error(t("application.jobDetails.toast.invalidUrl"));
			return;
		}

		if (!canImportUrl) {
			toast.error(t("application.jobDetails.toast.urlImportDesktopOnly"));
			return;
		}

		setIsFetching(true);
		try {
			const response = await fetchUrlText(url);
			const extracted = buildJobOfferFromFetchedPage({
				text: response.text,
				url: response.url,
			});
			updateDraft(extracted);
			onChange(extracted);
			toast.success(t("application.jobDetails.toast.importSuccess"));
		} catch (error) {
			toast.error(t("application.jobDetails.toast.importFailed"), {
				description: formatSourceError(error),
			});
		} finally {
			setIsFetching(false);
		}
	}

	return (
		<div className="grid w-full gap-5">
			<div className="grid gap-5 rounded-xl border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="font-medium text-sm">
							{t("application.jobDetails.title")}
						</h3>
						<p className="text-muted-foreground text-xs">
							{t("application.jobDetails.subtitle")}
						</p>
					</div>
					<div className="inline-flex rounded-md border bg-background p-0.5">
						<button
							type="button"
							onClick={() => setImportMode("paste")}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
								importMode === "paste"
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							<FileText className="size-3.5" />
							{t("application.jobDetails.mode.paste")}
						</button>
						<button
							type="button"
							onClick={() => setImportMode("url")}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
								importMode === "url"
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							<Link2 className="size-3.5" />
							{t("application.jobDetails.mode.url")}
						</button>
					</div>
				</div>

				{importMode === "url" ? (
					<div className="grid gap-3 rounded-lg border bg-muted/20 p-4">
						<div className="grid gap-2">
							<Label htmlFor="job-posting-url">
								{t("application.jobDetails.url.label")}
							</Label>
							<Input
								id="job-posting-url"
								value={sourceUrl}
								onChange={(event) => setSourceUrl(event.target.value)}
								placeholder={t("application.jobDetails.url.placeholder")}
							/>
						</div>
						<p className="text-muted-foreground text-sm">
							{canImportUrl
								? t("application.jobDetails.url.helpDesktop")
								: t("application.jobDetails.url.helpWeb")}
						</p>
						<div className="flex justify-end">
							<Button
								onClick={() => void handleImportFromUrl()}
								disabled={isFetching || !canImportUrl}
							>
								{isFetching ? (
									<Loader2 className="animate-spin" />
								) : (
									<Link2 />
								)}
								{t("application.jobDetails.url.importButton")}
							</Button>
						</div>
					</div>
				) : null}

				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="job-title">
							{t("application.jobDetails.field.jobTitle.label")}
						</Label>
						<Input
							id="job-title"
							value={draft.title}
							onChange={(event) =>
								updateDraft({ title: event.target.value })
							}
							placeholder={t(
								"application.jobDetails.field.jobTitle.placeholder",
							)}
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="job-company">
								{t("application.jobDetails.field.company.label")}
							</Label>
							<Input
								id="job-company"
								value={draft.company}
								onChange={(event) =>
									updateDraft({ company: event.target.value })
								}
								placeholder={t(
									"application.jobDetails.field.company.placeholder",
								)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="job-position-type">
								{t("application.jobDetails.field.positionType.label")}
							</Label>
							<Select
								value={draft.position}
								onValueChange={(value) => {
									if (value) {
										updateDraft({ position: value as JobPosition });
									}
								}}
							>
								<SelectTrigger
									id="job-position-type"
									aria-label={t(
										"application.jobDetails.field.positionType.ariaLabel",
									)}
								>
									<SelectValue
										placeholder={t(
											"application.jobDetails.field.positionType.placeholder",
										)}
									>
										{jobPositionLabel(draft.position)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{jobPositions.map((option) => (
										<SelectItem key={option} value={option}>
											{jobPositionLabel(option)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<ArrayLinesField
						label={t("application.jobDetails.field.links.label")}
						values={draft.links}
						onChange={(nextLinks) => updateDraft({ links: nextLinks })}
						placeholder={t("application.jobDetails.field.links.placeholder")}
						rows={2}
					/>

					<div className="grid gap-2">
						<Label htmlFor="job-description">
							{t("application.jobDetails.field.description.label")}
						</Label>
						<Textarea
							id="job-description"
							value={draft.rawText}
							onChange={(event) =>
								updateDraft({ rawText: event.target.value })
							}
							placeholder={t(
								"application.jobDetails.field.description.placeholder",
							)}
							rows={16}
							className="min-h-56"
						/>
					</div>
				</div>
			</div>
			<div className="flex justify-end">
				<Button onClick={onContinue} disabled={!canContinue}>
					{t("application.jobDetails.continue")} <ArrowRight />
				</Button>
			</div>
		</div>
	);
}

function ReviewStepContent({
	application,
	run,
	onBack,
	onContinue,
}: {
	application: Application;
	run: CvRun | undefined;
	onBack: () => void;
	onContinue: () => void;
}) {
	const { t } = useTranslation();
	const {
		reviewActiveJobOffer,
		analyzeActiveProfileMatch,
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		jobReviewError,
		profileMatchError,
		rawJobReviewOutput,
		rawProfileMatchOutput,
		canUseSelectedAi,
	} = useCvApp();
	const needsReview = jobOfferNeedsReview(application.jobOffer);
	const review = application.jobOffer.review;
	const autoReviewKey = `${application.id}:${application.jobOffer.rawText.trim()}`;
	const lastAutoReviewKeyRef = useRef<string | null>(null);
	const lastAutoMatchKeyRef = useRef<string | null>(null);
	const autoMatchKey = `${application.id}:${run?.id ?? "none"}:${run?.matchAnalysis.source ?? "draft"}:${application.jobOffer.review?.reviewedAt ?? "none"}`;

	useEffect(() => {
		if (!needsReview || !canUseSelectedAi || isReviewingJobOffer) {
			return;
		}
		if (lastAutoReviewKeyRef.current === autoReviewKey) {
			return;
		}
		lastAutoReviewKeyRef.current = autoReviewKey;
		void reviewActiveJobOffer();
	}, [
		autoReviewKey,
		needsReview,
		canUseSelectedAi,
		isReviewingJobOffer,
		reviewActiveJobOffer,
	]);

	useEffect(() => {
		if (needsReview || isReviewingJobOffer || isAnalyzingProfileMatch) {
			return;
		}
		if (!canUseSelectedAi || !run) {
			return;
		}
		if (run.matchAnalysis.source === "ai") {
			return;
		}
		if (lastAutoMatchKeyRef.current === autoMatchKey) {
			return;
		}
		lastAutoMatchKeyRef.current = autoMatchKey;
		void analyzeActiveProfileMatch();
	}, [
		autoMatchKey,
		needsReview,
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		canUseSelectedAi,
		run,
		analyzeActiveProfileMatch,
	]);

	if (!run) {
		return (
			<div className="rounded-xl border bg-card p-6 text-muted-foreground text-sm">
				{t("application.review.noRun")}
			</div>
		);
	}

	const { matchAnalysis, signals } = run;
	const analysisState = {
		isReviewingJobOffer,
		isAnalyzingProfileMatch,
		canUseSelectedAi,
	};
	const isAnalyzing = isAnalysisInProgress(application, analysisState);
	const canContinue = !isAnalyzing;
	const statusMessage = isReviewingJobOffer
		? t("application.review.status.reviewingJob")
		: isAnalyzingProfileMatch
			? t("application.review.status.analyzingMatch")
			: isAnalyzing
				? t("application.review.status.preparing")
				: review
					? t("application.review.status.reviewed", {
							reviewTool: review.reviewTool,
							evaluatorSuffix: matchAnalysis.evaluatorTool
								? t("application.review.status.evaluatorWithTool", {
										evaluatorTool: matchAnalysis.evaluatorTool,
									})
								: matchAnalysis.source === "draft"
									? t("application.review.status.evaluatorHeuristics")
									: "",
						})
					: canUseSelectedAi
						? t("application.review.status.waiting")
						: t("application.review.status.aiUnavailable");

	return (
		<div className="grid w-full gap-5">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
				<div className="grid gap-1">
					<h3 className="font-medium text-sm">
						{t("application.review.title")}
					</h3>
					<p className="text-muted-foreground text-xs">{statusMessage}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => void analyzeActiveProfileMatch({ force: true })}
						disabled={
							isAnalyzingProfileMatch || isReviewingJobOffer || !canUseSelectedAi
						}
					>
						{isAnalyzingProfileMatch ? (
							<Loader2 className="animate-spin" />
						) : (
							<Sparkles />
						)}
						{t("application.review.rematch")}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void reviewActiveJobOffer({ force: true })}
						disabled={isReviewingJobOffer || !canUseSelectedAi}
					>
						{isReviewingJobOffer ? (
							<Loader2 className="animate-spin" />
						) : (
							<Sparkles />
						)}
						{t("application.review.reanalyze")}
					</Button>
				</div>
			</div>

			{review?.summary ? (
				<div className="rounded-xl border bg-card p-4 text-sm">
					<h3 className="mb-2 font-medium text-sm">
						{t("application.review.roleSummary")}
					</h3>
					<p className="text-muted-foreground leading-relaxed">{review.summary}</p>
				</div>
			) : null}

			{jobReviewError ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
					{jobReviewError}
				</div>
			) : null}

			{rawJobReviewOutput ? (
				<pre className="max-h-48 overflow-auto rounded-xl border bg-muted/40 p-3 text-xs">
					{rawJobReviewOutput}
				</pre>
			) : null}

			{profileMatchError ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
					{profileMatchError}
				</div>
			) : null}

			{rawProfileMatchOutput ? (
				<pre className="max-h-48 overflow-auto rounded-xl border bg-muted/40 p-3 text-xs">
					{rawProfileMatchOutput}
				</pre>
			) : null}

			<div className="grid gap-3 sm:grid-cols-3">
				<Metric
					label={t("application.review.metric.profileMatch")}
					value={isAnalyzing ? t("common.loading") : `${matchAnalysis.score}%`}
				/>
				<Metric
					label={t("application.review.metric.seniority")}
					value={isAnalyzing ? t("common.loading") : signals.seniority}
				/>
				<Metric
					label={t("application.review.metric.keywords")}
					value={
						isAnalyzing ? t("common.loading") : signals.keywords.length.toString()
					}
				/>
			</div>

			<section className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 font-medium text-sm">
					{t("application.review.detectedKeywords")}
				</h3>
				<KeywordMatchGrid
					keywords={signals.keywords}
					matchedKeywords={matchAnalysis.matchedKeywords}
					loading={isAnalyzing}
				/>
			</section>

			<div className="grid items-start gap-3 lg:grid-cols-2">
				<MatchBulletList
					title={t("application.review.goodFit.title")}
					icon={CheckCircle2}
					items={matchAnalysis.goodFit ?? []}
					empty={t("application.review.goodFit.empty")}
					loading={isAnalyzing}
					tone="positive"
					limit={6}
				/>
				<MatchBulletList
					title={t("application.review.gaps.title")}
					icon={TriangleAlert}
					items={matchAnalysis.missingRequirements}
					empty={t("application.review.gaps.empty")}
					loading={isAnalyzing}
					tone="negative"
					limit={6}
				/>
			</div>

			<div className="flex justify-between pt-1">
				<Button variant="ghost" onClick={onBack}>
					<ArrowLeft /> {t("common.back")}
				</Button>
				<Button onClick={onContinue} disabled={!canContinue}>
					{t("application.review.generateCv")} <ArrowRight />
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
	onExportPdf,
	canGenerate,
	canUseSelectedAi,
	isGenerating,
	isExportingPdf,
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
	onExportPdf: () => void;
	canGenerate: boolean;
	canUseSelectedAi: boolean;
	isGenerating: boolean;
	isExportingPdf: boolean;
	generationError: string | undefined;
	rawCliOutput: string | undefined;
}) {
	const { t } = useTranslation();
	const cvLanguageLabel = useCvLanguageLabel();
	const hasRunForLanguage = run?.language === selectedLanguage;

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
				<div className="grid gap-2">
					<p className="font-medium text-sm">
						{t("application.generate.title")}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("application.generate.subtitle")}
					</p>
					<LanguagePicker
						value={selectedLanguage}
						onChange={onLanguageChange}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="ghost" onClick={onBack}>
						<ArrowLeft /> {t("common.back")}
					</Button>
					<Button
						variant="outline"
						onClick={onExportPdf}
						disabled={isExportingPdf || !run}
					>
						{isExportingPdf ? (
							<Loader2 className="animate-spin" />
						) : (
							<Printer />
						)}
						{t("application.generate.exportPdf")}
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
							? t("application.generate.regenerate", {
									language: cvLanguageLabel(selectedLanguage),
								})
							: t("application.generate.generate", {
									language: cvLanguageLabel(selectedLanguage),
								})}
					</Button>
				</div>
			</div>

			{!canUseSelectedAi ? (
				<p className="flex items-center gap-2 rounded-lg border border-accent bg-accent/40 p-3 text-xs">
					<FileText className="size-4 shrink-0" />
					{isTauriRuntime()
						? t("application.generate.aiSetupDesktop")
						: t("application.generate.aiSetupWeb")}
				</p>
			) : null}

			{!hasRunForLanguage ? (
				<p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm">
					{t("application.generate.noVersionYet", {
						language: cvLanguageLabel(selectedLanguage),
					})}
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
