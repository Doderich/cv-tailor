import { isTauriRuntime } from "@/lib/tauri-ai";

export interface ProfileFileSource {
	name: string;
	text: string;
	error?: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
	"txt",
	"md",
	"markdown",
	"json",
	"csv",
	"html",
	"htm",
	"rtf",
]);

const PDF_EXTENSIONS = new Set(["pdf"]);

export const PROFILE_SOURCE_FILE_ACCEPT =
	".txt,.md,.markdown,.json,.csv,.html,.htm,.rtf,.pdf";

function getExtension(fileName: string) {
	const index = fileName.lastIndexOf(".");
	if (index === -1) {
		return "";
	}

	return fileName.slice(index + 1).toLowerCase();
}

function fileToBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				reject(new Error("Could not read the file."));
				return;
			}

			const base64 = reader.result.split(",")[1];
			if (!base64) {
				reject(new Error("Could not encode the file."));
				return;
			}

			resolve(base64);
		};
		reader.onerror = () => {
			reject(reader.error ?? new Error("Could not read the file."));
		};
		reader.readAsDataURL(file);
	});
}

async function extractProfileFileText(input: {
	fileName: string;
	contentBase64: string;
}) {
	const { invoke } = await import("@tauri-apps/api/core");
	return invoke<{ fileName: string; text: string }>(
		"extract_profile_file_text",
		{ request: input },
	);
}

async function readProfileSourceFile(file: File): Promise<ProfileFileSource> {
	if (file.size > MAX_FILE_SIZE_BYTES) {
		return {
			name: file.name,
			text: "",
			error: "File is larger than 5 MB.",
		};
	}

	const extension = getExtension(file.name);

	if (TEXT_EXTENSIONS.has(extension)) {
		try {
			const text = await file.text();
			if (!text.trim()) {
				return {
					name: file.name,
					text: "",
					error: "File is empty.",
				};
			}

			return {
				name: file.name,
				text,
			};
		} catch (error) {
			return {
				name: file.name,
				text: "",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	if (PDF_EXTENSIONS.has(extension)) {
		if (!isTauriRuntime()) {
			return {
				name: file.name,
				text: "",
				error:
					"PDF import requires the desktop app. Paste the resume text instead.",
			};
		}

		try {
			const response = await extractProfileFileText({
				fileName: file.name,
				contentBase64: await fileToBase64(file),
			});

			if (!response.text.trim()) {
				return {
					name: file.name,
					text: "",
					error: "No readable text was found in the PDF.",
				};
			}

			return {
				name: response.fileName,
				text: response.text,
			};
		} catch (error) {
			return {
				name: file.name,
				text: "",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	return {
		name: file.name,
		text: "",
		error: `Unsupported file type: .${extension || "unknown"}`,
	};
}

export async function readProfileSourceFiles(
	files: FileList | File[],
): Promise<ProfileFileSource[]> {
	const list = Array.from(files);
	return Promise.all(list.map((file) => readProfileSourceFile(file)));
}

export function mergeProfileFileSources(
	current: ProfileFileSource[],
	incoming: ProfileFileSource[],
) {
	const seen = new Set(current.map((file) => file.name.toLowerCase()));
	const next = [...current];

	for (const file of incoming) {
		const key = file.name.toLowerCase();
		if (seen.has(key)) {
			const index = next.findIndex((item) => item.name.toLowerCase() === key);
			if (index >= 0) {
				next[index] = file;
			}
			continue;
		}

		seen.add(key);
		next.push(file);
	}

	return next;
}
