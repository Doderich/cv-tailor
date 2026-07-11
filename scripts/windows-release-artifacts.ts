import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { githubRepo, type LatestJson } from "./desktop-release-shared.ts";

export type WindowsUpdaterArtifact = {
	fileName: string;
	localPath: string;
	signature: string;
	platformKey: string;
};

export function detectWindowsPlatformKey(fileName: string) {
	if (fileName.includes("aarch64") || fileName.includes("arm64")) {
		return "windows-aarch64";
	}

	if (fileName.includes("i686") || fileName.includes("x86-setup")) {
		return "windows-i686";
	}

	return "windows-x86_64";
}

export function findWindowsUpdaterArtifacts(localNsisDir: string) {
	if (!existsSync(localNsisDir)) {
		throw new Error(`Missing NSIS bundle directory: ${localNsisDir}`);
	}

	const signatureFiles = readdirSync(localNsisDir).filter((file) =>
		file.endsWith(".sig"),
	);

	if (signatureFiles.length === 0) {
		throw new Error(
			`No updater signatures found in ${localNsisDir}. Ensure createUpdaterArtifacts is enabled.`,
		);
	}

	const artifacts: WindowsUpdaterArtifact[] = [];

	for (const signatureFile of signatureFiles) {
		const bundleName = signatureFile.slice(0, -".sig".length);
		const bundlePath = join(localNsisDir, bundleName);

		if (!existsSync(bundlePath)) {
			continue;
		}

		if (!bundleName.endsWith("-setup.exe") && !bundleName.endsWith(".msi")) {
			continue;
		}

		artifacts.push({
			fileName: bundleName,
			localPath: bundlePath,
			signature: readFileSync(join(localNsisDir, signatureFile), "utf8").trim(),
			platformKey: detectWindowsPlatformKey(bundleName),
		});
	}

	if (artifacts.length === 0) {
		throw new Error(
			`No Windows updater bundles found in ${localNsisDir}. Expected *-setup.exe.sig or *.msi.sig files.`,
		);
	}

	return artifacts;
}

export function collectWindowsUploadPaths(
	latestJsonPath: string,
	updaterArtifacts: WindowsUpdaterArtifact[],
) {
	const uploadPaths = new Set<string>([latestJsonPath]);

	for (const artifact of updaterArtifacts) {
		uploadPaths.add(artifact.localPath);
		uploadPaths.add(`${artifact.localPath}.sig`);
	}

	return [...uploadPaths];
}

export function buildWindowsPlatforms(
	tag: string,
	artifacts: WindowsUpdaterArtifact[],
): LatestJson["platforms"] {
	const platforms: LatestJson["platforms"] = {};

	for (const artifact of artifacts) {
		platforms[artifact.platformKey] = {
			signature: artifact.signature,
			url: `https://github.com/${githubRepo}/releases/download/${tag}/${artifact.fileName}`,
		};
	}

	return platforms;
}

export const windowsNsisBundleDir = join(
	import.meta.dirname,
	"../apps/web/src-tauri/target/release/bundle/nsis",
);
