import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
	plugins: [
		react(),
		electron({
			main: {
				entry: "electron/main.ts",
				vite: {
					build: {
						outDir: "dist-electron",
						rollupOptions: {
							// Native/binary-path-resolving deps must stay real `require()`
							// calls (not inlined) so their `__dirname`-relative lookups
							// still point at node_modules, not at dist-electron/.
							external: [
								"electron",
								"ffmpeg-static",
								"uiohook-napi",
								"@huggingface/transformers",
								"onnxruntime-node",
								"sharp",
							],
							output: { format: "cjs", entryFileNames: "main.cjs" },
						},
					},
				},
			},
			preload: {
				input: "electron/preload.ts",
				vite: {
					build: {
						outDir: "dist-electron",
						rollupOptions: {
							output: { format: "cjs", entryFileNames: "preload.cjs" },
						},
					},
				},
			},
		}),
		renderer(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
