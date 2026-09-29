import type { CaptionCue, ClipRegion } from "../../electron/project/projectTypes";
import { sourceTimeToSequenceMs } from "@/lib/sequenceTime";

function formatSrtTimestamp(ms: number): string {
	const totalMs = Math.max(0, Math.round(ms));
	const hours = Math.floor(totalMs / 3_600_000);
	const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
	const seconds = Math.floor((totalMs % 60_000) / 1000);
	const millis = totalMs % 1000;
	const pad = (value: number, length = 2) => String(value).padStart(length, "0");
	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/** Converts caption cues (stored in raw source time) into an SRT sidecar file, remapped to the
 * edited sequence's timeline — the same timeline the exported video itself plays on. Cues fully
 * or partially inside a cut/trimmed-out range are dropped rather than guessed at. */
export function captionsToSrt(cues: CaptionCue[], clips: ClipRegion[]): string {
	const entries: string[] = [];
	let index = 1;

	for (const cue of cues) {
		const startSeqMs = sourceTimeToSequenceMs(clips, cue.startMs);
		const endSeqMs = sourceTimeToSequenceMs(clips, cue.endMs);
		if (startSeqMs === null || endSeqMs === null || endSeqMs <= startSeqMs) continue;

		entries.push(
			`${index}\n${formatSrtTimestamp(startSeqMs)} --> ${formatSrtTimestamp(endSeqMs)}\n${cue.text}\n`,
		);
		index += 1;
	}

	return entries.join("\n");
}
