import type { AiProviderId } from "@cv-tailor/ai";
import type { Application, BaseProfile, CvRun, CvTemplateId } from "@cv-tailor/core";

export interface LmStudioConfig {
	baseUrl?: string;
	apiKey?: string;
	model?: string;
	enableReasoning?: boolean;
}

export interface LmStudioModel {
	id: string;
	label: string;
}

export interface AiToolStatus {
	id: AiProviderId;
	label: string;
	available: boolean;
	version?: string;
	error?: string;
	resolvedPath?: string;
}

export interface AiToolPaths {
	claude?: string;
	codex?: string;
	cursor?: string;
}

export interface AiRunRequest {
	tool: AiProviderId;
	prompt: string;
	schema: unknown;
	model?: string;
	runId?: string;
	toolPaths?: AiToolPaths;
	lmStudio?: LmStudioConfig;
}

export interface AiRunResponse {
	tool: AiProviderId;
	stdout: string;
	stderr: string;
	durationMs: number;
}

export interface AiRunProgressEvent {
	runId: string;
	stream: "stderr" | "stdout" | "status";
	text: string;
}

export const AI_RUN_PROGRESS_EVENT = "ai-run-progress";

export interface FetchUrlTextResponse {
	url: string;
	status: number;
	contentType?: string;
	text: string;
}

export interface ExportPdfLabels {
	summary: string;
	skills: string;
	experience: string;
	projects: string;
	education: string;
	languages: string;
	present: string;
	nameFallback: string;
}

export interface ExportPdfResponse {
	path: string;
	revealed: boolean;
}

export function isTauriRuntime() {
	return "__TAURI_INTERNALS__" in globalThis;
}

function usesSameOriginGateway() {
	return import.meta.env.VITE_AI_GATEWAY_SAME_ORIGIN === "true";
}

function aiGatewayUrl() {
	// Hosted by the gateway: always call relative `/api/...` (works on phone/VPN hosts).
	if (usesSameOriginGateway()) {
		return "";
	}

	const value = import.meta.env.VITE_AI_GATEWAY_URL;
	if (typeof value === "string" && value.trim()) {
		return value.trim().replace(/\/$/, "");
	}
	return "";
}

/**
 * Optional Bearer token for cross-origin gateway clients.
 * Never read from `import.meta.env` — Vite would bake secrets into the web bundle.
 * Same-origin UI uses an HttpOnly cookie set by the gateway instead.
 */
function aiGatewayToken() {
	if (usesSameOriginGateway() || typeof sessionStorage === "undefined") {
		return "";
	}

	return sessionStorage.getItem("cv-tailor-gateway-token")?.trim() ?? "";
}

export function hasAiGateway() {
	if (usesSameOriginGateway()) {
		return true;
	}

	return (
		typeof import.meta.env.VITE_AI_GATEWAY_URL === "string" &&
		Boolean(import.meta.env.VITE_AI_GATEWAY_URL.trim())
	);
}

async function loadInvoke() {
	if (!isTauriRuntime()) {
		return undefined;
	}

	const { invoke } = await import("@tauri-apps/api/core");
	return invoke;
}

/** Shared HTTP client for gateway-hosted AI / cloud-backup APIs. */
export async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const base = aiGatewayUrl();
	if (!usesSameOriginGateway() && !base) {
		throw new Error("AI gateway URL is not configured.");
	}

	const headers = new Headers(init?.headers);
	headers.set("Accept", "application/json");
	if (init?.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	const token = aiGatewayToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	const response = await fetch(`${base}${path}`, {
		...init,
		headers,
		// Same-origin UI auth is an HttpOnly cookie set by the gateway.
		credentials: usesSameOriginGateway() ? "include" : "same-origin",
	});

	if (!response.ok) {
		let details = `HTTP ${response.status}`;
		try {
			const payload = (await response.json()) as {
				message?: string;
				details?: string;
			};
			details = [payload.message, payload.details].filter(Boolean).join(" ");
		} catch {
			// ignore non-JSON error bodies
		}
		throw new Error(details || `AI gateway request failed (${response.status})`);
	}

	return (await response.json()) as T;
}

function browserStubStatuses(): AiToolStatus[] {
	const gatewayHint = hasAiGateway()
		? "AI gateway is configured but unreachable."
		: "Open the Tauri desktop app or set VITE_AI_GATEWAY_URL.";

	return [
		{
			id: "claude",
			label: "Claude Code",
			available: false,
			error: gatewayHint,
		},
		{
			id: "codex",
			label: "Codex CLI",
			available: false,
			error: gatewayHint,
		},
		{
			id: "cursor",
			label: "Cursor Agent",
			available: false,
			error: gatewayHint,
		},
		{
			id: "lmstudio",
			label: "LM Studio",
			available: false,
			error: gatewayHint,
		},
	];
}

export async function detectAiTools(
	paths?: AiToolPaths,
	lmStudio?: LmStudioConfig,
): Promise<AiToolStatus[]> {
	const invoke = await loadInvoke();

	if (invoke) {
		return invoke<AiToolStatus[]>("detect_ai_tools", {
			paths: paths ?? null,
			lmStudio: lmStudio ?? null,
		});
	}

	if (hasAiGateway()) {
		return gatewayFetch<AiToolStatus[]>("/api/ai/tools", {
			method: "POST",
			body: JSON.stringify({
				paths: paths ?? null,
				lmStudio: lmStudio ?? null,
			}),
		});
	}

	return browserStubStatuses();
}

export async function listLmStudioModels(
	config: LmStudioConfig,
): Promise<LmStudioModel[]> {
	const invoke = await loadInvoke();

	if (invoke) {
		return invoke<LmStudioModel[]>("list_lm_studio_models", { config });
	}

	if (hasAiGateway()) {
		return gatewayFetch<LmStudioModel[]>("/api/ai/lmstudio/models", {
			method: "POST",
			body: JSON.stringify(config),
		});
	}

	return [];
}

export async function suggestAiToolPaths(): Promise<AiToolPaths> {
	const invoke = await loadInvoke();

	if (invoke) {
		return invoke<AiToolPaths>("suggest_ai_tool_paths");
	}

	if (hasAiGateway()) {
		return gatewayFetch<AiToolPaths>("/api/ai/paths");
	}

	return {};
}

export function formatAppError(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === "object") {
		const record = error as { message?: unknown; details?: unknown };
		const message =
			typeof record.message === "string" ? record.message : undefined;
		const details =
			typeof record.details === "string" ? record.details : undefined;

		if (message && details) {
			return `${message} ${details}`;
		}

		if (details) {
			return details;
		}

		if (message) {
			return message;
		}
	}

	return String(error);
}

export async function runAiTool(
	request: AiRunRequest,
	options?: {
		onProgress?: (event: AiRunProgressEvent) => void;
	},
): Promise<AiRunResponse> {
	const invoke = await loadInvoke();

	if (!invoke && !hasAiGateway()) {
		throw new Error(
			"AI generation needs the Tauri desktop app or VITE_AI_GATEWAY_URL.",
		);
	}

	const shouldStream = Boolean(options?.onProgress && invoke);
	const runId = shouldStream
		? (request.runId ?? crypto.randomUUID())
		: undefined;
	let unlisten: (() => void) | undefined;

	if (shouldStream && options?.onProgress) {
		const { listen } = await import("@tauri-apps/api/event");
		unlisten = await listen<AiRunProgressEvent>(
			AI_RUN_PROGRESS_EVENT,
			(event) => {
				if (event.payload.runId === runId) {
					options.onProgress?.(event.payload);
				}
			},
		);
	}

	try {
		const payload = {
			...request,
			...(runId ? { runId } : {}),
		};

		if (invoke) {
			return await invoke<AiRunResponse>("run_ai_tool", {
				request: payload,
			});
		}

		return await gatewayFetch<AiRunResponse>("/api/ai/run", {
			method: "POST",
			body: JSON.stringify(payload),
		});
	} finally {
		unlisten?.();
	}
}

export async function fetchUrlText(url: string): Promise<FetchUrlTextResponse> {
	const invoke = await loadInvoke();

	if (!invoke) {
		throw new Error("URL import is available only in the Tauri desktop app.");
	}

	return invoke<FetchUrlTextResponse>("fetch_url_text", { request: { url } });
}

export async function exportGeneratedCvPdf(
	profile: BaseProfile,
	application: Application,
	run: CvRun,
	cvTemplate: CvTemplateId,
	labels: ExportPdfLabels,
): Promise<ExportPdfResponse> {
	const invoke = await loadInvoke();

	if (!invoke) {
		throw new Error(
			"Native PDF export is available only in the Tauri desktop app.",
		);
	}

	return invoke<ExportPdfResponse>("export_generated_cv_pdf", {
		request: {
			profile,
			generatedCv: {
				id: application.id,
				createdAt: run.createdAt,
				updatedAt: run.updatedAt,
				jobOffer: application.jobOffer,
				signals: run.signals,
				matchAnalysis: run.matchAnalysis,
				cv: run.cv,
				aiTool: run.aiTool,
			},
			cvTemplate,
			labels,
		},
	});
}

export async function printGeneratedCv(): Promise<void> {
	const invoke = await loadInvoke();

	if (!invoke) {
		window.print();
		return;
	}

	await invoke("print_generated_cv");
}
