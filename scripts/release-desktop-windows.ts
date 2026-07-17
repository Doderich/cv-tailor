import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	buildLatestJson,
	downloadExistingLatestJson,
	ensureGhAvailable,
	githubRepo,
	type LatestJson,
	publishReleaseAssets,
	run,
	verifyReleaseAssetUrls,
	writeLatestJson,
} from "./desktop-release-shared.ts";
import {
	type BumpLevel,
	getLatestGitHubReleaseVersion,
	readConfiguredVersion,
	resolveReleaseVersion,
	writeConfiguredVersion,
} from "./desktop-version.ts";

const repoRoot = join(import.meta.dirname, "..");
const webRoot = join(repoRoot, "apps/web");
const tauriConfigPath = join(webRoot, "src-tauri/tauri.conf.json");
const cargoManifestPath = join(webRoot, "src-tauri/Cargo.toml");
const remoteBuildScriptPath = join(
	repoRoot,
	"scripts/windows-remote-build.ps1",
);

import {
	buildWindowsPlatforms,
	collectWindowsUploadPaths,
	findWindowsUpdaterArtifacts,
	stageWindowsGithubUploadArtifacts,
} from "./windows-release-artifacts.ts";

const remoteWindowsArtifactsZipName = "cv-tailor-windows-artifacts.zip";

type SshConfig = {
	host: string;
	user: string;
	port: number;
	remotePath: string;
};

function usage() {
	console.log(`Usage: pnpm run desktop:release:windows [-- options]

Builds a signed Windows desktop release on a remote Windows machine over SSH,
then publishes artifacts to GitHub Releases.

Connection settings (env vars or flags):
  WINDOWS_SSH_HOST / --host        Remote Windows host
  WINDOWS_SSH_USER / --user        SSH username
  WINDOWS_SSH_PORT / --port        SSH port (default: 22)
  WINDOWS_REPO_PATH / --remote-path
                                   Absolute repo path on Windows
                                   (example: C:/Users/you/cv-tailor)

Options:
  --notes "..."       Release notes for latest.json and GitHub
  --version "1.2.3"   Use an explicit version instead of auto-bumping
  --bump patch|minor|major
                      Bump level when auto-bumping (default: patch)
  --no-bump           Keep the current tauri.conf.json version
  --dry-run           Build remotely without publishing to GitHub
  --help              Show this help text

Prerequisites on the Windows machine:
  - OpenSSH Server enabled
  - Git, Node.js 20+, pnpm 10+, Rust stable
  - Tauri Windows build dependencies (NSIS, WebView2, VS Build Tools)
  - Signing key at %USERPROFILE%\\.tauri\\cv-tailor.key
  - Repository cloned at WINDOWS_REPO_PATH
`);
}

function parseArgs(argv: string[]) {
	let notes = "";
	let dryRun = false;
	let noBump = false;
	let explicitVersion = "";
	let bump: BumpLevel = "patch";
	let host = process.env.WINDOWS_SSH_HOST ?? "";
	let user = process.env.WINDOWS_SSH_USER ?? "";
	let port = Number.parseInt(process.env.WINDOWS_SSH_PORT ?? "22", 10);
	let remotePath = process.env.WINDOWS_REPO_PATH ?? "";

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
			continue;
		}

		if (arg === "--host") {
			host = argv[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--user") {
			user = argv[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--port") {
			port = Number.parseInt(argv[index + 1] ?? "22", 10);
			index += 1;
			continue;
		}

		if (arg === "--remote-path") {
			remotePath = argv[index + 1] ?? "";
			index += 1;
		}
	}

	return {
		notes,
		dryRun,
		noBump,
		explicitVersion,
		bump,
		ssh: {
			host,
			user,
			port,
			remotePath,
		} satisfies SshConfig,
	};
}

function ensureSshConfig(config: SshConfig) {
	if (!config.host.trim()) {
		throw new Error(
			"Missing SSH host. Set WINDOWS_SSH_HOST or pass --host.",
		);
	}

	if (!config.user.trim()) {
		throw new Error(
			"Missing SSH user. Set WINDOWS_SSH_USER or pass --user.",
		);
	}

	if (!config.remotePath.trim()) {
		throw new Error(
			"Missing remote repo path. Set WINDOWS_REPO_PATH or pass --remote-path.",
		);
	}

	if (!Number.isFinite(config.port) || config.port <= 0) {
		throw new Error(`Invalid SSH port: ${config.port}`);
	}

	const sshVersion = spawnSync("ssh", ["-V"], { stdio: "pipe" });
	if (sshVersion.error) {
		throw new Error("OpenSSH client is required (ssh/scp commands).");
	}

	const scpVersion = spawnSync("scp", ["-V"], { stdio: "pipe" });
	if (scpVersion.error) {
		throw new Error("OpenSSH client is required (ssh/scp commands).");
	}
}

function sshTarget(config: SshConfig) {
	return `${config.user}@${config.host}`;
}

function sshArgs(config: SshConfig, remoteCommand: string) {
	const args = ["-p", String(config.port), sshTarget(config), remoteCommand];
	return args;
}

function scpArgs(config: SshConfig) {
	return ["-P", String(config.port)];
}

function toRemotePath(config: SshConfig, relativePath: string) {
	const base = config.remotePath.replace(/\\/g, "/").replace(/\/$/, "");
	return `${base}/${relativePath.replace(/\\/g, "/")}`;
}

function runSsh(config: SshConfig, remoteCommand: string) {
	run("ssh", sshArgs(config, remoteCommand));
}

function runSshCapture(config: SshConfig, remoteCommand: string) {
	const result = spawnSync("ssh", sshArgs(config, remoteCommand), {
		stdio: "pipe",
		encoding: "utf8",
	});

	if (result.status !== 0) {
		throw new Error(
			`SSH command failed: ${remoteCommand}\n${result.stderr ?? ""}`,
		);
	}

	return result.stdout.trim();
}

function toScpRemotePath(path: string) {
	return path.replace(/\\/g, "/");
}

function escapePowerShellSingleQuotedString(value: string) {
	return value.replace(/'/g, "''");
}

function runScp(config: SshConfig, source: string, destination: string) {
	run("scp", [...scpArgs(config), source, destination]);
}

function syncVersionFiles(config: SshConfig) {
	const remoteTauriConfig = toRemotePath(config, "apps/web/src-tauri/tauri.conf.json");
	const remoteCargoManifest = toRemotePath(config, "apps/web/src-tauri/Cargo.toml");

	runScp(config, tauriConfigPath, `${sshTarget(config)}:${remoteTauriConfig}`);
	runScp(config, cargoManifestPath, `${sshTarget(config)}:${remoteCargoManifest}`);
}

function syncBuildScript(config: SshConfig) {
	const remoteScript = toRemotePath(config, "scripts/windows-remote-build.ps1");
	runScp(config, remoteBuildScriptPath, `${sshTarget(config)}:${remoteScript}`);
}

function pullLatestCode(config: SshConfig) {
	const repoPath = config.remotePath.replace(/\\/g, "/");
	const command =
		`powershell -NoProfile -Command ` +
		`"Set-Location '${repoPath}'; git pull --ff-only"`;

	console.log("Pulling latest code on Windows machine...");
	runSsh(config, command);
}

function runRemoteBuild(config: SshConfig) {
	const repoPath = config.remotePath.replace(/\\/g, "/");
	const remoteScript = toRemotePath(config, "scripts/windows-remote-build.ps1");
	const command =
		`powershell -NoProfile -ExecutionPolicy Bypass ` +
		`-File "${remoteScript}" -RepoPath "${repoPath}"`;

	console.log("Starting remote Windows build...");
	runSsh(config, command);
}

function downloadWindowsArtifacts(config: SshConfig) {
	const tempDir = mkdtempSync(join(tmpdir(), "cv-tailor-windows-"));
	const localNsisDir = join(tempDir, "nsis");
	mkdirSync(localNsisDir, { recursive: true });

	const remoteNsisDir = toRemotePath(
		config,
		"target/release/bundle/nsis",
	);
	const escapedNsisDir = escapePowerShellSingleQuotedString(remoteNsisDir);
	const packCommand =
		`powershell -NoProfile -Command ` +
		`"$nsis='${escapedNsisDir}'; ` +
		`$zip=Join-Path $env:TEMP '${remoteWindowsArtifactsZipName}'; ` +
		`if (-not (Test-Path -LiteralPath $nsis)) { Write-Error ('Missing NSIS dir: ' + $nsis); exit 1 }; ` +
		`if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }; ` +
		`Compress-Archive -Path (Join-Path $nsis '*') -DestinationPath $zip -Force; ` +
		`Write-Output $zip"`;

	console.log("Packaging Windows artifacts on remote machine...");
	const remoteZipPath = runSshCapture(config, packCommand);
	const localZipPath = join(tempDir, remoteWindowsArtifactsZipName);

	console.log(`Downloading Windows artifacts to ${tempDir}...`);
	runScp(
		config,
		`${sshTarget(config)}:${toScpRemotePath(remoteZipPath)}`,
		localZipPath,
	);

	if (!existsSync(localZipPath)) {
		throw new Error(`Failed to download Windows artifacts zip: ${localZipPath}`);
	}

	console.log("Extracting Windows artifacts...");
	execSync(`unzip -oq ${JSON.stringify(localZipPath)} -d ${JSON.stringify(localNsisDir)}`);

	const cleanupCommand =
		`powershell -NoProfile -Command ` +
		`"Remove-Item -LiteralPath '${escapePowerShellSingleQuotedString(remoteZipPath)}' -Force -ErrorAction SilentlyContinue"`;

	spawnSync("ssh", sshArgs(config, cleanupCommand), { stdio: "pipe" });

	return {
		tempDir,
		localNsisDir,
		cleanup() {
			rmSync(tempDir, { recursive: true, force: true });
		},
	};
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

function verifyRemoteSigningKey(config: SshConfig) {
	const command =
		`powershell -NoProfile -Command ` +
		`"if (-not (Test-Path -LiteralPath $env:USERPROFILE\\.tauri\\cv-tailor.key)) { exit 42 }"`;

	const result = spawnSync("ssh", sshArgs(config, command), { stdio: "pipe" });

	if (result.status === 42) {
		throw new Error(
			"Missing signing key on Windows machine. Run desktop:setup-signing there or copy ~/.tauri/cv-tailor.key.",
		);
	}

	if (result.status !== 0) {
		throw new Error("Failed to verify signing key on the Windows machine.");
	}
}

function main() {
	const { notes, dryRun, noBump, explicitVersion, bump, ssh } = parseArgs(
		process.argv.slice(2),
	);

	ensureSshConfig(ssh);
	ensureGhAvailable();

	const version = resolveVersionForRelease({
		noBump,
		explicitVersion,
		bump,
	});
	const tag = version.startsWith("v") ? version : `v${version}`;
	const releaseNotes = notes.trim() || `CV Tailor ${version} for Windows`;

	console.log(`Preparing CV Tailor ${version} Windows release via ${sshTarget(ssh)}...`);

	verifyRemoteSigningKey(ssh);
	pullLatestCode(ssh);
	syncVersionFiles(ssh);
	syncBuildScript(ssh);
	runRemoteBuild(ssh);

	const download = downloadWindowsArtifacts(ssh);

	try {
		const updaterArtifacts = findWindowsUpdaterArtifacts(download.localNsisDir);
		const stagedArtifacts = stageWindowsGithubUploadArtifacts(
			updaterArtifacts,
			join(download.tempDir, "github-upload"),
		);
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
			join(download.tempDir, "latest.json"),
		);

		console.log(`Prepared ${latestJsonPath}`);
		console.log(
			`Windows updater platforms: ${Object.keys(latestJson.platforms).filter((key) => key.startsWith("windows-")).join(", ")}`,
		);

		if (dryRun) {
			console.log("Dry run complete. Skipping GitHub release publish.");
			return;
		}

		publishReleaseAssets({
			tag,
			title: `CV Tailor ${version}`,
			notes: releaseNotes,
			uploadPaths: collectWindowsUploadPaths(latestJsonPath, stagedArtifacts),
		});

		verifyReleaseAssetUrls(latestJson);

		console.log(
			`Published ${tag} to https://github.com/${githubRepo}/releases/tag/${tag}`,
		);
		console.log(
			"Remember to commit the version bump in apps/web/src-tauri/tauri.conf.json and Cargo.toml.",
		);
	} finally {
		download.cleanup();
	}
}

main();
