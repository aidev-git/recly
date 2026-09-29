import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input, type WrappedCanvas } from "mediabunny";
import type { ClipRegion } from "../../electron/project/projectTypes";

/** Reads the whole recording into memory once, as a Blob shared by both the video and audio decode
 * passes below. `file://` URLs don't support HTTP range requests, so mediabunny's `UrlSource` would
 * otherwise stream the file sequentially and evict old bytes — breaking any backward seek (e.g. clips
 * reordered earlier in the timeline than a previous clip). `BlobSource` gives true random access instead. */
export async function fetchVideoBlob(fileUrl: string): Promise<Blob> {
	const response = await fetch(fileUrl);
	if (!response.ok) throw new Error(`Could not read the recording file (status ${response.status}).`);
	return response.blob();
}

/** Precomputes the source-time (seconds) of every output frame across the whole edited sequence,
 * at `captureFps`, respecting each clip's trim range and speed. */
export function computeSequenceFrameTimestamps(clips: ClipRegion[], captureFps: number): number[] {
	const frameDurationMs = 1000 / captureFps;
	const timestamps: number[] = [];
	for (const clip of clips) {
		const outputDurationMs = (clip.sourceEndMs - clip.sourceStartMs) / clip.speed;
		const frameCount = Math.max(1, Math.round(outputDurationMs / frameDurationMs));
		for (let i = 0; i < frameCount; i += 1) {
			const sourceMs = clip.sourceStartMs + i * frameDurationMs * clip.speed;
			timestamps.push(Math.min(sourceMs, clip.sourceEndMs) / 1000);
		}
	}
	return timestamps;
}

export interface FastVideoSource {
	/** Yields one decoded canvas per requested timestamp, in order, decoding as fast as the hardware allows
	 * (not paced to realtime playback). Yields null for a timestamp outside the track's range. */
	canvasesForTimestamps: (timestampsSeconds: number[]) => AsyncGenerator<WrappedCanvas | null, void, unknown>;
	dispose: () => void;
}

/** Opens the recording's video track for fast, hardware-accelerated (WebCodecs) frame-by-frame decoding,
 * or null if the file has no video track. */
export async function openFastVideoSource(blob: Blob): Promise<FastVideoSource | null> {
	const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
	const videoTrack = await input.getPrimaryVideoTrack();
	if (!videoTrack) {
		input.dispose();
		return null;
	}

	const sink = new CanvasSink(videoTrack, { poolSize: 4 });
	return {
		canvasesForTimestamps: (timestampsSeconds) => sink.canvasesAtTimestamps(timestampsSeconds),
		dispose: () => input.dispose(),
	};
}

async function decodeClipAudio(
	sink: AudioBufferSink,
	sampleRate: number,
	channelCount: number,
	startMs: number,
	endMs: number,
): Promise<AudioBuffer | null> {
	const startSec = startMs / 1000;
	const endSec = endMs / 1000;
	const totalFrames = Math.max(0, Math.round((endSec - startSec) * sampleRate));
	if (totalFrames === 0) return null;

	const channelData: Float32Array<ArrayBuffer>[] = Array.from(
		{ length: channelCount },
		() => new Float32Array(totalFrames),
	);

	for await (const wrapped of sink.buffers(startSec, endSec)) {
		const destStartFrame = Math.round((wrapped.timestamp - startSec) * sampleRate);
		for (let channel = 0; channel < channelCount; channel += 1) {
			const sourceChannel = wrapped.buffer.getChannelData(Math.min(channel, wrapped.buffer.numberOfChannels - 1));
			for (let i = 0; i < sourceChannel.length; i += 1) {
				const destIndex = destStartFrame + i;
				if (destIndex >= 0 && destIndex < totalFrames) {
					channelData[channel][destIndex] = sourceChannel[i];
				}
			}
		}
	}

	const audioBuffer = new AudioBuffer({ length: totalFrames, numberOfChannels: channelCount, sampleRate });
	channelData.forEach((data, channel) => audioBuffer.copyToChannel(data, channel));
	return audioBuffer;
}

/** Naive (non-pitch-preserving) speed change: unlike HTMLMediaElement.playbackRate, this shifts pitch along
 * with speed, like changing tape speed. Runs on an OfflineAudioContext, so it's fast regardless of `speed`. */
async function resampleBySpeed(buffer: AudioBuffer, speed: number): Promise<AudioBuffer> {
	if (speed === 1) return buffer;
	const outputLength = Math.max(1, Math.round(buffer.length / speed));
	const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, outputLength, buffer.sampleRate);
	const source = offlineCtx.createBufferSource();
	source.buffer = buffer;
	source.playbackRate.value = speed;
	source.connect(offlineCtx.destination);
	source.start(0);
	return offlineCtx.startRendering();
}

function concatAudioBuffers(buffers: AudioBuffer[], sampleRate: number, channelCount: number): AudioBuffer {
	const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
	const result = new AudioBuffer({ length: totalLength, numberOfChannels: channelCount, sampleRate });
	let offset = 0;
	for (const buffer of buffers) {
		for (let channel = 0; channel < channelCount; channel += 1) {
			const data = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
			result.copyToChannel(data, channel, offset);
		}
		offset += buffer.length;
	}
	return result;
}

/** Decodes and assembles the sequence's base audio (per clip, speed-adjusted) entirely offline — no
 * realtime playback needed, unlike the legacy path's captureStream()-while-playing approach. Returns
 * null if the recording has no audio track. */
export async function renderSequenceAudioOffline(blob: Blob, clips: ClipRegion[]): Promise<AudioBuffer | null> {
	const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
	try {
		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) return null;

		const sampleRate = await audioTrack.getSampleRate();
		const channelCount = await audioTrack.getNumberOfChannels();
		const sink = new AudioBufferSink(audioTrack);

		const clipBuffers: AudioBuffer[] = [];
		for (const clip of clips) {
			if (clip.muted) {
				const outputFrames = Math.max(
					1,
					Math.round(((clip.sourceEndMs - clip.sourceStartMs) / clip.speed / 1000) * sampleRate),
				);
				clipBuffers.push(new AudioBuffer({ length: outputFrames, numberOfChannels: channelCount, sampleRate }));
				continue;
			}
			const raw = await decodeClipAudio(sink, sampleRate, channelCount, clip.sourceStartMs, clip.sourceEndMs);
			if (!raw) continue;
			clipBuffers.push(await resampleBySpeed(raw, clip.speed));
		}

		if (clipBuffers.length === 0) return null;
		return concatAudioBuffers(clipBuffers, sampleRate, channelCount);
	} finally {
		input.dispose();
	}
}

/** Encodes an AudioBuffer as a 16-bit PCM WAV file. */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
	const numChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const numFrames = buffer.length;
	const blockAlign = numChannels * 2;
	const dataSize = numFrames * blockAlign;
	const arrayBuffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(arrayBuffer);

	const writeString = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true);
	writeString(36, "data");
	view.setUint32(40, dataSize, true);

	const channelData = Array.from({ length: numChannels }, (_, channel) => buffer.getChannelData(channel));
	let offset = 44;
	for (let frame = 0; frame < numFrames; frame += 1) {
		for (let channel = 0; channel < numChannels; channel += 1) {
			const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
			view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
			offset += 2;
		}
	}

	return arrayBuffer;
}
