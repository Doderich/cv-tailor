import { Button } from "@cv-tailor/ui/components/button";
import { Label } from "@cv-tailor/ui/components/label";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useLiveQuery } from "@tanstack/react-db";
import { Download, Loader2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCvApp } from "@/lib/cv-app-context";
import { useDb } from "@/lib/db-provider";

type ImportMode = "replace" | "merge";

const segmentedContainerClass =
	"inline-flex w-fit rounded-md border bg-card p-0.5";
const segmentedButtonClass =
	"rounded-sm px-2.5 py-1 text-sm font-medium transition-colors";

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
		exportAllData,
		importAllData,
		isExportingData,
		isImportingData,
	} = useCvApp();
	const inputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importMode, setImportMode] = useState<ImportMode>("merge");

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

			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={() => void exportAllData()}
					disabled={isExportingData || isImportingData}
				>
					{isExportingData ? (
						<Loader2 className="animate-spin" />
					) : (
						<Download />
					)}
					{t("backup.export")}
				</Button>

				<Button
					variant="outline"
					onClick={() => fileInputRef.current?.click()}
					disabled={isExportingData || isImportingData}
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
