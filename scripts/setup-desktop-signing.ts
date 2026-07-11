import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const webRoot = join(repoRoot, "apps/web");
const tauriConfigPath = join(webRoot, "src-tauri/tauri.conf.json");
const privateKeyPath = join(homedir(), ".tauri", "cv-tailor.key");
const publicKeyPath = `${privateKeyPath}.pub`;

function runTauriSignerGenerate() {
	const result = spawnSync(
		"pnpm",
		["tauri", "signer", "generate", "--ci", "-p", "", "-w", privateKeyPath],
		{
			cwd: webRoot,
			stdio: "inherit",
		},
	);

	if (result.status !== 0) {
		throw new Error("Failed to generate Tauri signing keys.");
	}
}

function readPublicKey() {
	if (!existsSync(publicKeyPath)) {
		throw new Error(`Missing public key at ${publicKeyPath}`);
	}

	return readFileSync(publicKeyPath, "utf8").trim();
}

function syncPublicKeyToConfig(publicKey: string) {
	const config = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
		plugins?: {
			updater?: {
				pubkey?: string;
			};
		};
	};

	config.plugins ??= {};
	config.plugins.updater ??= {};
	config.plugins.updater.pubkey = publicKey;

	writeFileSync(tauriConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

function main() {
	if (!existsSync(privateKeyPath)) {
		console.log(`Generating signing keys at ${privateKeyPath}`);
		runTauriSignerGenerate();
	} else {
		console.log(`Using existing signing key at ${privateKeyPath}`);
	}

	const publicKey = readPublicKey();
	syncPublicKeyToConfig(publicKey);

	console.log(
		"Updated apps/web/src-tauri/tauri.conf.json with the updater public key.",
	);
	console.log(`Private key: ${privateKeyPath} (keep this secret)`);
	console.log(`Public key:  ${publicKeyPath}`);
}

main();
