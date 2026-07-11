import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
		[
			"tauri",
			"signer",
			"generate",
			"--ci",
			"--force",
			"--password=",
			"-w",
			privateKeyPath,
		],
		{
			cwd: webRoot,
			stdio: "inherit",
			env: {
				...process.env,
				CI: "true",
			},
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

	const publicKey = readFileSync(publicKeyPath, "utf8").trim();

	try {
		const decoded = Buffer.from(publicKey, "base64").toString("utf8");
		if (!decoded.includes("minisign public key")) {
			throw new Error("not a minisign public key");
		}
	} catch {
		throw new Error(
			`Invalid public key at ${publicKeyPath}. It looks like a private key was copied into the .pub file. Delete ~/.tauri/cv-tailor.key and ~/.tauri/cv-tailor.key.pub, then run this command again.`,
		);
	}

	return publicKey;
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

function removeExistingKeys() {
	for (const path of [privateKeyPath, publicKeyPath]) {
		if (existsSync(path)) {
			unlinkSync(path);
		}
	}
}

function ensureValidKeys() {
	if (!existsSync(privateKeyPath)) {
		console.log(`Generating signing keys at ${privateKeyPath}`);
		runTauriSignerGenerate();
		return;
	}

	try {
		readPublicKey();
		console.log(`Using existing signing key at ${privateKeyPath}`);
	} catch (error) {
		console.warn(
			error instanceof Error ? error.message : "Invalid existing signing keys.",
		);
		console.log("Regenerating signing keys...");
		removeExistingKeys();
		runTauriSignerGenerate();
	}
}

function main() {
	ensureValidKeys();

	const publicKey = readPublicKey();
	syncPublicKeyToConfig(publicKey);

	console.log(
		"Updated apps/web/src-tauri/tauri.conf.json with the updater public key.",
	);
	console.log(`Private key: ${privateKeyPath} (keep this secret)`);
	console.log(`Public key:  ${publicKeyPath}`);
}

main();
