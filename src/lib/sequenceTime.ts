import type { ClipRegion } from "../../electron/project/projectTypes";

/**
 * Inverse of resolveSequencePosition: maps a timestamp in the raw source
 * recording to where (if anywhere) it lands in the edited output sequence.
 * Returns null when the source timestamp falls in a cut/trimmed-out range
 * that no clip covers — such a moment simply doesn't appear in the output.
 */
export function sourceTimeToSequenceMs(clips: ClipRegion[], sourceMs: number): number | null {
	let precedingOutputMs = 0;
	for (const clip of clips) {
		if (sourceMs >= clip.sourceStartMs && sourceMs <= clip.sourceEndMs) {
			return precedingOutputMs + (sourceMs - clip.sourceStartMs) / clip.speed;
		}
		precedingOutputMs += (clip.sourceEndMs - clip.sourceStartMs) / clip.speed;
	}
	return null;
}
