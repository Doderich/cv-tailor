import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const githubRepo = "Doderich/cv-tailor";

export type LatestJson = {
	version: string;
	notes: string;
	pub_date: string;
	platforms: Record<
		string,
		{
			signature: string;
			url: string;
		}
	>;
};

export function ensureGhAvailable() {
	const ghVersion = spawnSync("gh", ["--version"], { stdio: "pipe" });
	if (ghVersion.status !== 0) {
		throw new Error(
			"GitHub CLI (gh) is required. Install it and run `gh auth login`.",
		);
	}
}

export function run(
	command: string,
	args: string[],
	options?: { env?: NodeJS.ProcessEnv; cwd?: string },
) {
	const result = spawnSync(command, args, {
		cwd: options?.cwd,
		stdio: "inherit",
		env: {
			...process.env,
			...options?.env,
		},
	});

	if (result.status !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(" ")}`);
	}
}

export function runCapture(
	command: string,
	args: string[],
	options?: { cwd?: string },
) {
	const result = spawnSync(command, args, {
		cwd: options?.cwd,
		stdio: "pipe",
		encoding: "utf8",
		env: process.env,
	});

	if (result.status !== 0) {
		throw new Error(
			`Command failed: ${command} ${args.join(" ")}\n${result.stderr ?? ""}`,
		);
	}

	return result.stdout;
}

export function releaseExists(tag: string) {
	const result = spawnSync(
		"gh",
		["release", "view", tag, "--repo", githubRepo],
		{ stdio: "pipe" },
	);

	return result.status === 0;
}

export function downloadExistingLatestJson(tag: string): LatestJson | null {
	const tempDir = mkdtempSync(join(tmpdir(), "cv-tailor-release-"));

	try {
		const result = spawnSync(
			"gh",
			[
				"release",
				"download",
				tag,
				"--repo",
				githubRepo,
				"--pattern",
				"latest.json",
				"--dir",
				tempDir,
			],
			{ stdio: "pipe" },
		);

		if (result.status !== 0) {
			return null;
		}

		return JSON.parse(
			readFileSync(join(tempDir, "latest.json"), "utf8"),
		) as LatestJson;
	} catch {
		return null;
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

export function buildLatestJson(options: {
	version: string;
	notes: string;
	tag: string;
	platforms: LatestJson["platforms"];
	existing?: LatestJson | null;
}): LatestJson {
	const mergedPlatforms = {
		...(options.existing?.platforms ?? {}),
		...options.platforms,
	};

	return {
		version: options.version,
		notes: options.notes,
		pub_date: new Date().toISOString(),
		platforms: mergedPlatforms,
	};
}

export function publishReleaseAssets(options: {
	tag: string;
	title: string;
	notes: string;
	uploadPaths: string[];
}) {
	const existing = releaseExists(options.tag);

	if (existing) {
		console.log(`Release ${options.tag} already exists. Uploading assets...`);
		run("gh", [
			"release",
			"upload",
			options.tag,
			...options.uploadPaths,
			"--repo",
			githubRepo,
			"--clobber",
		]);
		return;
	}

	run("gh", [
		"release",
		"create",
		options.tag,
		"--repo",
		githubRepo,
		"--title",
		options.title,
		"--notes",
		options.notes,
		...options.uploadPaths,
	]);
}

export function writeLatestJson(
	latestJson: LatestJson,
	outputPath: string,
): string {
	writeFileSync(outputPath, `${JSON.stringify(latestJson, null, 2)}\n`);
	return outputPath;
}
