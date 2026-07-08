import type { AiToolId } from "@cv-tailor/ai";
import type { Application, BaseProfile, CvRun } from "@cv-tailor/core";

export interface AiToolStatus {
	id: "claude" | "codex";
	label: string;
	available: boolean;
	version?: string;
	error?: string;
}

export interface AiRunRequest {
	tool: AiToolId;
	prompt: string;
	schema: unknown;
}

export interface AiRunResponse {
	tool: "claude" | "codex";
	stdout: string;
	stderr: string;
	durationMs: number;
}

export interface FetchUrlTextResponse {
	url: string;
	status: number;
	contentType?: string;
	text: string;
}

export interface ExportPdfResponse {
	path: string;
	revealed: boolean;
}

export function isTauriRuntime() {
	return "__TAURI_INTERNALS__" in globalThis;
}

async function loadInvoke() {
	if (!isTauriRuntime()) {
		return undefined;
	}

	const { invoke } = await import("@tauri-apps/api/core");
	return invoke;
}

export async function detectAiTools(): Promise<AiToolStatus[]> {
	const invoke = await loadInvoke();

	if (!invoke) {
		return [
			{
				id: "claude",
				label: "Claude Code",
				available: false,
				error: "CLI generation is available in the Tauri desktop app.",
			},
			{
				id: "codex",
				label: "Codex CLI",
				available: false,
				error: "CLI generation is available in the Tauri desktop app.",
			},
		];
	}

	return invoke<AiToolStatus[]>("detect_ai_tools");
}

export async function runAiTool(request: AiRunRequest): Promise<AiRunResponse> {
	const invoke = await loadInvoke();

	if (!invoke) {
		throw new Error(
			"CLI generation is available only in the Tauri desktop app.",
		);
	}

	return invoke<AiRunResponse>("run_ai_tool", { request });
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
		},
	});
}
