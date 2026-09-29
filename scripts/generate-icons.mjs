// Renders branding/icon.svg into the icon files electron-builder needs.
// Run with: node scripts/generate-icons.mjs

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconGen from "icon-gen";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SOURCE_SVG = path.join(ROOT, "branding", "icon.svg");
const BUILD_DIR = path.join(ROOT, "build");
const PUBLIC_ICON_DIR = path.join(ROOT, "public", "icon");

async function renderPng(svg, size, outPath) {
	await mkdir(path.dirname(outPath), { recursive: true });
	await sharp(svg, { density: 384 }).resize(size, size).png().toFile(outPath);
}

async function main() {
	const svg = await readFile(SOURCE_SVG);

	for (const size of [16, 32, 64, 128, 256, 512]) {
		await renderPng(svg, size, path.join(PUBLIC_ICON_DIR, `${size}.png`));
	}

	const masterPngPath = path.join(BUILD_DIR, "_icon-master-1024.png");
	await renderPng(svg, 1024, masterPngPath);

	await mkdir(BUILD_DIR, { recursive: true });
	await iconGen(masterPngPath, BUILD_DIR, {
		report: false,
		ico: { name: "icon", sizes: [16, 24, 32, 48, 64, 128, 256] },
		icns: { name: "icon", sizes: [16, 32, 64, 128, 256, 512, 1024] },
	});

	await rm(masterPngPath, { force: true });

	console.log(`Generated ${path.join(BUILD_DIR, "icon.ico")}`);
	console.log(`Generated ${path.join(BUILD_DIR, "icon.icns")}`);
	console.log(`Generated ${PUBLIC_ICON_DIR} (16-512 PNGs)`);
}

main().catch((error) => {
	console.error("[generate-icons] failed:", error);
	process.exitCode = 1;
});
