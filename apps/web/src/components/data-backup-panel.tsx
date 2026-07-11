import { Button } from "@cv-tailor/ui/components/button";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import { cn } from "@cv-tailor/ui/lib/utils";
import { interactiveSegment } from "@cv-tailor/ui/lib/interactive-styles";
import { useLiveQuery } from "@tanstack/react-db";
import {
	Camera,
	Download,
	Loader2,
	RotateCcw,
	Trash2,
	Upload,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { defaultSnapshotName, formatSnapshotDate } from "@/lib/data-snapshots";
import { useCvApp } from "@/lib/cv-app-context";
import { useDb } from "@/lib/db-provider";

type ImportMode = "replace" | "merge";

const segmentedContainerClass =
	"inline-flex w-fit rounded-md border bg-card p-0.5";
const segmentedButtonClass = `rounded-sm px-2.5 py-1 font-medium text-sm ${interactiveSegment}`;

function ImportModeControl({
	value,
	onChange,
}: {
	value: ImportMode;
	onChange: (value: ImportMode) => void;
}) {
	const { t } = useTranslation();
	const options: { id: ImportMode; label: string }[] = [
		{ id: "merge", label: t("backup.merge") },
		{ id: "replace", label: t("backup.replaceAll") },
	];

	return (
		<div className={segmentedContainerClass}>
			{options.map((option) => {
				const active = value === option.id;
				return (
					<button
						key={option.id}
						type="button"
						onClick={() => onChange(option.id)}
						className={cn(
							segmentedButtonClass,
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

export function DataBackupPanel() {
	const { t } = useTranslation();
	const db = useDb();
	const { data: runs = [] } = useLiveQuery((q) => q.from({ run: db.cvRuns }));
	const {
		applications,
		profiles,
		importAllData,
		isImportingData,
		isCreatingDataSnapshot,
		isLoadingDataSnapshots,
		dataSnapshots,
		createDataSnapshot,
		restoreDataSnapshot,
		downloadDataSnapshot,
		deleteDataSnapshot,
	} = useCvApp();
	const inputId = useId();
	const snapshotNameId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importMode, setImportMode] = useState<ImportMode>("merge");
	const [snapshotName, setSnapshotName] = useState(() => defaultSnapshotName());

	async function handleImport(file: File | undefined) {
		if (!file) {
			return;
		}

		if (
			importMode === "replace" &&
			!window.confirm(t("backup.confirmReplace"))
		) {
			return;
		}

		try {
			await importAllData(file, importMode);
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	}

	async function handleCreateSnapshot() {
		const name = snapshotName.trim() || defaultSnapshotName();
		await createDataSnapshot(name);
		setSnapshotName(defaultSnapshotName());
	}

	async function handleRestoreSnapshot(id: string) {
		if (
			importMode === "replace" &&
			!window.confirm(t("backup.confirmReplace"))
		) {
			return;
		}

		await restoreDataSnapshot(id, importMode);
	}

	async function handleDeleteSnapshot(id: string) {
		if (!window.confirm(t("backup.confirmDeleteSnapshot"))) {
			return;
		}

		await deleteDataSnapshot(id);
	}

	const isBusy = isCreatingDataSnapshot || isImportingData;

	return (
		<div className="grid gap-4 rounded-xl border bg-card p-4">
			<div className="grid gap-1">
				<h3 className="font-medium text-base">{t("backup.title")}</h3>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{t("backup.description")}
				</p>
			</div>

			<div className="grid gap-2 text-sm sm:grid-cols-3">
				<div className="rounded-lg border bg-background px-3 py-2">
					<div className="text-muted-foreground text-xs">
						{t("backup.profiles")}
					</div>
					<div className="font-medium">{profiles.length}</div>
				</div>
				<div className="rounded-lg border bg-background px-3 py-2">
					<div className="text-muted-foreground text-xs">
						{t("backup.applications")}
					</div>
					<div className="font-medium">{applications.length}</div>
				</div>
				<div className="rounded-lg border bg-background px-3 py-2">
					<div className="text-muted-foreground text-xs">
						{t("backup.cvVersions")}
					</div>
					<div className="font-medium">{runs.length}</div>
				</div>
			</div>

			<div className="grid gap-2">
				<Label htmlFor={snapshotNameId}>{t("backup.snapshotName")}</Label>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						id={snapshotNameId}
						value={snapshotName}
						onChange={(event) => setSnapshotName(event.target.value)}
						placeholder={t("backup.snapshotNamePlaceholder")}
						disabled={isBusy}
					/>
					<Button
						onClick={() => void handleCreateSnapshot()}
						disabled={isBusy}
						className="shrink-0"
					>
						{isCreatingDataSnapshot ? (
							<Loader2 className="animate-spin" />
						) : (
							<Camera />
						)}
						{t("backup.createSnapshot")}
					</Button>
				</div>
				<p className="text-muted-foreground text-xs leading-relaxed">
					{t("backup.snapshotHelp")}
				</p>
			</div>

			<div className="grid gap-2">
				<div className="flex items-center justify-between gap-2">
					<Label>{t("backup.snapshots")}</Label>
					{isLoadingDataSnapshots ? (
						<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
							<Loader2 className="size-3 animate-spin" />
							{t("backup.loadingSnapshots")}
						</span>
					) : null}
				</div>

				{dataSnapshots.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-background px-3 py-4 text-muted-foreground text-sm">
						{t("backup.noSnapshots")}
					</div>
				) : (
					<div className="grid gap-2">
						{dataSnapshots.map((snapshot) => (
							<div
								key={snapshot.id}
								className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div className="min-w-0 grid gap-1">
									<div className="truncate font-medium">{snapshot.name}</div>
									<div className="text-muted-foreground text-xs">
										{formatSnapshotDate(snapshot.createdAt)}
									</div>
									<div className="text-muted-foreground text-xs">
										{t("backup.snapshotSummary", {
											profiles: snapshot.profiles,
											applications: snapshot.applications,
											cvRuns: snapshot.cvRuns,
										})}
									</div>
								</div>

								<div className="flex flex-wrap gap-2 sm:justify-end">
									<Button
										variant="outline"
										size="sm"
										onClick={() => void handleRestoreSnapshot(snapshot.id)}
										disabled={isBusy}
									>
										<RotateCcw />
										{t("backup.restoreSnapshot")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => void downloadDataSnapshot(snapshot.id)}
										disabled={isBusy}
									>
										<Download />
										{t("backup.downloadSnapshot")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => void handleDeleteSnapshot(snapshot.id)}
										disabled={isBusy}
									>
										<Trash2 />
										{t("backup.deleteSnapshot")}
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={() => fileInputRef.current?.click()}
					disabled={isBusy}
				>
					{isImportingData ? <Loader2 className="animate-spin" /> : <Upload />}
					{t("backup.import")}
				</Button>
				<input
					ref={fileInputRef}
					id={inputId}
					type="file"
					accept="application/json,.json"
					className="hidden"
					onChange={(event) => void handleImport(event.target.files?.[0])}
				/>
			</div>

			<div className="grid gap-2">
				<Label>{t("backup.importMode")}</Label>
				<ImportModeControl value={importMode} onChange={setImportMode} />
				<p className="text-muted-foreground text-xs leading-relaxed">
					{importMode === "merge"
						? t("backup.mergeHelp")
						: t("backup.replaceHelp")}
				</p>
			</div>
		</div>
	);
}
