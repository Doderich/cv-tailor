import { createBackupSnapshot } from "@cv-tailor/db";
import { Button } from "@cv-tailor/ui/components/button";
import { Input } from "@cv-tailor/ui/components/input";
import { Label } from "@cv-tailor/ui/components/label";
import { interactiveSegment } from "@cv-tailor/ui/lib/interactive-styles";
import { cn } from "@cv-tailor/ui/lib/utils";
import { useLiveQuery } from "@tanstack/react-db";
import {
	Camera,
	CloudUpload,
	Download,
	Loader2,
	RefreshCw,
	RotateCcw,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
	type CloudBackupObjectMeta,
	cloudBackupFileName,
	downloadCloudBackup,
	formatCloudBackupBytes,
	hasCloudBackupRuntime,
	listCloudBackups,
	testCloudBackup,
	toCloudBackupRuntimeConfig,
	uploadCloudBackup,
} from "@/lib/cloud-backup";
import { useCvApp } from "@/lib/cv-app-context";
import { defaultSnapshotName, formatSnapshotDate } from "@/lib/data-snapshots";
import { useDb } from "@/lib/db-provider";
import { formatAppError, isTauriRuntime } from "@/lib/tauri-ai";

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
		cloudBackup,
		setCloudBackup,
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
	const cloudEndpointId = useId();
	const cloudBucketId = useId();
	const cloudRegionId = useId();
	const cloudAccessKeyId = useId();
	const cloudSecretKeyId = useId();
	const cloudPrefixId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importMode, setImportMode] = useState<ImportMode>("merge");
	const [snapshotName, setSnapshotName] = useState(() => defaultSnapshotName());
	const [remoteObjects, setRemoteObjects] = useState<CloudBackupObjectMeta[]>(
		[],
	);
	const [isTestingCloud, setIsTestingCloud] = useState(false);
	const [isUploadingCloud, setIsUploadingCloud] = useState(false);
	const [isListingCloud, setIsListingCloud] = useState(false);
	const cloudBackupAvailable = hasCloudBackupRuntime();
	const isDesktop = isTauriRuntime();

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

	function desktopCloudConfig() {
		const config = toCloudBackupRuntimeConfig(cloudBackup);
		if (!config) {
			toast.error(t("backup.cloud.incomplete"));
			return null;
		}
		return config;
	}

	async function handleTestCloud() {
		const config = isDesktop ? desktopCloudConfig() : null;
		if (isDesktop && !config) {
			return;
		}

		setIsTestingCloud(true);
		try {
			const result = await testCloudBackup(config);
			toast.success(
				t("backup.cloud.testOk", {
					bucket: result.bucket,
					endpoint: result.endpoint,
				}),
			);
		} catch (error) {
			toast.error(formatAppError(error));
		} finally {
			setIsTestingCloud(false);
		}
	}

	async function handleUploadCloud() {
		const config = isDesktop ? desktopCloudConfig() : null;
		if (isDesktop && !config) {
			return;
		}

		setIsUploadingCloud(true);
		try {
			const backup = createBackupSnapshot(db);
			const content = `${JSON.stringify(backup, null, 2)}\n`;
			const result = await uploadCloudBackup(content, { config });
			toast.success(t("backup.cloud.uploadOk", { key: result.key }));
			const listed = await listCloudBackups(config);
			setRemoteObjects(listed.objects);
		} catch (error) {
			toast.error(formatAppError(error));
		} finally {
			setIsUploadingCloud(false);
		}
	}

	async function handleRefreshCloud() {
		const config = isDesktop ? desktopCloudConfig() : null;
		if (isDesktop && !config) {
			return;
		}

		setIsListingCloud(true);
		try {
			const listed = await listCloudBackups(config);
			setRemoteObjects(listed.objects);
		} catch (error) {
			toast.error(formatAppError(error));
		} finally {
			setIsListingCloud(false);
		}
	}

	async function handleRestoreCloud(key: string) {
		const config = isDesktop ? desktopCloudConfig() : null;
		if (isDesktop && !config) {
			return;
		}

		if (
			importMode === "replace" &&
			!window.confirm(t("backup.confirmReplace"))
		) {
			return;
		}

		try {
			const downloaded = await downloadCloudBackup(key, config);
			const file = new File([downloaded.content], cloudBackupFileName(key), {
				type: "application/json",
			});
			await importAllData(file, importMode);
		} catch (error) {
			toast.error(formatAppError(error));
		}
	}

	useEffect(() => {
		if (!cloudBackupAvailable || isDesktop) {
			return;
		}

		let cancelled = false;
		setIsListingCloud(true);
		void listCloudBackups()
			.then((listed) => {
				if (!cancelled) {
					setRemoteObjects(listed.objects);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					toast.error(formatAppError(error));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsListingCloud(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [cloudBackupAvailable, isDesktop]);

	const isBusy =
		isCreatingDataSnapshot ||
		isImportingData ||
		isTestingCloud ||
		isUploadingCloud ||
		isListingCloud;

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
								<div className="grid min-w-0 gap-1">
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

			<div className="grid gap-3 border-t pt-4">
				<div className="grid gap-1">
					<h4 className="font-medium text-sm">{t("backup.cloud.title")}</h4>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{isDesktop
							? t("backup.cloud.description")
							: t("backup.cloud.descriptionServer")}
					</p>
				</div>

				{!cloudBackupAvailable ? (
					<p className="text-muted-foreground text-sm">
						{t("backup.cloud.runtimeRequired")}
					</p>
				) : (
					<>
						{isDesktop ? (
							<>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="grid gap-2 sm:col-span-2">
										<Label htmlFor={cloudEndpointId}>
											{t("backup.cloud.endpoint")}
										</Label>
										<Input
											id={cloudEndpointId}
											value={cloudBackup.endpoint}
											onChange={(event) =>
												setCloudBackup({ endpoint: event.target.value })
											}
											placeholder={t("backup.cloud.endpointPlaceholder")}
											disabled={isBusy}
											autoComplete="off"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor={cloudBucketId}>
											{t("backup.cloud.bucket")}
										</Label>
										<Input
											id={cloudBucketId}
											value={cloudBackup.bucket}
											onChange={(event) =>
												setCloudBackup({ bucket: event.target.value })
											}
											placeholder={t("backup.cloud.bucketPlaceholder")}
											disabled={isBusy}
											autoComplete="off"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor={cloudRegionId}>
											{t("backup.cloud.region")}
										</Label>
										<Input
											id={cloudRegionId}
											value={cloudBackup.region}
											onChange={(event) =>
												setCloudBackup({ region: event.target.value })
											}
											placeholder={t("backup.cloud.regionPlaceholder")}
											disabled={isBusy}
											autoComplete="off"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor={cloudAccessKeyId}>
											{t("backup.cloud.accessKeyId")}
										</Label>
										<Input
											id={cloudAccessKeyId}
											type="password"
											value={cloudBackup.accessKeyId}
											onChange={(event) =>
												setCloudBackup({ accessKeyId: event.target.value })
											}
											placeholder={t("backup.cloud.accessKeyIdPlaceholder")}
											disabled={isBusy}
											autoComplete="off"
											spellCheck={false}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor={cloudSecretKeyId}>
											{t("backup.cloud.secretAccessKey")}
										</Label>
										<Input
											id={cloudSecretKeyId}
											type="password"
											value={cloudBackup.secretAccessKey ?? ""}
											onChange={(event) =>
												setCloudBackup({
													secretAccessKey: event.target.value,
												})
											}
											placeholder={t(
												"backup.cloud.secretAccessKeyPlaceholder",
											)}
											disabled={isBusy}
											autoComplete="new-password"
											spellCheck={false}
										/>
									</div>
									<div className="grid gap-2 sm:col-span-2">
										<Label htmlFor={cloudPrefixId}>
											{t("backup.cloud.prefix")}
										</Label>
										<Input
											id={cloudPrefixId}
											value={cloudBackup.prefix ?? ""}
											onChange={(event) =>
												setCloudBackup({ prefix: event.target.value })
											}
											placeholder={t("backup.cloud.prefixPlaceholder")}
											disabled={isBusy}
											autoComplete="off"
										/>
									</div>
								</div>

								<p className="text-muted-foreground text-xs leading-relaxed">
									{t("backup.cloud.help")}
								</p>
							</>
						) : null}

						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								onClick={() => void handleTestCloud()}
								disabled={isBusy}
							>
								{isTestingCloud ? (
									<Loader2 className="animate-spin" />
								) : (
									<RefreshCw />
								)}
								{t("backup.cloud.test")}
							</Button>
							<Button
								onClick={() => void handleUploadCloud()}
								disabled={isBusy}
							>
								{isUploadingCloud ? (
									<Loader2 className="animate-spin" />
								) : (
									<CloudUpload />
								)}
								{t("backup.cloud.upload")}
							</Button>
							<Button
								variant="outline"
								onClick={() => void handleRefreshCloud()}
								disabled={isBusy}
							>
								{isListingCloud ? (
									<Loader2 className="animate-spin" />
								) : (
									<RefreshCw />
								)}
								{t("backup.cloud.refresh")}
							</Button>
						</div>

						{remoteObjects.length === 0 ? (
							<div className="rounded-lg border border-dashed bg-background px-3 py-4 text-muted-foreground text-sm">
								{isListingCloud
									? t("backup.cloud.loading")
									: t("backup.cloud.empty")}
							</div>
						) : (
							<div className="grid gap-2">
								{remoteObjects.map((object) => (
									<div
										key={object.key}
										className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
									>
										<div className="grid min-w-0 gap-1">
											<div className="truncate font-medium">
												{cloudBackupFileName(object.key)}
											</div>
											<div className="text-muted-foreground text-xs">
												{object.lastModified
													? formatSnapshotDate(object.lastModified)
													: object.key}
												{" · "}
												{formatCloudBackupBytes(object.size)}
											</div>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => void handleRestoreCloud(object.key)}
											disabled={isBusy}
										>
											<RotateCcw />
											{t("backup.cloud.restore")}
										</Button>
									</div>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
