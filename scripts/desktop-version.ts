import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const webRoot = join(repoRoot, "apps/web");
export const tauriConfigPath = join(webRoot, "src-tauri/tauri.conf.json");
export const cargoManifestPath = join(webRoot, "src-tauri/Cargo.toml");

export type BumpLevel = "patch" | "minor" | "major";

export type SemverParts = {
	major: number;
	minor: number;
	patch: number;
};

export function normalizeVersion(version: string) {
	return version.trim().replace(/^v/i, "");
}

export function parseSemver(version: string): SemverParts {
	const normalized = normalizeVersion(version);
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(normalized);

	if (!match) {
		throw new Error(`Invalid semver: ${version}`);
	}

	return {
		major: Number.parseInt(match[1] ?? "0", 10),
		minor: Number.parseInt(match[2] ?? "0", 10),
		patch: Number.parseInt(match[3] ?? "0", 10),
	};
}

export function formatSemver(parts: SemverParts) {
	return `${parts.major}.${parts.minor}.${parts.patch}`;
}

export function compareSemver(left: string, right: string) {
	const a = parseSemver(left);
	const b = parseSemver(right);

	if (a.major !== b.major) {
		return a.major - b.major;
	}

	if (a.minor !== b.minor) {
		return a.minor - b.minor;
	}

	return a.patch - b.patch;
}

export function bumpSemver(version: string, level: BumpLevel) {
	const current = parseSemver(version);

	if (level === "major") {
		return formatSemver({
			major: current.major + 1,
			minor: 0,
			patch: 0,
		});
	}

	if (level === "minor") {
		return formatSemver({
			major: current.major,
			minor: current.minor + 1,
			patch: 0,
		});
	}

	return formatSemver({
		major: current.major,
		minor: current.minor,
		patch: current.patch + 1,
	});
}

export function readConfiguredVersion() {
	const config = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
		version: string;
	};

	if (!config.version?.trim()) {
		throw new Error(`Missing version in ${tauriConfigPath}`);
	}

	return normalizeVersion(config.version);
}

export function getLatestGitHubReleaseVersion(repo: string) {
	const result = spawnSync(
		"gh",
		[
			"release",
			"list",
			"--repo",
			repo,
			"--limit",
			"1",
			"--json",
			"tagName",
		],
		{ encoding: "utf8" },
	);

	if (result.status !== 0) {
		return null;
	}

	const releases = JSON.parse(result.stdout) as { tagName: string }[];
	const latestTag = releases[0]?.tagName;

	return latestTag ? normalizeVersion(latestTag) : null;
}

export function resolveReleaseVersion(options: {
	current: string;
	latestRelease: string | null;
	bump: BumpLevel;
	explicit?: string;
	noBump?: boolean;
}) {
	if (options.explicit) {
		return normalizeVersion(options.explicit);
	}

	if (options.noBump) {
		return normalizeVersion(options.current);
	}

	const current = normalizeVersion(options.current);

	if (!options.latestRelease) {
		return current;
	}

	if (compareSemver(current, options.latestRelease) > 0) {
		return current;
	}

	return bumpSemver(options.latestRelease, options.bump);
}

export function writeConfiguredVersion(version: string) {
	const normalized = normalizeVersion(version);
	const config = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
		version: string;
	};
	config.version = normalized;
	writeFileSync(tauriConfigPath, `${JSON.stringify(config, null, 2)}\n`);

	const cargoManifest = readFileSync(cargoManifestPath, "utf8");
	const updatedCargoManifest = cargoManifest.replace(
		/^version = ".*"$/m,
		`version = "${normalized}"`,
	);

	if (updatedCargoManifest === cargoManifest) {
		throw new Error(`Could not update version in ${cargoManifestPath}`);
	}

	writeFileSync(cargoManifestPath, updatedCargoManifest);

	return normalized;
}
