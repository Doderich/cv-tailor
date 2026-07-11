import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const passthroughArgs = process.argv.slice(3);
const tsxCli = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const releaseScript = join(
	repoRoot,
	"scripts/release-desktop-windows-local.ts",
);

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? repoRoot,
		stdio: "inherit",
		shell: options.shell ?? false,
		env: process.env,
	});

	if (result.error) {
		console.error(`Failed to start ${command}: ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function runTsScript(scriptPath, args = []) {
	if (!existsSync(tsxCli)) {
		console.error("Missing tsx. Run: pnpm install");
		process.exit(1);
	}

	run(process.execPath, [tsxCli, scriptPath, ...args]);
}

function requireMacSshConfig() {
	const localScript = join(repoRoot, "scripts/windows-build.local");
	const buildScript = join(localScript, "build.sh");

	if (!existsSync(buildScript)) {
		console.error("Missing SSH config for remote Windows builds.");
		console.error("Run: pnpm run desktop:windows:setup");
		console.error("Then edit scripts/windows-build.local/config.sh");
		process.exit(1);
	}

	return localScript;
}

const action = process.argv[2];

if (!action || action === "--help" || action === "-h") {
	console.log(`Usage: node scripts/desktop-windows.mjs <action> [-- options]

Actions:
  build      Build on Windows (local) or via SSH (macOS/Linux)
  release    Build + publish from Windows, or via SSH from macOS/Linux
  connect    Open SSH session to the Windows repo (macOS/Linux only)
  setup      Create gitignored SSH config from template (macOS/Linux only)

On Windows, run from the repo root:
  pnpm run desktop:windows:build
  pnpm run desktop:windows:release -- --notes "Release notes"

From macOS/Linux, configure SSH once with desktop:windows:setup, then use the
same commands to build on your remote Windows machine.
`);
	process.exit(action ? 0 : 1);
}

if (action === "build") {
	if (process.platform === "win32") {
		run(
			"powershell",
			[
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				join(repoRoot, "scripts/windows-remote-build.ps1"),
				"-RepoPath",
				repoRoot,
			],
			{ shell: true },
		);
	} else {
		requireMacSshConfig();
		run("bash", [
			join(repoRoot, "scripts/windows-build.local/build.sh"),
			...passthroughArgs,
		]);
	}
} else if (action === "release") {
	if (process.platform === "win32") {
		runTsScript(releaseScript, passthroughArgs);
	} else {
		requireMacSshConfig();
		run("bash", [
			join(repoRoot, "scripts/windows-build.local/release.sh"),
			...passthroughArgs,
		]);
	}
} else if (action === "connect") {
	if (process.platform === "win32") {
		console.error("desktop:windows:connect is only available from macOS/Linux.");
		process.exit(1);
	}

	requireMacSshConfig();
	run("bash", [join(repoRoot, "scripts/windows-build.local/connect.sh")]);
} else if (action === "setup") {
	if (process.platform === "win32") {
		console.log("SSH setup is only needed on macOS/Linux.");
		console.log("On Windows, run: pnpm run desktop:setup-signing");
		process.exit(0);
	}

	run("bash", [join(repoRoot, "scripts/setup-windows-build-local.sh")]);
} else {
	console.error(`Unknown action: ${action}`);
	process.exit(1);
}
