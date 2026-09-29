import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from "mediabunny";
import type { ExportQuality } from "../../electron/export/exportMedia";

const QUALITY_LEVEL_BY_EXPORT_QUALITY: Record<ExportQuality, "medium" | "high" | "very-high"> = {
	medium: "medium",
	good: "high",
	high: "very-high",
	source: "very-high",
};

export interface ModernVideoEncoder {
	/** Encodes the canvas's current pixels as the frame at `timestampSeconds`. Await before mutating the canvas again. */
	addFrame: (timestampSeconds: number, durationSeconds: number) => Promise<void>;
	/** Finalizes the container and returns the encoded video-only MP4 buffer. */
	finish: () => Promise<ArrayBuffer>;
}

/** Wraps mediabunny's WebCodecs-backed CanvasSource: a video-only H.264/MP4 encoder fed directly from a canvas,
 * avoiding the legacy path's lossy double-encode (canvas -> VP9/webm via MediaRecorder -> libx264/mp4 via ffmpeg). */
export function createModernVideoEncoder(
	canvas: HTMLCanvasElement,
	frameRate: number,
	quality: ExportQuality,
): ModernVideoEncoder {
	const target = new BufferTarget();
	const output = new Output({ format: new Mp4OutputFormat(), target });
	const canvasSource = new CanvasSource(canvas, {
		codec: "avc",
		quality: new Quality(QUALITY_LEVEL_BY_EXPORT_QUALITY[quality]),
		keyFrameInterval: 2,
	});
	output.addVideoTrack(canvasSource, { frameRate });

	let started = false;

	return {
		addFrame: async (timestampSeconds, durationSeconds) => {
			if (!started) {
				started = true;
				await output.start();
			}
			await canvasSource.add(timestampSeconds, durationSeconds);
		},
		finish: async () => {
			await output.finalize();
			if (!target.buffer) throw new Error("Modern export produced no output buffer");
			return target.buffer;
		},
	};
}
