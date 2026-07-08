import fs from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) {
						return;
					}

					if (
						id.includes("/react/") ||
						id.includes("/react-dom/") ||
						id.includes("/scheduler/")
					) {
						return "react-vendor";
					}

					if (id.includes("/@tanstack/")) {
						return "router-vendor";
					}

					if (id.includes("/zod/")) {
						return "validation-vendor";
					}

					if (id.includes("/@base-ui/") || id.includes("/@floating-ui/")) {
						return "ui-vendor";
					}

					if (
						id.includes("/sonner/") ||
						id.includes("/next-themes/") ||
						id.includes("/tailwind-merge/") ||
						id.includes("/clsx/") ||
						id.includes("/lucide-react/")
					) {
						return "interface-vendor";
					}
				},
			},
		},
	},
	optimizeDeps: {
		exclude: [
			"@tanstack/db",
			"@tanstack/browser-db-sqlite-persistence",
			"@tanstack/db-sqlite-persistence-core",
			"@journeyapps/wa-sqlite",
		],
	},
	server: {
		port: 1420,
		strictPort: true,
	},
	preview: {
		port: 1420,
		strictPort: true,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		{
			name: "serve-wasm-files",
			configureServer(server) {
				const wasmHandler = (
					req: { url?: string },
					res: {
						writeHead: (
							status: number,
							headers: Record<string, string>,
						) => void;
						end: (body: Buffer) => void;
					},
					next: () => void,
				) => {
					const urlWithoutQuery = (req.url ?? "").split("?")[0];
					if (!urlWithoutQuery.endsWith(".wasm")) {
						return next();
					}

					const fsPrefix = "/@fs";
					let filePath: string | undefined;
					if (urlWithoutQuery.startsWith(fsPrefix)) {
						filePath = urlWithoutQuery.slice(fsPrefix.length);
					}

					if (!filePath || !fs.existsSync(filePath)) {
						return next();
					}

					const content = fs.readFileSync(filePath);
					res.writeHead(200, {
						"Content-Type": "application/wasm",
						"Content-Length": String(content.byteLength),
						"Cache-Control": "no-cache",
					});
					res.end(content);
				};

				server.middlewares.stack.unshift({
					route: "",
					handle: wasmHandler,
				});
			},
		},
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
