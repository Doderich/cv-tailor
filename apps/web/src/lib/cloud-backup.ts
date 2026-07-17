import {
	type CloudBackupConfig,
	defaultCloudBackupConfig,
} from "@cv-tailor/core";

import {
	gatewayFetch,
	hasAiGateway,
	isTauriRuntime,
} from "@/lib/tauri-ai";

export type CloudBackupRuntimeConfig = {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	prefix?: string;
};

/**
 * Desktop-only: load MinIO defaults from the native process environment.
 * Never use `import.meta.env` for secrets — Vite would bake them into the web bundle.
 */
export async function loadCloudBackupEnvDefaults(): Promise<
	Partial<CloudBackupConfig>
> {
	if (!isTauriRuntime()) {
		return {};
	}

	const { invoke } = await import("@tauri-apps/api/core");
	const config = await invoke<CloudBackupRuntimeConfig | null>(
		"cloud_backup_env_defaults",
	);
	if (!config) {
		return {};
	}

	return {
		endpoint: config.endpoint,
		region: config.region,
		bucket: config.bucket,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		prefix: config.prefix,
	};
}

export function resolveCloudBackupConfig(
	stored?: CloudBackupConfig | Partial<CloudBackupConfig> | null,
): CloudBackupConfig {
	return {
		...defaultCloudBackupConfig,
		...(stored ?? {}),
	};
}

export type CloudBackupObjectMeta = {
	key: string;
	size: number;
	lastModified?: string;
};

export type CloudBackupTestResponse = {
	ok: boolean;
	bucket: string;
	endpoint: string;
};

export type CloudBackupUploadResponse = {
	key: string;
	etag?: string;
};

export type CloudBackupListResponse = {
	objects: CloudBackupObjectMeta[];
};

export type CloudBackupDownloadResponse = {
	key: string;
	content: string;
};

export function hasCloudBackupRuntime() {
	return isTauriRuntime() || hasAiGateway();
}

async function loadInvoke() {
	if (!isTauriRuntime()) {
		return undefined;
	}

	const { invoke } = await import("@tauri-apps/api/core");
	return invoke;
}

function requireCloudBackupRuntime() {
	if (!hasCloudBackupRuntime()) {
		throw new Error(
			"Cloud backup needs the desktop app or the CV Tailor gateway.",
		);
	}
}

export function toCloudBackupRuntimeConfig(
	config: CloudBackupConfig | undefined,
): CloudBackupRuntimeConfig | null {
	if (!config) {
		return null;
	}

	const endpoint = config.endpoint.trim();
	const bucket = config.bucket.trim();
	const accessKeyId = config.accessKeyId.trim();
	const secretAccessKey = config.secretAccessKey?.trim() ?? "";
	const region = config.region.trim() || "us-east-1";
	const prefix = config.prefix?.trim() || "cv-tailor/";

	if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
		return null;
	}

	return {
		endpoint,
		region,
		bucket,
		accessKeyId,
		secretAccessKey,
		prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
	};
}

export function cloudBackupObjectKey(prefix: string, now = new Date()) {
	const stamp = now
		.toISOString()
		.replaceAll(":", "-")
		.replace(/\.\d{3}Z$/, "Z");
	const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
	return `${normalized}${stamp}.json`;
}

export async function testCloudBackup(config?: CloudBackupRuntimeConfig | null) {
	requireCloudBackupRuntime();
	const invoke = await loadInvoke();
	if (invoke) {
		if (!config) {
			throw new Error("Cloud backup settings are incomplete.");
		}
		return invoke<CloudBackupTestResponse>("cloud_backup_test", { config });
	}

	return gatewayFetch<CloudBackupTestResponse>("/api/cloud-backup/test", {
		method: "POST",
	});
}

export async function uploadCloudBackup(
	content: string,
	options?: {
		config?: CloudBackupRuntimeConfig | null;
		key?: string;
	},
) {
	requireCloudBackupRuntime();
	const invoke = await loadInvoke();
	if (invoke) {
		if (!options?.config) {
			throw new Error("Cloud backup settings are incomplete.");
		}
		return invoke<CloudBackupUploadResponse>("cloud_backup_upload", {
			request: {
				config: options.config,
				key:
					options.key ??
					cloudBackupObjectKey(options.config.prefix ?? "cv-tailor/"),
				content,
			},
		});
	}

	return gatewayFetch<CloudBackupUploadResponse>("/api/cloud-backup/upload", {
		method: "POST",
		body: JSON.stringify({
			content,
			...(options?.key ? { key: options.key } : {}),
		}),
	});
}

export async function listCloudBackups(
	config?: CloudBackupRuntimeConfig | null,
) {
	requireCloudBackupRuntime();
	const invoke = await loadInvoke();
	if (invoke) {
		if (!config) {
			throw new Error("Cloud backup settings are incomplete.");
		}
		return invoke<CloudBackupListResponse>("cloud_backup_list", {
			request: { config },
		});
	}

	return gatewayFetch<CloudBackupListResponse>("/api/cloud-backup/list", {
		method: "POST",
	});
}

export async function downloadCloudBackup(
	key: string,
	config?: CloudBackupRuntimeConfig | null,
) {
	requireCloudBackupRuntime();
	const invoke = await loadInvoke();
	if (invoke) {
		if (!config) {
			throw new Error("Cloud backup settings are incomplete.");
		}
		return invoke<CloudBackupDownloadResponse>("cloud_backup_download", {
			request: { config, key },
		});
	}

	return gatewayFetch<CloudBackupDownloadResponse>(
		"/api/cloud-backup/download",
		{
			method: "POST",
			body: JSON.stringify({ key }),
		},
	);
}

export function formatCloudBackupBytes(size: number) {
	if (size < 1024) {
		return `${size} B`;
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function cloudBackupFileName(key: string) {
	const segments = key.split("/");
	return segments[segments.length - 1] || key;
}
