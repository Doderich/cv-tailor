import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const webRoot = join(repoRoot, "apps/web");
const tauriConfigPath = join(webRoot, "src-tauri/tauri.conf.json");
const bundleRoot = join(webRoot, "src-tauri/target/release/bundle");
const privateKeyPath = join(homedir(), ".tauri", "cv-tailor.key");
const githubRepo = "Doderich/cv-tailor";

type TauriConfig = {
	version: string;
	productName: string;
	plugins?: {
		updater?: {
			pubkey?: string;
		};
	};
};

type LatestJson = {
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

function usage() {
	console.log(`Usage: pnpm run desktop:release [-- "Release notes here"]

Builds a signed macOS desktop release and publishes it to GitHub Releases.

Options:
  --notes "..."   Release notes for latest.json and GitHub
  --dry-run       Build and generate latest.json without publishing
  --help          Show this help text
`);
}

function parseArgs(argv: string[]) {
	let notes = "";
	let dryRun = false;

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

		if (arg === "--notes") {
			notes = argv[index + 1] ?? "";
			index += 1;
		}
	}

	return { notes, dryRun };
}

function run(
	command: string,
	args: string[],
	options?: { env?: NodeJS.ProcessEnv },
) {
	const result = spawnSync(command, args, {
		cwd: webRoot,
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

function readTauriConfig(): TauriConfig {
	return JSON.parse(readFileSync(tauriConfigPath, "utf8")) as TauriConfig;
}

function ensurePrerequisites(config: TauriConfig) {
	if (process.platform !== "darwin") {
		throw new Error("macOS releases must be built on macOS.");
	}

	if (!existsSync(privateKeyPath)) {
		throw new Error(
			`Missing signing key at ${privateKeyPath}. Run: pnpm run desktop:setup-signing`,
		);
	}

	if (!config.plugins?.updater?.pubkey) {
		throw new Error(
			"Updater public key is missing from tauri.conf.json. Run: pnpm run desktop:setup-signing",
		);
	}

	const ghVersion = spawnSync("gh", ["--version"], { stdio: "pipe" });
	if (ghVersion.status !== 0) {
		throw new Error(
			"GitHub CLI (gh) is required. Install it and run `gh auth login`.",
		);
	}
}

function detectPlatformKey(fileName: string) {
	if (fileName.includes("aarch64")) {
		return "darwin-aarch64";
	}

	if (fileName.includes("x86_64") || fileName.includes("x64")) {
		return "darwin-x86_64";
	}

	if (fileName.includes("universal")) {
		return "darwin-universal";
	}

	return process.arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";
}

function findMacUpdaterArtifacts() {
	const macBundleDir = join(bundleRoot, "macos");
	if (!existsSync(macBundleDir)) {
		throw new Error(`Missing macOS bundle directory: ${macBundleDir}`);
	}

	const files = readdirSync(macBundleDir);
	const updaterArchives = files.filter(
		(file) => file.endsWith(".app.tar.gz") && !file.endsWith(".sig"),
	);

	if (updaterArchives.length === 0) {
		throw new Error(
			`No updater archive found in ${macBundleDir}. Ensure createUpdaterArtifacts is enabled.`,
		);
	}

	return updaterArchives.map((archiveName) => {
		const signaturePath = join(macBundleDir, `${archiveName}.sig`);
		if (!existsSync(signaturePath)) {
			throw new Error(`Missing signature file for ${archiveName}`);
		}

		return {
			archiveName,
			archivePath: join(macBundleDir, archiveName),
			signature: readFileSync(signaturePath, "utf8").trim(),
			platformKey: detectPlatformKey(archiveName),
		};
	});
}

function findDmgArtifact() {
	const dmgDir = join(bundleRoot, "dmg");
	if (!existsSync(dmgDir)) {
		return null;
	}

	const dmg = readdirSync(dmgDir).find((file) => file.endsWith(".dmg"));
	return dmg ? join(dmgDir, dmg) : null;
}

function buildLatestJson(
	version: string,
	notes: string,
	tag: string,
	artifacts: ReturnType<typeof findMacUpdaterArtifacts>,
): LatestJson {
	const platforms: LatestJson["platforms"] = {};

	for (const artifact of artifacts) {
		platforms[artifact.platformKey] = {
			signature: artifact.signature,
			url: `https://github.com/${githubRepo}/releases/download/${tag}/${artifact.archiveName}`,
		};
	}

	return {
		version,
		notes,
		pub_date: new Date().toISOString(),
		platforms,
	};
}

function main() {
	const { notes, dryRun } = parseArgs(process.argv.slice(2));
	const config = readTauriConfig();

	ensurePrerequisites(config);

	const version = config.version;
	const tag = version.startsWith("v") ? version : `v${version}`;
	const releaseNotes = notes.trim() || `CV Tailor ${version} for macOS`;

	console.log(`Building CV Tailor ${version} for macOS...`);

	run("pnpm", ["run", "desktop:build"], {
		env: {
			TAURI_SIGNING_PRIVATE_KEY: privateKeyPath,
			TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
		},
	});

	const updaterArtifacts = findMacUpdaterArtifacts();
	const dmgPath = findDmgArtifact();
	const latestJson = buildLatestJson(
		version,
		releaseNotes,
		tag,
		updaterArtifacts,
	);
	const latestJsonPath = join(bundleRoot, "latest.json");
	writeFileSync(latestJsonPath, `${JSON.stringify(latestJson, null, 2)}\n`);

	console.log(`Wrote ${latestJsonPath}`);

	if (dryRun) {
		console.log("Dry run complete. Skipping GitHub release publish.");
		return;
	}

	const uploadPaths = [
		latestJsonPath,
		...updaterArtifacts.map((artifact) => artifact.archivePath),
		...updaterArtifacts.map((artifact) => `${artifact.archivePath}.sig`),
	];

	if (dmgPath) {
		uploadPaths.push(dmgPath);
	}

	const existingRelease = spawnSync(
		"gh",
		["release", "view", tag, "--repo", githubRepo],
		{ stdio: "pipe" },
	);

	if (existingRelease.status === 0) {
		console.log(`Release ${tag} already exists. Uploading assets...`);
		run("gh", [
			"release",
			"upload",
			tag,
			...uploadPaths,
			"--repo",
			githubRepo,
			"--clobber",
		]);
		return;
	}

	run("gh", [
		"release",
		"create",
		tag,
		"--repo",
		githubRepo,
		"--title",
		`CV Tailor ${version}`,
		"--notes",
		releaseNotes,
		...uploadPaths,
	]);

	console.log(
		`Published ${tag} to https://github.com/${githubRepo}/releases/tag/${tag}`,
	);
}

main();
