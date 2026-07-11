import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	symlinkSync,
	unlinkSync,
	watch,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const debugDir = join(webRoot, "src-tauri/target/debug");
const sourceBinary = join(debugDir, "cv-tailor");
const displayBinary = join(debugDir, "CV Tailor");

function ensureDisplayBinarySymlink() {
	if (!existsSync(sourceBinary)) {
		return false;
	}

	mkdirSync(debugDir, { recursive: true });

	if (existsSync(displayBinary)) {
		unlinkSync(displayBinary);
	}

	symlinkSync("cv-tailor", displayBinary);
	return true;
}

function watchDisplayBinarySymlink() {
	if (process.platform !== "darwin") {
		return;
	}

	ensureDisplayBinarySymlink();

	if (!existsSync(debugDir)) {
		mkdirSync(debugDir, { recursive: true });
	}

	watch(debugDir, (_, file) => {
		if (file === "cv-tailor") {
			ensureDisplayBinarySymlink();
		}
	});
}

watchDisplayBinarySymlink();

const child = spawn("pnpm", ["tauri", "dev"], {
	cwd: webRoot,
	stdio: "inherit",
	env: process.env,
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});
