import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const githubRepo = "Doderich/cv-tailor";

/** Cargo workspace target dir (src-tauri is a workspace member). */
export function desktopBundleRoot(repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")) {
	return join(repoRoot, "target/release/bundle");
}

export function toGithubReleaseAssetName(fileName: string) {
	return fileName.replace(/ /g, ".");
}

export function buildGithubReleaseDownloadUrl(tag: string, fileName: string) {
	const assetName = toGithubReleaseAssetName(fileName);
	const encodedName = assetName
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return `https://github.com/${githubRepo}/releases/download/${tag}/${encodedName}`;
}

export function verifyReleaseAssetUrls(latestJson: LatestJson) {
	for (const [platform, artifact] of Object.entries(latestJson.platforms)) {
		const result = spawnSync(
			"curl",
			["-sI", "-o", "/dev/null", "-w", "%{http_code}", artifact.url],
			{ encoding: "utf8" },
		);

		const status = result.stdout?.trim();
		if (status !== "200" && status !== "302") {
			throw new Error(
				`Release asset for ${platform} is not reachable (${status ?? "unknown"}): ${artifact.url}`,
			);
		}
	}
}

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
	options?: { env?: NodeJS.ProcessEnv; cwd?: string; shell?: boolean },
) {
	const result = spawnSync(command, args, {
		cwd: options?.cwd,
		stdio: "inherit",
		shell: options?.shell ?? false,
		env: {
			...process.env,
			...options?.env,
		},
	});

	if (result.error) {
		throw new Error(`Failed to start ${command}: ${result.error.message}`);
	}

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
