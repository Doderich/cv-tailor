import { Button } from "@cv-tailor/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cv-tailor/ui/components/card";
import { cn } from "@cv-tailor/ui/lib/utils";
import { CheckCircle2, Copy, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
	type DesktopAppInfo,
	type DesktopUpdateCheckResult,
	checkForDesktopUpdate,
	DESKTOP_UPDATER_ENDPOINT,
	fetchUpdaterManifestForDebug,
	formatDesktopUpdateDebugReport,
	getLastDesktopUpdateCheck,
	getUpdaterBundleMismatchHint,
	loadDesktopAppInfo,
	subscribeDesktopUpdateChecks,
	type UpdaterManifestDebugInfo,
} from "@/lib/desktop-updater";
import { formatLocalizedDate } from "@/lib/i18n-labels";

function DebugRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-0.5">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="break-all font-mono text-xs">{value}</span>
		</div>
	);
}

function statusTone(status: DesktopUpdateCheckResult["status"] | "idle" | "checking") {
	switch (status) {
		case "current":
		case "installed":
			return "text-primary";
		case "available":
		case "installing":
			return "text-foreground";
		case "error":
			return "text-destructive";
		default:
			return "text-muted-foreground";
	}
}

export function DesktopUpdatesPanel() {
	const { t } = useTranslation();
	const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
	const [lastCheck, setLastCheck] = useState<DesktopUpdateCheckResult | null>(
		getLastDesktopUpdateCheck(),
	);
	const [isChecking, setIsChecking] = useState(false);
	const [isLoadingDebug, setIsLoadingDebug] = useState(false);
	const [manifest, setManifest] = useState<UpdaterManifestDebugInfo | null>(null);
	const [manifestError, setManifestError] = useState<string | null>(null);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
		"idle",
	);

	useEffect(() => {
		let cancelled = false;

		async function init() {
			const info = await loadDesktopAppInfo();
			if (cancelled) {
				return;
			}

			setAppInfo(info);

			if (!info) {
				return;
			}

			setIsLoadingDebug(true);
			setManifestError(null);

			try {
				const nextManifest = await fetchUpdaterManifestForDebug();
				if (!cancelled) {
					setManifest(nextManifest);
				}
			} catch (error) {
				if (!cancelled) {
					setManifest(null);
					setManifestError(
						error instanceof Error
							? error.message
							: "Manifest fetch failed.",
					);
				}
			} finally {
				if (!cancelled) {
					setIsLoadingDebug(false);
				}
			}
		}

		void init();
		const unsubscribe = subscribeDesktopUpdateChecks(setLastCheck);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	const status = isChecking ? "checking" : (lastCheck?.status ?? "idle");
	const platformKey =
		appInfo?.platform === "macos" ? `darwin-${appInfo.arch}` : null;
	const remoteArchive =
		platformKey && manifest?.platforms?.[platformKey]?.url
			? decodeURIComponent(
					new URL(manifest.platforms[platformKey].url).pathname
						.split("/")
						.pop() ?? "",
				)
			: null;
	const bundleMismatchHint = getUpdaterBundleMismatchHint({
		appInfo,
		manifest,
		platformKey: platformKey ?? undefined,
	});

	async function handleCheck(allowDevCheck = false) {
		setIsChecking(true);
		try {
			await checkForDesktopUpdate({
				promptBeforeInstall: true,
				notify: true,
				allowDevCheck,
			});
		} finally {
			setIsChecking(false);
		}
	}

	async function handleLoadManifest() {
		setIsLoadingDebug(true);
		setManifestError(null);

		try {
			const nextManifest = await fetchUpdaterManifestForDebug();
			setManifest(nextManifest);
		} catch (error) {
			setManifest(null);
			setManifestError(
				error instanceof Error ? error.message : "Manifest fetch failed.",
			);
		} finally {
			setIsLoadingDebug(false);
		}
	}

	async function handleCopyDebug() {
		const report = formatDesktopUpdateDebugReport({
			appInfo,
			lastCheck,
			manifest,
			manifestError: manifestError ?? undefined,
		});

		try {
			await navigator.clipboard.writeText(report);
			setCopyState("copied");
			window.setTimeout(() => setCopyState("idle"), 2_000);
		} catch {
			setCopyState("error");
			window.setTimeout(() => setCopyState("idle"), 2_000);
		}
	}

	const statusMessage = (() => {
		if (isChecking) {
			return t("settings.data.updates.status.checking");
		}

		if (!lastCheck) {
			return t("settings.data.updates.status.idle");
		}

		switch (lastCheck.status) {
			case "current":
				return t("settings.data.updates.status.current", {
					version: lastCheck.currentVersion ?? appInfo?.version ?? "—",
				});
			case "available":
				return t("settings.data.updates.status.available", {
					version: lastCheck.availableVersion ?? "—",
				});
			case "declined":
				return t("settings.data.updates.status.declined", {
					version: lastCheck.availableVersion ?? "—",
				});
			case "installing":
				return t("settings.data.updates.status.installing", {
					version: lastCheck.availableVersion ?? "—",
				});
			case "installed":
				return t("settings.data.updates.status.installed", {
					version: lastCheck.availableVersion ?? "—",
				});
			case "dev_skipped":
				return t("settings.data.updates.status.devSkipped");
			case "error":
				return lastCheck.message ?? t("settings.data.updates.status.error");
			default:
				return lastCheck.message ?? t("settings.data.updates.status.idle");
		}
	})();

	return (
		<div className="grid gap-4">
			<div className="grid gap-3">
				<div>
					<h3 className="font-medium text-base">
						{t("settings.data.updates.title")}
					</h3>
					<p className="text-muted-foreground text-sm">
						{t("settings.data.updates.description")}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<div className="rounded-md border bg-card px-3 py-2">
						<p className="text-muted-foreground text-xs">
							{t("settings.data.updates.currentVersion")}
						</p>
						<p className="mt-0.5 font-semibold text-sm">
							{appInfo?.version ?? "…"}
						</p>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={isChecking}
							onClick={() => void handleCheck(false)}
						>
							{isChecking ? (
								<Loader2 className="animate-spin" />
							) : (
								<RefreshCw />
							)}
							{t("settings.data.updates.check")}
						</Button>

						{appInfo?.isDevBuild ? (
							<Button
								variant="outline"
								size="sm"
								disabled={isChecking}
								onClick={() => void handleCheck(true)}
							>
								{t("settings.data.updates.checkDev")}
							</Button>
						) : null}
					</div>
				</div>

				<div
					className={cn(
						"flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
						status === "current" || status === "installed"
							? "border-primary/30 bg-primary/5"
							: status === "error"
								? "border-destructive/30 bg-destructive/5"
								: "bg-card",
					)}
				>
					{status === "current" || status === "installed" ? (
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
					) : status === "error" ? (
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
					) : isChecking ? (
						<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
					) : null}
					<div className="min-w-0">
						<p className={cn("font-medium", statusTone(status))}>
							{statusMessage}
						</p>
						{lastCheck ? (
							<p className="mt-1 text-muted-foreground text-xs">
								{t("settings.data.updates.lastChecked", {
									date: formatLocalizedDate(lastCheck.checkedAt),
								})}
							</p>
						) : null}
					</div>
				</div>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t("settings.data.updates.debug.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<DebugRow
							label={t("settings.data.updates.debug.platform")}
							value={
								appInfo
									? `${appInfo.platform} (${appInfo.arch})`
									: t("settings.data.updates.debug.unavailable")
							}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.osVersion")}
							value={appInfo?.osVersion ?? "—"}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.build")}
							value={
								appInfo?.isDevBuild
									? t("settings.data.updates.debug.devBuild")
									: t("settings.data.updates.debug.releaseBuild")
							}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.autoUpdate")}
							value={
								appInfo?.updaterEnabled
									? t("settings.data.updates.debug.enabled")
									: t("settings.data.updates.debug.disabled")
							}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.endpoint")}
							value={DESKTOP_UPDATER_ENDPOINT}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.expectedArchive")}
							value={appInfo?.expectedUpdaterArchive ?? "—"}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.remoteArchive")}
							value={remoteArchive ?? "—"}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.manifestVersion")}
							value={manifest?.version ?? "—"}
						/>
						<DebugRow
							label={t("settings.data.updates.debug.manifestPlatforms")}
							value={
								Object.keys(manifest?.platforms ?? {}).join(", ") || "—"
							}
						/>
					</div>

					{bundleMismatchHint ? (
						<p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
							{bundleMismatchHint}
						</p>
					) : null}

					{manifestError ? (
						<p className="text-destructive text-sm">{manifestError}</p>
					) : null}

					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={isLoadingDebug}
							onClick={() => void handleLoadManifest()}
						>
							{isLoadingDebug ? (
								<Loader2 className="animate-spin" />
							) : (
								<RefreshCw />
							)}
							{t("settings.data.updates.debug.fetchManifest")}
						</Button>
						<Button variant="outline" size="sm" onClick={() => void handleCopyDebug()}>
							<Copy />
							{copyState === "copied"
								? t("settings.data.updates.debug.copied")
								: copyState === "error"
									? t("settings.data.updates.debug.copyFailed")
									: t("settings.data.updates.debug.copy")}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
