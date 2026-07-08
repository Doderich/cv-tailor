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
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
