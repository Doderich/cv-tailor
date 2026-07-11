import type { DbHandle } from "@cv-tailor/db";
import {
	createBackupSnapshot,
	type CvTailorBackup,
	summarizeBackup,
} from "@cv-tailor/db";

import {
	backupFilename,
	downloadJsonBackup,
} from "@/lib/data-backup";
import { isTauriRuntime } from "@/lib/tauri-ai";

export interface DataSnapshotMeta {
	id: string;
	name: string;
	createdAt: string;
	profiles: number;
	applications: number;
	cvRuns: number;
	aiOutputs: number;
	filename: string;
}

interface DataSnapshotSummary {
	profiles: number;
	applications: number;
	cvRuns: number;
	aiOutputs: number;
}

interface SaveDataSnapshotRequest {
	id: string;
	name: string;
	createdAt: string;
	content: string;
	summary: DataSnapshotSummary;
}

interface DataSnapshotContentResponse {
	meta: DataSnapshotMeta;
	content: string;
}

interface DownloadDataSnapshotResponse {
	path?: string;
	saved: boolean;
}

const BROWSER_DB_NAME = "cv-tailor-snapshots";
const BROWSER_STORE = "snapshots";

function createSnapshotId(now = new Date()) {
	return `snap-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultSnapshotName(now = new Date()) {
	return `Snapshot ${now.toLocaleString()}`;
}

async function loadInvoke() {
	if (!isTauriRuntime()) {
		return undefined;
	}

	const { invoke } = await import("@tauri-apps/api/core");
	return invoke;
}

function openBrowserSnapshotDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(BROWSER_DB_NAME, 1);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(BROWSER_STORE)) {
				database.createObjectStore(BROWSER_STORE, { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Could not open snapshot storage."));
	});
}

async function withBrowserStore<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
	const database = await openBrowserSnapshotDb();

	return new Promise<T>((resolve, reject) => {
		const transaction = database.transaction(BROWSER_STORE, mode);
		const store = transaction.objectStore(BROWSER_STORE);
		const result = run(store);

		if (result instanceof Promise) {
			result.then(resolve).catch(reject);
			return;
		}

		result.onsuccess = () => resolve(result.result);
		result.onerror = () =>
			reject(result.error ?? new Error("Snapshot storage operation failed."));
	});
}

function toMeta(snapshot: {
	id: string;
	name: string;
	createdAt: string;
	profiles: number;
	applications: number;
	cvRuns: number;
	aiOutputs: number;
	filename: string;
}): DataSnapshotMeta {
	return snapshot;
}

export async function listDataSnapshots(): Promise<DataSnapshotMeta[]> {
	const invoke = await loadInvoke();

	if (invoke) {
		return invoke<DataSnapshotMeta[]>("list_data_snapshots");
	}

	const snapshots = await withBrowserStore("readonly", (store) => store.getAll());
	return snapshots
		.map((snapshot) =>
			toMeta({
				id: snapshot.id,
				name: snapshot.name,
				createdAt: snapshot.createdAt,
				profiles: snapshot.profiles,
				applications: snapshot.applications,
				cvRuns: snapshot.cvRuns,
				aiOutputs: snapshot.aiOutputs,
				filename: snapshot.filename,
			}),
		)
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createDataSnapshot(
	db: DbHandle,
	options?: { name?: string },
) {
	const backup = createBackupSnapshot(db);
	const summary = summarizeBackup(backup);
	const createdAt = backup.exportedAt;
	const id = createSnapshotId(new Date(createdAt));
	const name = options?.name?.trim() || defaultSnapshotName(new Date(createdAt));
	const content = `${JSON.stringify(backup, null, 2)}\n`;
	const invoke = await loadInvoke();

	if (invoke) {
		const request: SaveDataSnapshotRequest = {
			id,
			name,
			createdAt,
			content,
			summary: {
				profiles: summary.profiles,
				applications: summary.applications,
				cvRuns: summary.cvRuns,
				aiOutputs: summary.aiOutputs,
			},
		};
		return invoke<DataSnapshotMeta>("save_data_snapshot", { request });
	}

	const meta = toMeta({
		id,
		name,
		createdAt,
		profiles: summary.profiles,
		applications: summary.applications,
		cvRuns: summary.cvRuns,
		aiOutputs: summary.aiOutputs,
		filename: `${id}.json`,
	});

	await withBrowserStore("readwrite", (store) =>
		store.put({
			...meta,
			content,
		}),
	);

	return meta;
}

export async function readDataSnapshot(id: string) {
	const invoke = await loadInvoke();

	if (invoke) {
		const response = await invoke<DataSnapshotContentResponse>(
			"read_data_snapshot",
			{
				request: { id },
			},
		);
		return response;
	}

	const snapshot = await withBrowserStore("readonly", (store) => store.get(id));
	if (!snapshot) {
		throw new Error(`Snapshot "${id}" was not found.`);
	}

	return {
		meta: toMeta(snapshot),
		content: snapshot.content as string,
	};
}

export async function deleteDataSnapshot(id: string) {
	const invoke = await loadInvoke();

	if (invoke) {
		await invoke("delete_data_snapshot", { request: { id } });
		return;
	}

	await withBrowserStore("readwrite", (store) => store.delete(id));
}

export async function downloadDataSnapshot(id: string) {
	const invoke = await loadInvoke();
	const snapshot = await readDataSnapshot(id);
	const backup = JSON.parse(snapshot.content) as CvTailorBackup;
	const filename = backupFilename(new Date(snapshot.meta.createdAt)).replace(
		/\.json$/,
		`-${snapshot.meta.name.replace(/\s+/g, "-").toLowerCase()}.json`,
	);

	if (invoke) {
		const response = await invoke<DownloadDataSnapshotResponse>(
			"download_data_snapshot",
			{
				request: { id },
			},
		);
		return response;
	}

	downloadJsonBackup(filename, backup);
	return { saved: true, path: filename };
}

export function formatSnapshotDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}
