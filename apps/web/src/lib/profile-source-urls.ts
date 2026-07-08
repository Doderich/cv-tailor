function stripTrailingPunctuation(value: string) {
	return value.replace(/[.,;]+$/u, "");
}

function normalizeSourceUrl(value: string) {
	const trimmed = stripTrailingPunctuation(value.trim());
	if (!trimmed) {
		return "";
	}

	if (/^https?:\/\//iu.test(trimmed)) {
		return trimmed;
	}

	return `https://${trimmed}`;
}

export function parseSourceUrls(value: string) {
	const seen = new Set<string>();

	return value
		.split(/[\r\n,;]+|\s+(?=https?:\/\/)/iu)
		.map((part) => normalizeSourceUrl(part))
		.filter((url) => {
			if (!url) {
				return false;
			}

			const key = url.toLowerCase();
			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
}

export function formatSourceError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === "object") {
		const record = error as { message?: unknown; details?: unknown };
		const message =
			typeof record.message === "string" ? record.message : undefined;
		const details =
			typeof record.details === "string" ? record.details : undefined;

		if (message && details) {
			return `${message} (${details})`;
		}

		if (message) {
			return message;
		}

		if (details) {
			return details;
		}
	}

	return String(error);
}
