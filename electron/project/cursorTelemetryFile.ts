import { promises as fs } from "node:fs";
import path from "node:path";
import type { CursorSampleRecord } from "./projectTypes";

export async function saveCursorTelemetry(
	videoFilePath: string,
	samples: CursorSampleRecord[],
): Promise<string> {
	const sidecarPath = `${videoFilePath}.cursor.json`;
	await fs.writeFile(sidecarPath, JSON.stringify(samples), "utf8");
	return sidecarPath;
}

export async function loadCursorTelemetry(sidecarPath: string): Promise<CursorSampleRecord[]> {
	try {
		const raw = await fs.readFile(sidecarPath, "utf8");
		return JSON.parse(raw) as CursorSampleRecord[];
	} catch {
		return [];
	}
}

export function cursorTelemetryPathFor(videoFilePath: string): string {
	return path.join(`${videoFilePath}.cursor.json`);
}
