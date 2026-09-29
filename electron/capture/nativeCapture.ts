import { type ChildProcessByStdio, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { app } from "electron";

export interface NativeCaptureOptions {
	directory: string;
	fileName: string;
	monitorIndex: number;
	fps: number;
	bitrate: number;
}

export interface NativeCaptureResult {
	filePath: string;
	fileSizeBytes: number;
}

let activeProcess: ChildProcessByStdio<Writable, Readable, Readable> | null = null;
let activeOutputPath: string | null = null;

function getBinaryPath(): string {
	const binaryName = "recly-capture-record.exe";
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "native", "win32-x64", binaryName);
	}
	return path.join(app.getAppPath(), "electron", "native", "bin", "win32-x64", binaryName);
}

export async function isNativeCaptureAvailable(): Promise<boolean> {
	if (process.platform !== "win32") return false;
	try {
		await fs.access(getBinaryPath());
		return true;
	} catch {
		return false;
	}
}

export async function startNativeCapture(options: NativeCaptureOptions): Promise<void> {
	if (activeProcess) {
		throw new Error("A native capture is already running.");
	}

	const outputPath = path.join(options.directory, `${options.fileName}.mp4`);
	await fs.mkdir(options.directory, { recursive: true });

	const child = spawn(
		getBinaryPath(),
		[
			"--output",
			outputPath,
			"--monitor",
			String(options.monitorIndex),
			"--fps",
			String(options.fps),
			"--bitrate",
			String(options.bitrate),
		],
		{ stdio: ["pipe", "pipe", "pipe"] },
	);

	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const timeout = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill();
			reject(new Error("Native capture did not start in time."));
		}, 10_000);

		let stdoutBuffer = "";
		child.stdout.on("data", (chunk: Buffer) => {
			if (settled) return;
			stdoutBuffer += chunk.toString("utf8");
			if (stdoutBuffer.includes("RECORDING")) {
				settled = true;
				clearTimeout(timeout);
				resolve();
			}
		});

		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(error);
		});

		child.once("exit", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(new Error(`Native capture process exited early (code ${code}).`));
		});
	});

	activeProcess = child;
	activeOutputPath = outputPath;
}

export async function stopNativeCapture(): Promise<NativeCaptureResult> {
	const child = activeProcess;
	const outputPath = activeOutputPath;
	if (!child || !outputPath) {
		throw new Error("No native capture is running.");
	}

	await new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			child.kill();
			resolve();
		}, 10_000);
		child.once("exit", () => {
			clearTimeout(timeout);
			resolve();
		});
		child.stdin.write("stop\n");
		child.stdin.end();
	});

	activeProcess = null;
	activeOutputPath = null;

	const stats = await fs.stat(outputPath);
	return { filePath: outputPath, fileSizeBytes: stats.size };
}
