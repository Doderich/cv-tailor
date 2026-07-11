import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
	buildLatestJson,
	downloadExistingLatestJson,
	ensureGhAvailable,
	githubRepo,
	publishReleaseAssets,
	run,
	writeLatestJson,
} from "./desktop-release-shared.ts";
import {
	type BumpLevel,
	getLatestGitHubReleaseVersion,
	readConfiguredVersion,
	resolveReleaseVersion,
	writeConfiguredVersion,
} from "./desktop-version.ts";
import {
	buildWindowsPlatforms,
	collectWindowsUploadPaths,
	findWindowsUpdaterArtifacts,
	windowsNsisBundleDir,
} from "./windows-release-artifacts.ts";

const repoRoot = join(import.meta.dirname, "..");
const remoteBuildScriptPath = join(repoRoot, "scripts/windows-remote-build.ps1");
const privateKeyPath = join(homedir(), ".tauri", "cv-tailor.key");

function usage() {
	console.log(`Usage: pnpm run desktop:windows:release [-- options]

Builds a signed Windows desktop release on this machine and publishes it to
GitHub Releases. Run this on Windows from the repo root.

Options:
  --notes "..."       Release notes for latest.json and GitHub
  --version "1.2.3"   Use an explicit version instead of auto-bumping
  --bump patch|minor|major
                      Bump level when auto-bumping (default: patch)
  --no-bump           Keep the current tauri.conf.json version
  --dry-run           Build without publishing to GitHub
  --help              Show this help text
`);
}

function parseArgs(argv: string[]) {
	let notes = "";
	let dryRun = false;
	let noBump = false;
	let explicitVersion = "";
	let bump: BumpLevel = "patch";

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			usage();
			process.exit(0);
		}

		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}

		if (arg === "--no-bump") {
			noBump = true;
			continue;
		}

		if (arg === "--notes") {
			notes = argv[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--version") {
			explicitVersion = argv[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--bump") {
			const level = argv[index + 1];
			if (level !== "patch" && level !== "minor" && level !== "major") {
				throw new Error(`Invalid bump level: ${level ?? "(missing)"}`);
			}
			bump = level;
			index += 1;
		}
	}

	return { notes, dryRun, noBump, explicitVersion, bump };
}

function ensureWindowsPrerequisites() {
	if (process.platform !== "win32") {
		throw new Error(
			"Local Windows releases must be built on Windows. From macOS, use: pnpm run desktop:windows:remote:release",
		);
	}

	if (!existsSync(privateKeyPath)) {
		throw new Error(
			`Missing signing key at ${privateKeyPath}. Run: pnpm run desktop:setup-signing`,
		);
	}
}

function resolveVersionForRelease(options: {
	noBump: boolean;
	explicitVersion: string;
	bump: BumpLevel;
}) {
	const current = readConfiguredVersion();
	const latestRelease = getLatestGitHubReleaseVersion(githubRepo);
	const nextVersion = resolveReleaseVersion({
		current,
		latestRelease,
		bump: options.bump,
		explicit: options.explicitVersion || undefined,
		noBump: options.noBump,
	});

	if (nextVersion === current) {
		console.log(`Using version ${nextVersion}.`);
		return nextVersion;
	}

	console.log(
		`Bumping version ${current} -> ${nextVersion}${
			latestRelease ? ` (latest release: v${latestRelease})` : ""
		}.`,
	);

	return writeConfiguredVersion(nextVersion);
}

function runLocalBuild() {
	run("powershell", [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		remoteBuildScriptPath,
		"-RepoPath",
		repoRoot,
	]);
}

function main() {
	const { notes, dryRun, noBump, explicitVersion, bump } = parseArgs(
		process.argv.slice(2),
	);

	ensureWindowsPrerequisites();
	if (!dryRun) {
		ensureGhAvailable();
	}

	const version = resolveVersionForRelease({
		noBump,
		explicitVersion,
		bump,
	});
	const tag = version.startsWith("v") ? version : `v${version}`;
	const releaseNotes = notes.trim() || `CV Tailor ${version} for Windows`;

	console.log(`Building CV Tailor ${version} for Windows...`);
	runLocalBuild();

	const updaterArtifacts = findWindowsUpdaterArtifacts(windowsNsisBundleDir);
	const existingLatestJson = downloadExistingLatestJson(tag);
	const latestJson = buildLatestJson({
		version,
		notes: releaseNotes,
		tag,
		platforms: buildWindowsPlatforms(tag, updaterArtifacts),
		existing: existingLatestJson,
	});
	const latestJsonPath = writeLatestJson(
		latestJson,
		join(repoRoot, "apps/web/src-tauri/target/release/bundle/latest.json"),
	);

	console.log(`Prepared ${latestJsonPath}`);
	console.log(
		`Windows updater platforms: ${Object.keys(latestJson.platforms)
			.filter((key) => key.startsWith("windows-"))
			.join(", ")}`,
	);

	if (dryRun) {
		console.log("Dry run complete. Skipping GitHub release publish.");
		return;
	}

	publishReleaseAssets({
		tag,
		title: `CV Tailor ${version}`,
		notes: releaseNotes,
		uploadPaths: collectWindowsUploadPaths(latestJsonPath, updaterArtifacts),
	});

	console.log(
		`Published ${tag} to https://github.com/${githubRepo}/releases/tag/${tag}`,
	);
	console.log(
		"Remember to commit the version bump in apps/web/src-tauri/tauri.conf.json and Cargo.toml.",
	);
}

main();
