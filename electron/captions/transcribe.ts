import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import ffmpegPath from "ffmpeg-static";
import type { CaptionCue, CaptionCueWord } from "../project/projectTypes";

export type TranscriptionProgress =
	| { phase: "downloading-model"; file: string; progress: number }
	| { phase: "transcribing" };

export type WhisperModelSize = "tiny" | "base" | "small";

export const WHISPER_MODEL_IDS: Record<WhisperModelSize, string> = {
	tiny: "Xenova/whisper-tiny",
	base: "Xenova/whisper-base",
	small: "Xenova/whisper-small",
};

interface WhisperWordChunk {
	text: string;
	timestamp: [number, number | null];
}

/** Groups Whisper's per-word timestamps into readable caption cues: a new cue starts whenever
 * there's a pause longer than MAX_GAP_MS, or the current cue has grown past MAX_WORDS words or
 * MAX_DURATION_MS long — whichever comes first. Keeps the constituent words on each cue for
 * word-level (karaoke-style) animation. */
function groupWordsIntoCues(words: CaptionCueWord[]): CaptionCue[] {
	const MAX_GAP_MS = 700;
	const MAX_WORDS = 14;
	const MAX_DURATION_MS = 6000;

	const cues: CaptionCue[] = [];
	let currentWords: CaptionCueWord[] = [];

	const flush = () => {
		if (currentWords.length === 0) return;
		cues.push({
			id: `caption-${cues.length}-${Date.now()}`,
			startMs: currentWords[0].startMs,
			endMs: currentWords[currentWords.length - 1].endMs,
			text: currentWords.map((word) => word.text).join(" ").replace(/\s+([,.!?])/g, "$1"),
			words: currentWords,
		});
		currentWords = [];
	};

	for (const word of words) {
		const previous = currentWords[currentWords.length - 1];
		const gapMs = previous ? word.startMs - previous.endMs : 0;
		const durationSoFar = currentWords.length > 0 ? word.endMs - currentWords[0].startMs : 0;

		if (previous && (gapMs > MAX_GAP_MS || currentWords.length >= MAX_WORDS || durationSoFar > MAX_DURATION_MS)) {
			flush();
		}
		currentWords.push(word);
	}
	flush();

	return cues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cachedPipelinePromises = new Map<WhisperModelSize, Promise<any>>();

function getTranscriber(modelSize: WhisperModelSize, onProgress?: (progress: TranscriptionProgress) => void) {
	const cached = cachedPipelinePromises.get(modelSize);
	if (cached) return cached;

	const promise = (async () => {
		const { pipeline, env } = await import("@huggingface/transformers");
		env.cacheDir = path.join(app.getPath("userData"), "whisper-models");
		return pipeline("automatic-speech-recognition", WHISPER_MODEL_IDS[modelSize], {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			progress_callback: (data: any) => {
				if (data?.status === "progress" && onProgress) {
					onProgress({
						phase: "downloading-model",
						file: data.file ?? "",
						progress: data.progress ?? 0,
					});
				}
			},
		});
	})();
	cachedPipelinePromises.set(modelSize, promise);
	return promise;
}

function extractMonoWav(videoPath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!ffmpegPath) {
			reject(new Error("ffmpeg binary not found"));
			return;
		}
		const wavPath = path.join(app.getPath("temp"), `recly-caption-${Date.now()}.wav`);
		const child = spawn(ffmpegPath, ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath]);
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(wavPath);
			else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
		});
	});
}

async function readPcm16MonoWav(filePath: string): Promise<Float32Array> {
	const buffer = await readFile(filePath);
	const dataStart = 44;
	const sampleCount = Math.max(0, Math.floor((buffer.length - dataStart) / 2));
	const samples = new Float32Array(sampleCount);
	for (let i = 0; i < sampleCount; i += 1) {
		samples[i] = buffer.readInt16LE(dataStart + i * 2) / 32768;
	}
	return samples;
}

/** Transcribes a recording locally via a Whisper model (transformers.js/ONNX Runtime — no native
 * compiler, no cloud upload). Requests word-level timestamps and groups them into cues itself
 * (gap/length-based), so each cue also carries its constituent words for karaoke-style animation. */
export async function transcribeVideo(
	videoPath: string,
	modelSize: WhisperModelSize,
	language: string,
	onProgress?: (progress: TranscriptionProgress) => void,
): Promise<CaptionCue[]> {
	const wavPath = await extractMonoWav(videoPath);
	try {
		const transcriber = await getTranscriber(modelSize, onProgress);
		onProgress?.({ phase: "transcribing" });
		const samples = await readPcm16MonoWav(wavPath);
		const output = await transcriber(samples, {
			return_timestamps: "word",
			chunk_length_s: 30,
			...(language !== "auto" ? { language } : {}),
		});
		const chunks: WhisperWordChunk[] = Array.isArray(output) ? output : (output.chunks ?? []);

		const words: CaptionCueWord[] = chunks
			.filter((chunk) => chunk.text && chunk.text.trim().length > 0)
			.map((chunk) => ({
				text: chunk.text.trim(),
				startMs: Math.round((chunk.timestamp[0] ?? 0) * 1000),
				endMs: Math.round((chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0) * 1000),
			}));

		return groupWordsIntoCues(words);
	} finally {
		await unlink(wavPath).catch(() => undefined);
	}
}
