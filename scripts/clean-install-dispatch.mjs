import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const result =
	process.platform === "win32"
		? spawnSync(
				"powershell",
				[
					"-NoProfile",
					"-ExecutionPolicy",
					"Bypass",
					"-File",
					join(repoRoot, "scripts/clean-install.ps1"),
				],
				{ stdio: "inherit", shell: true, cwd: repoRoot },
			)
		: spawnSync("bash", [join(repoRoot, "scripts/clean-install.sh")], {
				stdio: "inherit",
				cwd: repoRoot,
			});

process.exit(result.status ?? 1);
