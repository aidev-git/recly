import { promises as fs } from "node:fs";

export function micSidecarPathFor(videoFilePath: string): string {
	return `${videoFilePath}.mic.webm`;
}

export async function saveMicSidecar(videoFilePath: string, data: Buffer): Promise<string> {
	const sidecarPath = micSidecarPathFor(videoFilePath);
	await fs.writeFile(sidecarPath, data);
	return sidecarPath;
}

export async function checkMicSidecar(videoFilePath: string): Promise<string | null> {
	const sidecarPath = micSidecarPathFor(videoFilePath);
	try {
		await fs.access(sidecarPath);
		return sidecarPath;
	} catch {
		return null;
	}
}
