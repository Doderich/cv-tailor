import {
	createBackupSnapshot,
	type BackupImportMode,
	importBackup,
	parseBackupFile,
	summarizeBackup,
} from "@cv-tailor/db";

import type { DbHandle } from "@cv-tailor/db";

export function backupFilename(now = new Date()) {
	const date = now.toISOString().slice(0, 10);
	return `cv-tailor-backup-${date}.json`;
}

export function downloadJsonBackup(filename: string, data: unknown) {
	const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = "noopener";
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File) {
	return file.text();
}

export async function exportAllData(db: DbHandle) {
	const backup = createBackupSnapshot(db);
	downloadJsonBackup(backupFilename(), backup);
	return summarizeBackup(backup);
}

export async function importAllData(
	db: DbHandle,
	content: string,
	mode: BackupImportMode,
) {
	const backup = parseBackupFile(content);
	await importBackup(db, backup, mode);
	return summarizeBackup(backup);
}
