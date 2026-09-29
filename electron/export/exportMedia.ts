import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export type ExportFormat = "mp4" | "gif";
export type ExportQuality = "medium" | "good" | "high" | "source";
export type ExportMp4FrameRate = 24 | 30 | 60;
export type ExportGifFrameRate = 15 | 20 | 25 | 30;
export type ExportGifSizePreset = "medium" | "large" | "original";

export interface ExportAudioRegionInput {
	filePath: string;
	startMs: number;
	offsetMs: number;
	durationMs: number;
	volume: number;
	normalize: boolean;
}

export interface ExportMp4Options {
	format: "mp4";
	quality: ExportQuality;
	frameRate: ExportMp4FrameRate;
	audioRegions?: ExportAudioRegionInput[];
}

export interface ExportGifOptions {
	format: "gif";
	frameRate: ExportGifFrameRate;
	sizePreset: ExportGifSizePreset;
	loop: boolean;
}

export type ExportOptions = ExportMp4Options | ExportGifOptions;

export interface ExportResult {
	filePath: string;
	fileSizeBytes: number;
}

const CRF_BY_QUALITY: Record<ExportQuality, number> = {
	medium: 26,
	good: 21,
	high: 18,
	source: 15,
};

const GIF_WIDTH_BY_PRESET: Record<ExportGifSizePreset, number | null> = {
	medium: 480,
	large: 720,
	original: null,
};

export async function exportMediaFile(
	buffer: Buffer,
	targetDirectory: string,
	baseFileName: string,
	options: ExportOptions,
): Promise<ExportResult> {
	await fs.mkdir(targetDirectory, { recursive: true });

	if (!ffmpegPath) {
		throw new Error("ffmpeg binary not found");
	}

	const tempWebmPath = path.join(targetDirectory, `${baseFileName}.webm`);
	await fs.writeFile(tempWebmPath, buffer);

	let filePath: string;
	try {
		filePath =
			options.format === "gif"
				? await exportGif(ffmpegPath, tempWebmPath, targetDirectory, baseFileName, options)
				: await exportMp4(ffmpegPath, tempWebmPath, targetDirectory, baseFileName, options);
	} finally {
		await fs.unlink(tempWebmPath).catch(() => undefined);
	}

	const stats = await fs.stat(filePath);
	return { filePath, fileSizeBytes: stats.size };
}

/** Remuxes a video track already encoded in the renderer (WebCodecs/mediabunny) with a separately captured
 * audio-only recording and any standalone audio regions — no video re-encode (`-c:v copy`), avoiding the
 * lossy double-transcode of the legacy path (canvas -> VP9/webm -> libx264/mp4). */
export async function exportPrecodedMp4(
	videoBuffer: Buffer,
	audioBuffer: Buffer | null,
	audioRegions: ExportAudioRegionInput[],
	targetDirectory: string,
	baseFileName: string,
	audioBufferFormat: "webm" | "wav" = "webm",
): Promise<ExportResult> {
	await fs.mkdir(targetDirectory, { recursive: true });
	if (!ffmpegPath) {
		throw new Error("ffmpeg binary not found");
	}

	const videoPath = path.join(targetDirectory, `${baseFileName}.video.mp4`);
	await fs.writeFile(videoPath, videoBuffer);
	const audioPath = audioBuffer ? path.join(targetDirectory, `${baseFileName}.audio.${audioBufferFormat}`) : null;
	if (audioPath && audioBuffer) await fs.writeFile(audioPath, audioBuffer);

	const outputPath = path.join(targetDirectory, `${baseFileName}.mp4`);

	try {
		const inputArgs = ["-i", videoPath];
		if (audioPath) inputArgs.push("-i", audioPath);
		audioRegions.forEach((region) => inputArgs.push("-i", region.filePath));

		let mediaArgs: string[];
		if (audioPath && audioRegions.length > 0) {
			mediaArgs = [...buildAudioMixArgs("1:a", 2, audioRegions), "-c:v", "copy"];
		} else if (audioPath) {
			mediaArgs = ["-map", "0:v", "-map", "1:a", "-c:v", "copy"];
		} else {
			mediaArgs = ["-map", "0:v", "-c:v", "copy"];
		}

		await runFfmpeg(ffmpegPath, [
			"-y",
			...inputArgs,
			...mediaArgs,
			"-c:a",
			"aac",
			"-movflags",
			"+faststart",
			outputPath,
		]);
	} finally {
		await fs.unlink(videoPath).catch(() => undefined);
		if (audioPath) await fs.unlink(audioPath).catch(() => undefined);
	}

	const stats = await fs.stat(outputPath);
	return { filePath: outputPath, fileSizeBytes: stats.size };
}

/** Builds the ffmpeg args that mix a base audio track with standalone audio regions via amix, or [] if there are no regions. */
function buildAudioMixArgs(
	baseAudioLabel: string,
	regionInputStartIndex: number,
	audioRegions: ExportAudioRegionInput[],
): string[] {
	if (audioRegions.length === 0) return [];

	const filterParts: string[] = [];
	const mixLabels: string[] = [baseAudioLabel];
	audioRegions.forEach((region, index) => {
		const inputIndex = regionInputStartIndex + index;
		const label = `a${inputIndex}`;
		const filters = [
			`atrim=start=${(region.offsetMs / 1000).toFixed(3)}:duration=${(region.durationMs / 1000).toFixed(3)}`,
			"asetpts=PTS-STARTPTS",
			`adelay=${Math.round(region.startMs)}|${Math.round(region.startMs)}`,
			`volume=${region.volume}`,
		];
		if (region.normalize) filters.push("loudnorm");
		filterParts.push(`[${inputIndex}:a]${filters.join(",")}[${label}]`);
		mixLabels.push(label);
	});
	filterParts.push(
		`${mixLabels.map((label) => `[${label}]`).join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[aout]`,
	);
	return ["-filter_complex", filterParts.join(";"), "-map", "0:v", "-map", "[aout]"];
}

async function exportMp4(
	ffmpeg: string,
	inputPath: string,
	targetDirectory: string,
	baseFileName: string,
	options: ExportMp4Options,
): Promise<string> {
	const outputPath = path.join(targetDirectory, `${baseFileName}.mp4`);
	const audioRegions = options.audioRegions ?? [];

	const inputArgs = ["-i", inputPath];
	audioRegions.forEach((region) => inputArgs.push("-i", region.filePath));

	const mixArgs = buildAudioMixArgs("0:a", 1, audioRegions);

	await runFfmpeg(ffmpeg, [
		"-y",
		...inputArgs,
		"-r",
		String(options.frameRate),
		"-c:v",
		"libx264",
		"-preset",
		options.quality === "source" ? "slow" : "veryfast",
		"-crf",
		String(CRF_BY_QUALITY[options.quality]),
		...mixArgs,
		"-c:a",
		"aac",
		"-movflags",
		"+faststart",
		outputPath,
	]);

	return outputPath;
}

async function exportGif(
	ffmpeg: string,
	inputPath: string,
	targetDirectory: string,
	baseFileName: string,
	options: ExportGifOptions,
): Promise<string> {
	const outputPath = path.join(targetDirectory, `${baseFileName}.gif`);
	const palettePath = path.join(targetDirectory, `${baseFileName}.palette.png`);
	const width = GIF_WIDTH_BY_PRESET[options.sizePreset];
	const scaleFilter = width ? `,scale=${width}:-1:flags=lanczos` : "";
	const filters = `fps=${options.frameRate}${scaleFilter}`;
	const loopFlag = options.loop ? "0" : "-1";

	await runFfmpeg(ffmpeg, [
		"-y",
		"-i",
		inputPath,
		"-vf",
		`${filters},palettegen`,
		palettePath,
	]);

	await runFfmpeg(ffmpeg, [
		"-y",
		"-i",
		inputPath,
		"-i",
		palettePath,
		"-lavfi",
		`${filters} [x]; [x][1:v] paletteuse`,
		"-loop",
		loopFlag,
		outputPath,
	]);

	await fs.unlink(palettePath).catch(() => undefined);

	return outputPath;
}

function runFfmpeg(binaryPath: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(binaryPath, args);
		let stderr = "";

		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
			}
		});
	});
}
