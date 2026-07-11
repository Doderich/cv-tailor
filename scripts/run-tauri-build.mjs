import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(repoRoot, "apps/web");
const privateKeyPath = join(homedir(), ".tauri", "cv-tailor.key");
const passthroughArgs = process.argv.slice(2);

const env = {
	...process.env,
	CI: "true",
};

if (existsSync(privateKeyPath)) {
	env.TAURI_SIGNING_PRIVATE_KEY = privateKeyPath;
}

const hasBundlesFlag = passthroughArgs.some((arg) => arg === "--bundles");
const defaultBundles =
	process.platform === "win32" && !hasBundlesFlag
		? ["--bundles", "nsis"]
		: [];

const result = spawnSync(
	"pnpm",
	["tauri", "build", "--ci", ...defaultBundles, ...passthroughArgs],
	{
		cwd: webRoot,
		stdio: "inherit",
		env,
		shell: process.platform === "win32",
	},
);

if (result.error) {
	console.error(`Failed to start build: ${result.error.message}`);
	process.exit(1);
}

process.exit(result.status ?? 1);
