/** Decodes an audio/video file's first channel into per-bucket peak amplitudes (0-1), for drawing a waveform. */
export async function computeWaveformPeaks(fileUrl: string, bucketCount: number): Promise<number[]> {
	const response = await fetch(fileUrl);
	const arrayBuffer = await response.arrayBuffer();
	const AudioContextCtor =
		window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const audioContext = new AudioContextCtor();

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		const channelData = audioBuffer.getChannelData(0);
		const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
		const peaks: number[] = [];

		for (let bucket = 0; bucket < bucketCount; bucket += 1) {
			const start = bucket * samplesPerBucket;
			const end = Math.min(channelData.length, start + samplesPerBucket);
			let max = 0;
			for (let i = start; i < end; i += 1) {
				const value = Math.abs(channelData[i]);
				if (value > max) max = value;
			}
			peaks.push(max);
		}

		return peaks;
	} finally {
		void audioContext.close();
	}
}
