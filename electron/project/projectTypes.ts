export type BackgroundChoice =
	| "none"
	| "custom"
	| "color"
	| "video"
	| "violet"
	| "midnight"
	| "sunset"
	| "aurora"
	| "coral"
	| "forest"
	| "ocean"
	| "ember"
	| "lavender"
	| "steel"
	| "rose"
	| "citrus"
	| "mint"
	| "plum"
	| "slate"
	| "gold"
	| "arctic"
	| "berry"
	| "indigo"
	| "teal"
	| "crimson"
	| "amber"
	| "jade"
	| "sapphire"
	| "copper"
	| "orchid"
	| "fern"
	| "dusk"
	| "flame"
	| "glacier";
export type CropAspect = "full" | "16:9" | "1:1" | "custom";
export type AnnotationType = "arrow" | "rect" | "blur" | "highlight" | "text" | "figure" | "image";
export type FigureDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type TextFontWeight = "normal" | "bold";
export type TextFontStyle = "normal" | "italic";
export type TextDecorationStyle = "none" | "underline";
export type TextAlign = "left" | "center" | "right";
export type ZoomTransitionEasing = "linear" | "glide" | "smooth" | "snappy" | "signature";
export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
	1: 1.25,
	2: 1.7,
	3: 2.2,
	4: 2.9,
	5: 3.8,
	6: 5.0,
};

/** Two zoom regions closer together than this (ms) blend directly into each other instead of easing back to 1x. */
export const DEFAULT_CONNECTED_ZOOM_GAP_MS = 250;

/** A free-form crop rect, normalized (0-1) against the full source frame, anchored top-left. */
export interface CropRegion {
	xNorm: number;
	yNorm: number;
	wNorm: number;
	hNorm: number;
}

export const FULL_CROP_REGION: CropRegion = { xNorm: 0, yNorm: 0, wNorm: 1, hNorm: 1 };

/** Pixel gap between the recording frame and the canvas edge (only visible when a background
 * is showing). `linked` keeps all four sides in sync when the user drags any one slider. */
export interface FramePadding {
	top: number;
	bottom: number;
	left: number;
	right: number;
	linked: boolean;
}

export const DEFAULT_FRAME_PADDING: FramePadding = { top: 24, bottom: 24, left: 24, right: 24, linked: true };
export const MAX_FRAME_PADDING_PX = 250;

/** A single caption line, timed against the raw source recording (like ZoomRegion). */
/** One transcribed word with its own timing, for karaoke-style per-word caption animation. */
export interface CaptionCueWord {
	text: string;
	startMs: number;
	endMs: number;
}

export interface CaptionCue {
	id: string;
	startMs: number;
	endMs: number;
	text: string;
	words?: CaptionCueWord[];
}

export type CaptionAnimationStyle = "fade" | "pop" | "slide-up" | "typewriter" | "karaoke";
export type CaptionPosition = "bottom" | "top" | "center";

export interface AutoCaptionSettings {
	fontFamily: string;
	/** 0 keeps the existing behavior of auto-sizing relative to frame height. */
	fontSizePx: number;
	position: CaptionPosition;
	positionOffsetNorm: number;
	maxWidthNorm: number;
	maxRows: number;
	animationStyle: CaptionAnimationStyle;
	boxRadius: number;
	textColor: string;
	backgroundColor: string;
	backgroundOpacity: number;
	/** BCP-47 language hint passed to Whisper, or "auto" to let it detect the language. */
	language: string;
}

export const DEFAULT_AUTO_CAPTION_SETTINGS: AutoCaptionSettings = {
	fontFamily: "default",
	fontSizePx: 0,
	position: "bottom",
	positionOffsetNorm: 0.08,
	maxWidthNorm: 0.82,
	maxRows: 2,
	animationStyle: "fade",
	boxRadius: 8,
	textColor: "#ffffff",
	backgroundColor: "#000000",
	backgroundOpacity: 0.6,
	language: "auto",
};

export interface Annotation {
	id: string;
	type: AnnotationType;
	timestampMs: number;
	xNorm: number;
	yNorm: number;
	wNorm: number;
	hNorm: number;
	color: string;
	text?: string;
	zIndex?: number;
	backgroundColor?: string | null;
	fontWeight?: TextFontWeight;
	fontStyle?: TextFontStyle;
	textDecoration?: TextDecorationStyle;
	textAlign?: TextAlign;
	borderRadius?: number;
	figureDirection?: FigureDirection;
	imagePath?: string;
}

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	focusXNorm: number;
	focusYNorm: number;
	depth: ZoomDepth;
	easingIn: ZoomTransitionEasing;
	easingOut: ZoomTransitionEasing;
	durationInMs: number;
	durationOutMs: number;
}

export interface ClipRegion {
	id: string;
	sourceStartMs: number;
	sourceEndMs: number;
	speed: number;
	/** Excludes this clip's own recorded audio from the export mix — a dead-air/cough cut that
	 * keeps the video visible without needing to actually delete the segment. Standalone audio
	 * regions (background music etc.) are unaffected, since they're timed independently. */
	muted?: boolean;
}

export const SPEED_PRESETS: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** A standalone audio track overlay (e.g. background music), independent of the recording's own audio. */
export interface AudioRegion {
	id: string;
	filePath: string;
	startMs: number;
	durationMs: number;
	offsetMs: number;
	volume: number;
	normalize: boolean;
	/** Which timeline lane this region sits in — purely organizational (lets overlapping
	 * regions, e.g. background music + a sound effect, coexist without visually colliding).
	 * The export mix already layers every region together via amix regardless of lane. */
	trackIndex?: number;
}

export const MAX_AUDIO_TRACK_LANES = 4;

export interface CursorSampleRecord {
	timestampMs: number;
	xNorm: number;
	yNorm: number;
	kind: "move" | "down" | "up";
}

export interface ReclyProject {
	version: 2;
	videoPath: string;
	cursorTelemetryPath: string | null;
	durationMs: number;
	clips: ClipRegion[];
	zoomRegions: ZoomRegion[];
	audioRegions: AudioRegion[];
	captions: CaptionCue[];
	captionSettings: AutoCaptionSettings;
	includeCaptionSidecar: boolean;
	background: BackgroundChoice;
	customBackgroundPath: string | null;
	customBackgroundColor: string;
	customBackgroundVideoPath: string | null;
	backgroundBlur: number;
	cropAspect: CropAspect;
	cropRegion: CropRegion;
	frameShadowEnabled: boolean;
	frameRadius: number;
	framePadding: FramePadding;
	annotations: Annotation[];
	customFontFamily: string | null;
	customFontPath: string | null;
	exportFormat: "mp4" | "gif";
	exportEncoderBackend: "legacy" | "modern";
	exportQuality: "medium" | "good" | "high" | "source";
	exportMp4FrameRate: 24 | 30 | 60;
	exportGifFrameRate: 15 | 20 | 25 | 30;
	exportGifSizePreset: "medium" | "large" | "original";
	exportGifLoop: boolean;
}

export function createDefaultProject(videoPath: string, durationMs: number): ReclyProject {
	return {
		version: 2,
		videoPath,
		cursorTelemetryPath: null,
		durationMs,
		clips: [{ id: "clip-1", sourceStartMs: 0, sourceEndMs: durationMs, speed: 1 }],
		zoomRegions: [],
		audioRegions: [],
		captions: [],
		captionSettings: { ...DEFAULT_AUTO_CAPTION_SETTINGS },
		includeCaptionSidecar: false,
		background: "none",
		customBackgroundPath: null,
		customBackgroundColor: "#2A2035",
		customBackgroundVideoPath: null,
		backgroundBlur: 0,
		cropAspect: "full",
		cropRegion: { ...FULL_CROP_REGION },
		frameShadowEnabled: true,
		frameRadius: 24,
		framePadding: { ...DEFAULT_FRAME_PADDING },
		annotations: [],
		customFontFamily: null,
		customFontPath: null,
		exportFormat: "mp4",
		exportEncoderBackend: "legacy",
		exportQuality: "medium",
		exportMp4FrameRate: 30,
		exportGifFrameRate: 20,
		exportGifSizePreset: "medium",
		exportGifLoop: true,
	};
}

export function getSequenceDurationMs(clips: ClipRegion[]): number {
	return clips.reduce((total, clip) => total + (clip.sourceEndMs - clip.sourceStartMs) / clip.speed, 0);
}

/** Maps a position along the full output sequence to the clip playing there and the source time within it. */
export function resolveSequencePosition(
	clips: ClipRegion[],
	sequenceMs: number,
): { clip: ClipRegion; clipIndex: number; sourceTimeMs: number } | null {
	let cursor = 0;
	for (let index = 0; index < clips.length; index += 1) {
		const clip = clips[index];
		const outputDuration = (clip.sourceEndMs - clip.sourceStartMs) / clip.speed;
		if (sequenceMs <= cursor + outputDuration || index === clips.length - 1) {
			const withinClipMs = Math.max(0, sequenceMs - cursor);
			const sourceTimeMs = clip.sourceStartMs + withinClipMs * clip.speed;
			return { clip, clipIndex: index, sourceTimeMs: Math.min(sourceTimeMs, clip.sourceEndMs) };
		}
		cursor += outputDuration;
	}
	return null;
}

/** Suggests zoom regions from raw cursor telemetry: clusters of low movement become zoom-ins. */
export function suggestZoomRegionsFromTelemetry(
	samples: CursorSampleRecord[],
	durationMs: number,
): ZoomRegion[] {
	if (samples.length === 0) return [];

	const IDLE_GAP_MS = 900;
	const MIN_REGION_MS = 1200;
	const regions: ZoomRegion[] = [];

	let clusterStart = samples[0].timestampMs;
	let clusterSamples: CursorSampleRecord[] = [samples[0]];

	const flush = (endMs: number) => {
		if (clusterSamples.length === 0) return;
		const durationOfCluster = endMs - clusterStart;
		if (durationOfCluster >= MIN_REGION_MS) {
			const avgX = clusterSamples.reduce((sum, sample) => sum + sample.xNorm, 0) / clusterSamples.length;
			const avgY = clusterSamples.reduce((sum, sample) => sum + sample.yNorm, 0) / clusterSamples.length;
			regions.push({
				id: `zoom-${regions.length}-${Math.round(clusterStart)}`,
				startMs: Math.max(0, clusterStart - 200),
				endMs: Math.min(durationMs, endMs + 200),
				focusXNorm: avgX,
				focusYNorm: avgY,
				depth: 2,
				easingIn: "smooth",
				easingOut: "smooth",
				durationInMs: 400,
				durationOutMs: 400,
			});
		}
	};

	for (let index = 1; index < samples.length; index += 1) {
		const sample = samples[index];
		const previous = samples[index - 1];
		if (sample.timestampMs - previous.timestampMs > IDLE_GAP_MS) {
			flush(previous.timestampMs);
			clusterStart = sample.timestampMs;
			clusterSamples = [];
		}
		clusterSamples.push(sample);
	}
	flush(samples[samples.length - 1].timestampMs);

	return regions;
}
