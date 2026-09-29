import type {
	Annotation,
	AutoCaptionSettings,
	BackgroundChoice,
	CaptionCue,
	CaptionCueWord,
	CropAspect,
	CropRegion,
	FigureDirection,
	ZoomTransitionEasing,
	ZoomRegion,
} from "../../electron/project/projectTypes";
import {
	DEFAULT_AUTO_CAPTION_SETTINGS,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_FRAME_PADDING,
	FULL_CROP_REGION,
	ZOOM_DEPTH_SCALES,
} from "../../electron/project/projectTypes";
import type { FramePadding } from "../../electron/project/projectTypes";

export type { CropAspect, CropRegion };

export interface CursorTelemetryState {
	xNorm: number;
	yNorm: number;
	lastMoveAt: number;
	lastClickAt: number;
}

export type CursorClickEffectStyle = "none" | "spotlight" | "ripple" | "echo";
export type CursorSkin = "dot" | "macos" | "windows11" | "tahoe" | "tahoe-inverted" | "figma" | "custom";

export type WebcamPosition =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "bottom-center"
	| "top-center"
	| "middle-left"
	| "middle-center"
	| "middle-right"
	| "custom";

export interface WebcamOverlaySettings {
	position: WebcamPosition;
	customXNorm: number;
	customYNorm: number;
	widthNorm: number;
	heightNorm: number;
	roundness: number;
	shadowEnabled: boolean;
	shadowOpacity: number;
	marginNorm: number;
	mirror: boolean;
	reactToZoom: boolean;
	cropRegion: CropRegion;
	/** Shifts webcam compositing to start this many ms after screen capture starts, compensating
	 * for a webcam feed that otherwise appears to lead the screen (fixed USB/driver latency). */
	timeOffsetMs: number;
	/** Remembered device so the next recording defaults back to the same camera. */
	deviceId: string | null;
}

export const DEFAULT_WEBCAM_OVERLAY: WebcamOverlaySettings = {
	position: "bottom-right",
	customXNorm: 0.5,
	customYNorm: 0.5,
	widthNorm: 0.22,
	heightNorm: 0.22,
	roundness: 1,
	shadowEnabled: true,
	shadowOpacity: 0.5,
	marginNorm: 0.03,
	mirror: true,
	reactToZoom: true,
	cropRegion: { ...FULL_CROP_REGION },
	timeOffsetMs: 0,
	deviceId: null,
};

export interface CursorAppearance {
	size: number;
	smoothing: number;
	sway: number;
	skin: CursorSkin;
	motionBlur: number;
	clickBounce: number;
	clickBounceDurationMs: number;
	clickEffectStyle: CursorClickEffectStyle;
	clickEffectColor: string;
	clickEffectScale: number;
	clickEffectOpacity: number;
	clickEffectDurationMs: number;
	customCursorPath: string | null;
}

export const DEFAULT_CURSOR_APPEARANCE: CursorAppearance = {
	size: 6,
	smoothing: 0.3,
	sway: 0.2,
	skin: "tahoe",
	motionBlur: 0.6,
	clickBounce: 2,
	clickBounceDurationMs: 350,
	clickEffectStyle: "none",
	clickEffectColor: "#8A5F99",
	clickEffectScale: 1,
	clickEffectOpacity: 1,
	clickEffectDurationMs: 600,
	customCursorPath: null,
};

/** Expands 3-digit hex to 6-digit and uppercases, so stored colors compare/display consistently. */
export function normalizeCursorClickEffectColor(hex: string): string {
	const trimmed = hex.trim();
	const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
	const body = withHash.slice(1);
	if (/^[0-9a-fA-F]{3}$/.test(body)) {
		const expanded = body
			.split("")
			.map((c) => c + c)
			.join("");
		return `#${expanded.toUpperCase()}`;
	}
	if (/^[0-9a-fA-F]{6}$/.test(body)) {
		return `#${body.toUpperCase()}`;
	}
	return withHash.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const normalized = hex.replace("#", "");
	const full =
		normalized.length === 3
			? normalized
					.split("")
					.map((c) => c + c)
					.join("")
			: normalized;
	const value = Number.parseInt(full, 16);
	return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

interface PointerSkinPreset {
	fillStart: string;
	fillEnd: string;
	stroke: string;
	lineWidth: number;
	lineJoin: CanvasLineJoin;
	shadow: boolean;
}

const POINTER_SKINS: Record<Exclude<CursorSkin, "dot" | "custom">, PointerSkinPreset> = {
	macos: {
		fillStart: "#ffffff",
		fillEnd: "#ffffff",
		stroke: "#000000",
		lineWidth: 1.2,
		lineJoin: "round",
		shadow: true,
	},
	windows11: {
		fillStart: "#ffffff",
		fillEnd: "#ffffff",
		stroke: "#000000",
		lineWidth: 1.4,
		lineJoin: "miter",
		shadow: true,
	},
	tahoe: {
		fillStart: "#ffffff",
		fillEnd: "#e7e2ea",
		stroke: "rgba(0,0,0,0.35)",
		lineWidth: 1,
		lineJoin: "round",
		shadow: true,
	},
	"tahoe-inverted": {
		fillStart: "#1a1420",
		fillEnd: "#1a1420",
		stroke: "#ffffff",
		lineWidth: 1,
		lineJoin: "round",
		shadow: true,
	},
	figma: {
		fillStart: "#000000",
		fillEnd: "#000000",
		stroke: "#000000",
		lineWidth: 0,
		lineJoin: "miter",
		shadow: false,
	},
};

/** Traces the classic arrow-pointer silhouette (tip at 0,0) used as every OS's default cursor shape. */
function tracePointerArrowPath(ctx: CanvasRenderingContext2D, x: number, y: number, iconScale: number): void {
	const pts: Array<[number, number]> = [
		[0, 0],
		[0, 0.68],
		[0.16, 0.52],
		[0.29, 0.8],
		[0.4, 0.75],
		[0.27, 0.48],
		[0.52, 0.48],
	];
	ctx.beginPath();
	pts.forEach(([px, py], index) => {
		const targetX = x + px * iconScale;
		const targetY = y + py * iconScale;
		if (index === 0) ctx.moveTo(targetX, targetY);
		else ctx.lineTo(targetX, targetY);
	});
	ctx.closePath();
}

function drawPointerArrow(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	iconScale: number,
	skin: Exclude<CursorSkin, "dot" | "custom">,
): void {
	const preset = POINTER_SKINS[skin];
	ctx.save();

	if (preset.shadow) {
		ctx.shadowColor = "rgba(0,0,0,0.4)";
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;
	}

	tracePointerArrowPath(ctx, x, y, iconScale);

	if (preset.fillStart === preset.fillEnd) {
		ctx.fillStyle = preset.fillStart;
	} else {
		const gradient = ctx.createLinearGradient(x, y, x, y + iconScale * 0.8);
		gradient.addColorStop(0, preset.fillStart);
		gradient.addColorStop(1, preset.fillEnd);
		ctx.fillStyle = gradient;
	}
	ctx.fill();

	if (preset.lineWidth > 0) {
		ctx.shadowColor = "transparent";
		ctx.lineJoin = preset.lineJoin;
		ctx.strokeStyle = preset.stroke;
		ctx.lineWidth = preset.lineWidth;
		ctx.stroke();
	}

	ctx.restore();
}

/** The live-recording/preview path draws from a real <video> element; the fast (WebCodecs-decoded) export
 * path draws from a canvas holding one already-decoded frame — both are valid `ctx.drawImage` sources. */
export type CompositorSource = HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas;

function sourceDimensions(source: CompositorSource): { width: number; height: number } {
	if ("videoWidth" in source) return { width: source.videoWidth, height: source.videoHeight };
	return { width: source.width, height: source.height };
}

export interface CompositorConfig {
	outputWidth: number;
	outputHeight: number;
	getSourceElement: () => CompositorSource | null;
	getWebcamElement?: () => HTMLVideoElement | null;
	webcamOverlay?: WebcamOverlaySettings;
	background: BackgroundChoice;
	customBackgroundImage?: HTMLImageElement | null;
	customBackgroundColor?: string;
	getBackgroundVideoElement?: () => HTMLVideoElement | null;
	backgroundBlur?: number;
	textAnnotationFontFamily?: string;
	autoZoomEnabled: boolean;
	zoomRegions?: ZoomRegion[];
	cropAspect: CropAspect;
	cropRegion?: CropRegion | null;
	frameRadius: number;
	frameShadowEnabled: boolean;
	framePadding?: FramePadding;
	cursorRef?: { current: CursorTelemetryState } | null;
	cursorAppearance?: CursorAppearance;
	customCursorImage?: HTMLImageElement | null;
	annotations?: Annotation[];
	getAnnotationImage?: (imagePath: string) => HTMLImageElement | null;
	captions?: CaptionCue[];
	captionSettings?: AutoCaptionSettings;
	getPlaybackTimeMs: () => number;
}

function baseCropRect(
	videoWidth: number,
	videoHeight: number,
	aspect: CropAspect,
): { width: number; height: number } {
	if (aspect === "full") return { width: videoWidth, height: videoHeight };

	const targetRatio = aspect === "16:9" ? 16 / 9 : 1;
	const sourceRatio = videoWidth / videoHeight;

	if (sourceRatio > targetRatio) {
		return { width: videoHeight * targetRatio, height: videoHeight };
	}
	return { width: videoWidth, height: videoWidth / targetRatio };
}

interface ZoomState {
	x: number;
	y: number;
	scale: number;
}

const ZOOM_IDLE_MS = 900;
const ZOOM_TARGET_SCALE = 1.55;
const ZOOM_EASE = 0.06;
const CURSOR_TRAIL_LENGTH = 6;

function clamp01(t: number): number {
	return Math.min(1, Math.max(0, t));
}

const EASINGS: Record<ZoomTransitionEasing, (t: number) => number> = {
	linear: (t) => clamp01(t),
	glide: (t) => 1 - (1 - clamp01(t)) ** 2,
	smooth: (t) => {
		const c = clamp01(t);
		return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
	},
	snappy: (t) => 1 - (1 - clamp01(t)) ** 4,
	signature: (t) => {
		const c = clamp01(t);
		const c1 = 1.15;
		const c3 = c1 + 1;
		return 1 + c3 * (c - 1) ** 3 + c1 * (c - 1) ** 2;
	},
};

type BackgroundPresetKey = Exclude<BackgroundChoice, "none" | "custom" | "color" | "video">;

interface BackgroundPreset {
	style: "linear" | "radial";
	from: string;
	to: string;
}

/** A curated library of procedural gradient backgrounds (no bundled image assets required). */
export const BACKGROUND_PRESETS: Record<BackgroundPresetKey, BackgroundPreset> = {
	violet: { style: "linear", from: "#8a5f99", to: "#190f1d" },
	midnight: { style: "linear", from: "#1c2340", to: "#05060d" },
	sunset: { style: "linear", from: "#a1573f", to: "#2d1e33" },
	aurora: { style: "radial", from: "#2fd9c7", to: "#0b1a2b" },
	coral: { style: "linear", from: "#ff7a6b", to: "#3a1220" },
	forest: { style: "linear", from: "#2f6b4f", to: "#0c1710" },
	ocean: { style: "radial", from: "#2a7fb0", to: "#041018" },
	ember: { style: "linear", from: "#d9622b", to: "#1c0a05" },
	lavender: { style: "linear", from: "#9a8fd1", to: "#211c33" },
	steel: { style: "linear", from: "#5b6b7c", to: "#0e1216" },
	rose: { style: "radial", from: "#e46a9b", to: "#220d19" },
	citrus: { style: "linear", from: "#e0b23a", to: "#241a05" },
	mint: { style: "linear", from: "#4fd1a5", to: "#08211a" },
	plum: { style: "radial", from: "#8a4a7c", to: "#170b16" },
	slate: { style: "linear", from: "#3d4a5c", to: "#080a0d" },
	gold: { style: "linear", from: "#c99a3d", to: "#1a1206" },
	arctic: { style: "radial", from: "#bfe4f0", to: "#0a1c22" },
	berry: { style: "linear", from: "#a13a5e", to: "#1a0710" },
	indigo: { style: "linear", from: "#4b3f8a", to: "#0d0a1f" },
	teal: { style: "radial", from: "#2f9e8f", to: "#08211d" },
	crimson: { style: "radial", from: "#c23b4f", to: "#200910" },
	amber: { style: "linear", from: "#d98e2b", to: "#241705" },
	jade: { style: "radial", from: "#2e9e6b", to: "#06231a" },
	sapphire: { style: "linear", from: "#2a5aa0", to: "#050f1e" },
	copper: { style: "linear", from: "#b5652e", to: "#221007" },
	orchid: { style: "radial", from: "#9a4fae", to: "#1c0a20" },
	fern: { style: "linear", from: "#4f8a4e", to: "#0c1a0b" },
	dusk: { style: "linear", from: "#55507a", to: "#0a0912" },
	flame: { style: "radial", from: "#e0562b", to: "#230d05" },
	glacier: { style: "linear", from: "#7fc4d9", to: "#0a1a1e" },
};

type CoverSource = HTMLImageElement | HTMLVideoElement;

function coverSourceDimensions(source: CoverSource): { width: number; height: number } {
	if ("videoWidth" in source) return { width: source.videoWidth, height: source.videoHeight };
	return { width: source.naturalWidth, height: source.naturalHeight };
}

function drawBackground(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	background: BackgroundChoice,
	customImage?: HTMLImageElement | null,
	customColor?: string,
	backgroundVideo?: HTMLVideoElement | null,
) {
	if (background === "color") {
		ctx.fillStyle = customColor ?? "#0b070c";
		ctx.fillRect(0, 0, width, height);
		return;
	}

	if (background === "video" && backgroundVideo && backgroundVideo.videoWidth > 0) {
		drawCover(ctx, backgroundVideo, width, height);
		return;
	}

	if (background === "custom" && customImage && customImage.complete && customImage.naturalWidth > 0) {
		drawCover(ctx, customImage, width, height);
		return;
	}

	if (background === "none" || background === "custom" || background === "video") {
		ctx.fillStyle = "#0b070c";
		ctx.fillRect(0, 0, width, height);
		return;
	}

	const preset = BACKGROUND_PRESETS[background];
	const gradient =
		preset.style === "radial"
			? ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 1.4)
			: ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, preset.from);
	gradient.addColorStop(1, preset.to);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
}

function drawCover(ctx: CanvasRenderingContext2D, source: CoverSource, width: number, height: number) {
	const { width: sourceWidth, height: sourceHeight } = coverSourceDimensions(source);
	const sourceRatio = sourceWidth / sourceHeight;
	const targetRatio = width / height;
	let drawWidth = width;
	let drawHeight = height;
	if (sourceRatio > targetRatio) {
		drawHeight = height;
		drawWidth = height * sourceRatio;
	} else {
		drawWidth = width;
		drawHeight = width / sourceRatio;
	}
	ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function easeTowards(current: number, target: number, factor: number): number {
	return current + (target - current) * factor;
}

export class Compositor {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private config: CompositorConfig;
	private rafId: number | null = null;
	private zoom: ZoomState = { x: 0.5, y: 0.5, scale: 1 };
	private smoothedCursor: { x: number; y: number } | null = null;
	private previousSmoothedCursor: { x: number; y: number } | null = null;
	private cursorTrail: Array<{ x: number; y: number }> = [];
	private sourceFrameRect = { x: 0, y: 0, width: 0, height: 0 };
	private sourceCropRect = { x: 0, y: 0, width: 0, height: 0 };

	constructor(config: CompositorConfig) {
		this.config = config;
		this.canvas = document.createElement("canvas");
		this.canvas.width = config.outputWidth;
		this.canvas.height = config.outputHeight;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) throw new Error("2D canvas context unavailable");
		this.ctx = ctx;
	}

	start(): void {
		if (this.rafId !== null) return;
		const loop = () => {
			this.renderFrame();
			this.rafId = requestAnimationFrame(loop);
		};
		loop();
	}

	stop(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	/** Renders a single frame on demand, outside the rAF loop — used by the fast (decode-driven) export
	 * path, which pulls frames as fast as the hardware decoder produces them rather than on a timer. */
	renderOnce(): void {
		this.renderFrame();
	}

	captureStream(fps: number): MediaStream {
		return this.canvas.captureStream(fps);
	}

	get canvasElement(): HTMLCanvasElement {
		return this.canvas;
	}

	updateConfig(partial: Partial<CompositorConfig>): void {
		this.config = { ...this.config, ...partial };
	}

	mapCanvasPointToNormalized(x: number, y: number): { xNorm: number; yNorm: number } | null {
		const { sourceFrameRect } = this;
		if (sourceFrameRect.width === 0) return null;
		const xNorm = (x - sourceFrameRect.x) / sourceFrameRect.width;
		const yNorm = (y - sourceFrameRect.y) / sourceFrameRect.height;
		if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) return null;
		return { xNorm, yNorm };
	}

	/** Inverse of the annotation-drawing transform: normalized rect -> canvas-space rect. */
	mapNormalizedRectToCanvas(
		xNorm: number,
		yNorm: number,
		wNorm: number,
		hNorm: number,
	): { x: number; y: number; width: number; height: number } | null {
		const { sourceFrameRect } = this;
		if (sourceFrameRect.width === 0) return null;
		return {
			x: sourceFrameRect.x + xNorm * sourceFrameRect.width,
			y: sourceFrameRect.y + yNorm * sourceFrameRect.height,
			width: wNorm * sourceFrameRect.width,
			height: hNorm * sourceFrameRect.height,
		};
	}

	/**
	 * Region-mode zoom is deterministic (a pure function of `now`), not eased
	 * frame-to-frame — that's what makes it safe to re-render the same instant
	 * identically during scrubbing, live preview, and export. Each region eases
	 * in over its own durationInMs before its start and back out over
	 * durationOutMs after its end, using its own easing curves. Two regions
	 * separated by a gap no larger than DEFAULT_CONNECTED_ZOOM_GAP_MS are
	 * "connected": instead of easing back to 1x between them, focus/depth
	 * blend directly from one region into the next.
	 */
	private computeRegionZoom(now: number): ZoomState | null {
		const regions = this.config.zoomRegions;
		if (!regions || regions.length === 0) return null;

		const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);

		for (let i = 0; i < sorted.length; i += 1) {
			const region = sorted[i];
			const next = sorted[i + 1];
			const scale = ZOOM_DEPTH_SCALES[region.depth];

			if (next && now >= region.endMs && now <= next.startMs) {
				const gap = next.startMs - region.endMs;
				if (gap > 0 && gap <= DEFAULT_CONNECTED_ZOOM_GAP_MS) {
					const nextScale = ZOOM_DEPTH_SCALES[next.depth];
					const bridgeProgress = EASINGS[next.easingIn]((now - region.endMs) / gap);
					return {
						x: region.focusXNorm + (next.focusXNorm - region.focusXNorm) * bridgeProgress,
						y: region.focusYNorm + (next.focusYNorm - region.focusYNorm) * bridgeProgress,
						scale: scale + (nextScale - scale) * bridgeProgress,
					};
				}
			}

			const enterStart = region.startMs - region.durationInMs;
			const exitEnd = region.endMs + region.durationOutMs;
			if (now < enterStart || now > exitEnd) continue;

			let progress: number;
			if (now < region.startMs) {
				progress =
					region.durationInMs > 0 ? EASINGS[region.easingIn]((now - enterStart) / region.durationInMs) : 1;
			} else if (now > region.endMs) {
				progress =
					region.durationOutMs > 0
						? EASINGS[region.easingOut](1 - (now - region.endMs) / region.durationOutMs)
						: 0;
			} else {
				progress = 1;
			}

			return {
				x: 0.5 + (region.focusXNorm - 0.5) * progress,
				y: 0.5 + (region.focusYNorm - 0.5) * progress,
				scale: 1 + (scale - 1) * progress,
			};
		}

		return { x: 0.5, y: 0.5, scale: 1 };
	}

	private updateZoom(now: number): void {
		const regionZoom = this.computeRegionZoom(now);
		if (regionZoom) {
			this.zoom = regionZoom;
			return;
		}

		const cursor = this.config.autoZoomEnabled ? this.config.cursorRef?.current : null;
		const isActive = !!cursor && now - cursor.lastMoveAt < ZOOM_IDLE_MS;
		const target =
			isActive && cursor
				? { x: cursor.xNorm, y: cursor.yNorm, scale: ZOOM_TARGET_SCALE }
				: { x: 0.5, y: 0.5, scale: 1 };

		this.zoom = {
			x: easeTowards(this.zoom.x, target.x, ZOOM_EASE),
			y: easeTowards(this.zoom.y, target.y, ZOOM_EASE),
			scale: easeTowards(this.zoom.scale, target.scale, ZOOM_EASE),
		};
	}

	private drawSource(): void {
		const source = this.config.getSourceElement();
		const { ctx, canvas } = this;
		if (!source) return;
		const { width: sourceWidth, height: sourceHeight } = sourceDimensions(source);
		if (sourceWidth === 0) return;

		const { scale, x, y } = this.zoom;

		let srcWidth: number;
		let srcHeight: number;
		let srcX: number;
		let srcY: number;

		if (this.config.cropAspect === "custom") {
			const region = this.config.cropRegion ?? FULL_CROP_REGION;
			const regionX = region.xNorm * sourceWidth;
			const regionY = region.yNorm * sourceHeight;
			const regionWidth = region.wNorm * sourceWidth;
			const regionHeight = region.hNorm * sourceHeight;
			srcWidth = regionWidth / scale;
			srcHeight = regionHeight / scale;
			const focusX = regionX + regionWidth / 2 + (x - 0.5) * regionWidth;
			const focusY = regionY + regionHeight / 2 + (y - 0.5) * regionHeight;
			srcX = clamp(focusX - srcWidth / 2, regionX, regionX + regionWidth - srcWidth);
			srcY = clamp(focusY - srcHeight / 2, regionY, regionY + regionHeight - srcHeight);
		} else {
			const base = baseCropRect(sourceWidth, sourceHeight, this.config.cropAspect);
			srcWidth = base.width / scale;
			srcHeight = base.height / scale;
			srcX = clamp(x * sourceWidth - srcWidth / 2, 0, sourceWidth - srcWidth);
			srcY = clamp(y * sourceHeight - srcHeight / 2, 0, sourceHeight - srcHeight);
		}

		const radius = this.config.frameRadius;
		const hasBackdrop = this.config.background !== "none";
		const padding = this.config.framePadding ?? DEFAULT_FRAME_PADDING;
		const destX = hasBackdrop ? padding.left : 0;
		const destY = hasBackdrop ? padding.top : 0;
		const destWidth = hasBackdrop
			? Math.max(10, canvas.width - padding.left - padding.right)
			: canvas.width;
		const destHeight = hasBackdrop
			? Math.max(10, canvas.height - padding.top - padding.bottom)
			: canvas.height;

		ctx.save();
		if (this.config.frameShadowEnabled) {
			ctx.shadowColor = "rgba(0,0,0,0.45)";
			ctx.shadowBlur = 40;
			ctx.shadowOffsetY = 12;
		}
		roundedRectPath(ctx, destX, destY, destWidth, destHeight, radius);
		ctx.save();
		ctx.clip();
		ctx.shadowColor = "transparent";
		ctx.drawImage(source, srcX, srcY, srcWidth, srcHeight, destX, destY, destWidth, destHeight);
		ctx.restore();
		ctx.restore();

		this.sourceFrameRect = { x: destX, y: destY, width: destWidth, height: destHeight };
		this.sourceCropRect = { x: srcX, y: srcY, width: srcWidth, height: srcHeight };
	}

	private drawWebcam(): void {
		const webcam = this.config.getWebcamElement?.();
		if (!webcam || webcam.videoWidth === 0) return;

		const settings = this.config.webcamOverlay ?? DEFAULT_WEBCAM_OVERLAY;
		const { ctx, canvas } = this;
		const baseDimension = Math.min(canvas.width, canvas.height);
		const zoomBoost = settings.reactToZoom ? 1 + (clamp(this.zoom.scale, 1, 3) - 1) * 0.15 : 1;
		const width = baseDimension * settings.widthNorm * zoomBoost;
		const height = baseDimension * settings.heightNorm * zoomBoost;
		const margin = canvas.width * settings.marginNorm;

		let cx: number;
		let cy: number;
		switch (settings.position) {
			case "bottom-left":
				cx = margin + width / 2;
				cy = canvas.height - margin - height / 2;
				break;
			case "top-right":
				cx = canvas.width - margin - width / 2;
				cy = margin + height / 2;
				break;
			case "top-left":
				cx = margin + width / 2;
				cy = margin + height / 2;
				break;
			case "bottom-center":
				cx = canvas.width / 2;
				cy = canvas.height - margin - height / 2;
				break;
			case "top-center":
				cx = canvas.width / 2;
				cy = margin + height / 2;
				break;
			case "middle-left":
				cx = margin + width / 2;
				cy = canvas.height / 2;
				break;
			case "middle-center":
				cx = canvas.width / 2;
				cy = canvas.height / 2;
				break;
			case "middle-right":
				cx = canvas.width - margin - width / 2;
				cy = canvas.height / 2;
				break;
			case "custom":
				cx = settings.customXNorm * canvas.width;
				cy = settings.customYNorm * canvas.height;
				break;
			case "bottom-right":
			default:
				cx = canvas.width - margin - width / 2;
				cy = canvas.height - margin - height / 2;
				break;
		}

		const userCrop = settings.cropRegion ?? FULL_CROP_REGION;
		const userCropX = userCrop.xNorm * webcam.videoWidth;
		const userCropY = userCrop.yNorm * webcam.videoHeight;
		const userCropWidth = userCrop.wNorm * webcam.videoWidth;
		const userCropHeight = userCrop.hNorm * webcam.videoHeight;

		const targetAspect = width / height;
		const userCropAspect = userCropWidth / userCropHeight;
		let cropWidth: number;
		let cropHeight: number;
		if (userCropAspect > targetAspect) {
			cropHeight = userCropHeight;
			cropWidth = cropHeight * targetAspect;
		} else {
			cropWidth = userCropWidth;
			cropHeight = cropWidth / targetAspect;
		}
		const cropX = userCropX + (userCropWidth - cropWidth) / 2;
		const cropY = userCropY + (userCropHeight - cropHeight) / 2;

		const radius = (settings.roundness * Math.min(width, height)) / 2;
		const left = cx - width / 2;
		const top = cy - height / 2;

		ctx.save();
		if (settings.shadowEnabled) {
			ctx.shadowColor = `rgba(0,0,0,${settings.shadowOpacity})`;
			ctx.shadowBlur = 24;
		}
		roundedRectPath(ctx, left, top, width, height, radius);
		ctx.save();
		ctx.clip();
		ctx.shadowColor = "transparent";
		ctx.translate(cx, cy);
		ctx.scale(settings.mirror ? -1 : 1, 1);
		ctx.drawImage(webcam, cropX, cropY, cropWidth, cropHeight, -width / 2, -height / 2, width, height);
		ctx.restore();
		ctx.restore();

		ctx.save();
		roundedRectPath(ctx, left, top, width, height, radius);
		ctx.strokeStyle = "rgba(255,255,255,0.85)";
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.restore();
	}

	private mapNormalizedToCanvas(xNorm: number, yNorm: number): { x: number; y: number } | null {
		const { sourceCropRect, sourceFrameRect } = this;
		if (sourceCropRect.width === 0) return null;

		const source = this.config.getSourceElement();
		if (!source) return null;
		const { width: sourceWidth, height: sourceHeight } = sourceDimensions(source);

		const pxX = xNorm * sourceWidth;
		const pxY = yNorm * sourceHeight;
		const relX = (pxX - sourceCropRect.x) / sourceCropRect.width;
		const relY = (pxY - sourceCropRect.y) / sourceCropRect.height;
		if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

		return {
			x: sourceFrameRect.x + relX * sourceFrameRect.width,
			y: sourceFrameRect.y + relY * sourceFrameRect.height,
		};
	}

	private drawCursorOverlay(): void {
		const cursor = this.config.cursorRef?.current;
		if (!cursor) return;

		const point = this.mapNormalizedToCanvas(cursor.xNorm, cursor.yNorm);
		if (!point) {
			this.smoothedCursor = null;
			this.previousSmoothedCursor = null;
			this.cursorTrail = [];
			return;
		}

		const appearance = this.config.cursorAppearance ?? DEFAULT_CURSOR_APPEARANCE;
		const easeFactor = 1 - appearance.smoothing * 0.9;
		this.previousSmoothedCursor = this.smoothedCursor ? { ...this.smoothedCursor } : { ...point };
		this.smoothedCursor = this.smoothedCursor
			? {
					x: easeTowards(this.smoothedCursor.x, point.x, easeFactor),
					y: easeTowards(this.smoothedCursor.y, point.y, easeFactor),
				}
			: { ...point };

		if (appearance.sway > 0) {
			this.cursorTrail.push({ ...this.smoothedCursor });
			if (this.cursorTrail.length > CURSOR_TRAIL_LENGTH) this.cursorTrail.shift();
		} else {
			this.cursorTrail = [];
		}

		const { ctx } = this;
		const radius = appearance.size;

		this.cursorTrail.forEach((trailPoint, index) => {
			const progress = (index + 1) / this.cursorTrail.length;
			ctx.save();
			ctx.globalAlpha = progress * appearance.sway * 0.5;
			ctx.beginPath();
			ctx.arc(trailPoint.x, trailPoint.y, radius * 0.7, 0, Math.PI * 2);
			ctx.fillStyle = "#ffffff";
			ctx.fill();
			ctx.restore();
		});

		if (appearance.motionBlur > 0 && this.previousSmoothedCursor) {
			const dx = this.smoothedCursor.x - this.previousSmoothedCursor.x;
			const dy = this.smoothedCursor.y - this.previousSmoothedCursor.y;
			const speed = Math.hypot(dx, dy);
			const speedFactor = clamp01(speed / 24);
			if (speedFactor > 0.02) {
				const angle = Math.atan2(dy, dx);
				const smearLength = radius * 3 * speedFactor * appearance.motionBlur;
				const tailX = this.smoothedCursor.x - Math.cos(angle) * smearLength;
				const tailY = this.smoothedCursor.y - Math.sin(angle) * smearLength;
				ctx.save();
				const gradient = ctx.createLinearGradient(tailX, tailY, this.smoothedCursor.x, this.smoothedCursor.y);
				gradient.addColorStop(0, "rgba(255,255,255,0)");
				gradient.addColorStop(1, `rgba(255,255,255,${0.4 * appearance.motionBlur * speedFactor})`);
				ctx.strokeStyle = gradient;
				ctx.lineWidth = radius * 1.4;
				ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(tailX, tailY);
				ctx.lineTo(this.smoothedCursor.x, this.smoothedCursor.y);
				ctx.stroke();
				ctx.restore();
			}
		}

		const nowForBounce = this.config.getPlaybackTimeMs();
		const sinceClickForBounce = nowForBounce - cursor.lastClickAt;
		const bounceDuration = appearance.clickBounceDurationMs;
		const bounceProgress = bounceDuration > 0 ? sinceClickForBounce / bounceDuration : Number.POSITIVE_INFINITY;
		const bounceEnvelope =
			bounceProgress >= 0 && bounceProgress < 1 ? Math.sin(bounceProgress * Math.PI) : 0;
		const bounceScale = 1 + (appearance.clickBounce / 10) * bounceEnvelope;
		const displayRadius = radius * bounceScale;

		if (appearance.skin === "custom" && this.config.customCursorImage) {
			const image = this.config.customCursorImage;
			const size = displayRadius * 4.8;
			const aspect = image.naturalWidth / image.naturalHeight || 1;
			const drawHeight = size;
			const drawWidth = size * aspect;
			ctx.drawImage(image, this.smoothedCursor.x, this.smoothedCursor.y, drawWidth, drawHeight);
		} else if (appearance.skin === "dot" || appearance.skin === "custom") {
			ctx.save();
			ctx.beginPath();
			ctx.arc(this.smoothedCursor.x, this.smoothedCursor.y, displayRadius, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255,255,255,0.9)";
			ctx.fill();
			ctx.strokeStyle = "rgba(0,0,0,0.35)";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();
		} else {
			drawPointerArrow(ctx, this.smoothedCursor.x, this.smoothedCursor.y, displayRadius * 2.4, appearance.skin);
		}

		const now = this.config.getPlaybackTimeMs();
		const sinceClick = now - cursor.lastClickAt;
		this.drawClickEffect(this.smoothedCursor, radius, sinceClick, appearance);
	}

	private drawClickEffect(
		point: { x: number; y: number },
		cursorRadius: number,
		sinceClickMs: number,
		appearance: CursorAppearance,
	): void {
		const { clickEffectStyle: style, clickEffectDurationMs: durationMs } = appearance;
		if (style === "none" || sinceClickMs < 0 || sinceClickMs >= durationMs) return;

		const { ctx } = this;
		const color = appearance.clickEffectColor;
		const baseOpacity = appearance.clickEffectOpacity;
		const scale = appearance.clickEffectScale;

		if (style === "ripple") {
			const progress = sinceClickMs / durationMs;
			ctx.save();
			ctx.beginPath();
			ctx.arc(point.x, point.y, cursorRadius + 2 + progress * 26 * scale, 0, Math.PI * 2);
			ctx.strokeStyle = rgba(color, (1 - progress) * baseOpacity);
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.restore();
		} else if (style === "spotlight") {
			const progress = sinceClickMs / durationMs;
			const glowRadius = cursorRadius * 5 * scale;
			const fade = 1 - EASINGS.glide(progress);
			ctx.save();
			const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
			gradient.addColorStop(0, rgba(color, 0.55 * baseOpacity * fade));
			gradient.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		} else if (style === "echo") {
			const ringCount = 3;
			const ringSpacingMs = durationMs / ringCount;
			ctx.save();
			for (let ring = 0; ring < ringCount; ring += 1) {
				const ringElapsed = sinceClickMs - ring * ringSpacingMs;
				if (ringElapsed < 0 || ringElapsed >= durationMs) continue;
				const progress = ringElapsed / durationMs;
				ctx.beginPath();
				ctx.arc(point.x, point.y, cursorRadius + 2 + progress * 30 * scale, 0, Math.PI * 2);
				ctx.strokeStyle = rgba(color, (1 - progress) * baseOpacity);
				ctx.lineWidth = 2.5;
				ctx.stroke();
			}
			ctx.restore();
		}
	}

	private drawAnnotations(): void {
		const annotations = this.config.annotations;
		if (!annotations || annotations.length === 0) return;

		const now = this.config.getPlaybackTimeMs();
		const { ctx } = this;
		const { sourceFrameRect, sourceCropRect } = this;
		if (sourceFrameRect.width === 0) return;
		const source = this.config.getSourceElement();

		const ordered = [...annotations].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

		for (const annotation of ordered) {
			if (Math.abs(now - annotation.timestampMs) > 1500) continue;

			const x = sourceFrameRect.x + annotation.xNorm * sourceFrameRect.width;
			const y = sourceFrameRect.y + annotation.yNorm * sourceFrameRect.height;
			const w = annotation.wNorm * sourceFrameRect.width;
			const h = annotation.hNorm * sourceFrameRect.height;

			ctx.save();

			if (annotation.type === "highlight") {
				ctx.globalAlpha = 0.32;
				ctx.fillStyle = annotation.color;
				ctx.fillRect(x, y, w, h);
			} else if (annotation.type === "blur" && source) {
				const srcX = sourceCropRect.x + annotation.xNorm * sourceCropRect.width;
				const srcY = sourceCropRect.y + annotation.yNorm * sourceCropRect.height;
				const srcW = annotation.wNorm * sourceCropRect.width;
				const srcH = annotation.hNorm * sourceCropRect.height;
				ctx.beginPath();
				ctx.rect(x, y, w, h);
				ctx.clip();
				ctx.filter = "blur(14px)";
				ctx.drawImage(source, srcX, srcY, srcW, srcH, x - 10, y - 10, w + 20, h + 20);
			} else if (annotation.type === "image") {
				const image = annotation.imagePath ? this.config.getAnnotationImage?.(annotation.imagePath) : null;
				if (image) ctx.drawImage(image, x, y, w, h);
			} else if (annotation.type === "figure") {
				drawFigureArrow(ctx, x, y, w, h, annotation.color, annotation.figureDirection ?? "e");
			} else if (annotation.type === "text") {
				const fontFamily = this.config.textAnnotationFontFamily || "sans-serif";
				const fontSizePx = Math.max(12, h);
				const weight = annotation.fontWeight === "bold" ? "700" : "600";
				const style = annotation.fontStyle === "italic" ? "italic " : "";
				ctx.font = `${style}${weight} ${fontSizePx}px "${fontFamily}"`;
				ctx.textBaseline = "top";
				const text = annotation.text ?? "";
				const align = annotation.textAlign ?? "left";
				ctx.textAlign = align;
				const textX = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
				const textWidth = ctx.measureText(text).width;
				const boxX = align === "center" ? textX - textWidth / 2 : align === "right" ? textX - textWidth : textX;

				if (annotation.backgroundColor) {
					const padding = fontSizePx * 0.15;
					ctx.fillStyle = annotation.backgroundColor;
					roundedRectPath(
						ctx,
						boxX - padding,
						y - padding,
						textWidth + padding * 2,
						fontSizePx + padding * 2,
						annotation.borderRadius ?? 4,
					);
					ctx.fill();
				}

				ctx.fillStyle = annotation.color;
				ctx.fillText(text, textX, y);

				if (annotation.textDecoration === "underline") {
					const underlineY = y + fontSizePx * 0.95;
					ctx.strokeStyle = annotation.color;
					ctx.lineWidth = Math.max(1, fontSizePx * 0.06);
					ctx.beginPath();
					ctx.moveTo(boxX, underlineY);
					ctx.lineTo(boxX + textWidth, underlineY);
					ctx.stroke();
				}
			} else {
				ctx.strokeStyle = annotation.color;
				ctx.fillStyle = annotation.color;
				ctx.lineWidth = 4;
				if (annotation.type === "rect") {
					ctx.strokeRect(x, y, w, h);
				} else {
					drawArrow(ctx, x, y, x + w, y + h);
				}
			}

			ctx.restore();
		}
	}

	/** Greedily wraps words (keeping each word's own timing) into lines no wider than maxWidth,
	 * mirroring wrapText()'s line-breaking but preserving per-word identity for karaoke coloring. */
	private wrapCaptionWords(words: CaptionCueWord[], maxWidth: number): CaptionCueWord[][] {
		const { ctx } = this;
		const lines: CaptionCueWord[][] = [];
		let currentLine: CaptionCueWord[] = [];

		for (const word of words) {
			const candidate = [...currentLine, word].map((w) => w.text).join(" ");
			if (currentLine.length > 0 && ctx.measureText(candidate).width > maxWidth) {
				lines.push(currentLine);
				currentLine = [word];
			} else {
				currentLine.push(word);
			}
		}
		if (currentLine.length > 0) lines.push(currentLine);
		return lines;
	}

	private drawCaptions(): void {
		const captions = this.config.captions;
		if (!captions || captions.length === 0) return;

		const now = this.config.getPlaybackTimeMs();
		const active = captions.find((cue) => now >= cue.startMs && now <= cue.endMs);
		if (!active || active.text.trim().length === 0) return;

		const { ctx } = this;
		const { sourceFrameRect } = this;
		if (sourceFrameRect.width === 0) return;

		const settings = this.config.captionSettings ?? DEFAULT_AUTO_CAPTION_SETTINGS;
		const fontSize = settings.fontSizePx > 0 ? settings.fontSizePx : Math.max(14, sourceFrameRect.height * 0.045);
		const fontFamily = settings.fontFamily === "default" ? "sans-serif" : settings.fontFamily;

		ctx.save();
		ctx.font = `600 ${fontSize}px "${fontFamily}"`;
		ctx.textAlign = "center";
		ctx.textBaseline = "alphabetic";

		const maxWidth = sourceFrameRect.width * settings.maxWidthNorm;
		const lineHeight = fontSize * 1.35;
		const paddingX = fontSize * 0.6;
		const paddingY = fontSize * 0.35;
		const centerX = sourceFrameRect.x + sourceFrameRect.width / 2;
		const rows = Math.max(1, settings.maxRows);

		const isKaraoke = settings.animationStyle === "karaoke" && !!active.words && active.words.length > 0;

		let displayText = active.text;
		if (settings.animationStyle === "typewriter") {
			const revealMs = Math.min(1000, active.endMs - active.startMs);
			const revealFraction = clamp01((now - active.startMs) / Math.max(1, revealMs));
			displayText = active.text.slice(0, Math.round(active.text.length * revealFraction));
		}

		let wordLines: CaptionCueWord[][] | null = null;
		let textLines: string[];
		if (isKaraoke) {
			wordLines = this.wrapCaptionWords(active.words!, maxWidth).slice(0, rows);
			textLines = wordLines.map((line) => line.map((word) => word.text).join(" "));
		} else {
			textLines = wrapText(ctx, displayText, maxWidth).slice(0, rows);
		}
		if (textLines.length === 0) {
			ctx.restore();
			return;
		}

		const blockHeight = textLines.length * lineHeight + paddingY * 2;
		let anchorY: number;
		if (settings.position === "top") {
			anchorY = sourceFrameRect.y + sourceFrameRect.height * settings.positionOffsetNorm;
		} else if (settings.position === "center") {
			anchorY = sourceFrameRect.y + sourceFrameRect.height / 2 - blockHeight / 2;
		} else {
			anchorY = sourceFrameRect.y + sourceFrameRect.height * (1 - settings.positionOffsetNorm) - blockHeight;
		}
		const widestLine = Math.max(...textLines.map((line) => ctx.measureText(line).width));
		const boxWidth = Math.min(maxWidth, widestLine) + paddingX * 2;

		const fadeMs = 150;
		const fadeOpacity = clamp01(Math.min(now - active.startMs, active.endMs - now) / fadeMs);
		let scale = 1;
		let translateY = 0;
		if (settings.animationStyle === "pop") {
			const t = clamp01((now - active.startMs) / 150);
			scale = 0.85 + 0.15 * EASINGS.glide(t);
		} else if (settings.animationStyle === "slide-up") {
			const t = clamp01((now - active.startMs) / 200);
			translateY = (1 - EASINGS.glide(t)) * lineHeight;
		}

		const boxCenterX = centerX;
		const boxCenterY = anchorY + blockHeight / 2;
		ctx.globalAlpha = fadeOpacity;
		ctx.translate(boxCenterX, boxCenterY + translateY);
		ctx.scale(scale, scale);
		ctx.translate(-boxCenterX, -boxCenterY);

		ctx.fillStyle = rgba(settings.backgroundColor, settings.backgroundOpacity);
		roundedRectPath(ctx, centerX - boxWidth / 2, anchorY, boxWidth, blockHeight, settings.boxRadius);
		ctx.fill();

		if (isKaraoke && wordLines) {
			wordLines.forEach((line, lineIndex) => {
				const y = anchorY + paddingY + lineHeight * (lineIndex + 1) - lineHeight * 0.3;
				const lineText = line.map((word) => word.text).join(" ");
				const lineWidth = ctx.measureText(lineText).width;
				let cursorX = centerX - lineWidth / 2;
				const savedAlign = ctx.textAlign;
				ctx.textAlign = "left";
				line.forEach((word, wordIndex) => {
					const spoken = now >= word.endMs;
					const current = !spoken && now >= word.startMs;
					ctx.fillStyle = current ? "#FFD34D" : spoken ? settings.textColor : "rgba(255,255,255,0.4)";
					const wordText = wordIndex < line.length - 1 ? `${word.text} ` : word.text;
					ctx.fillText(wordText, cursorX, y);
					cursorX += ctx.measureText(wordText).width;
				});
				ctx.textAlign = savedAlign;
			});
		} else {
			ctx.fillStyle = settings.textColor;
			textLines.forEach((line, index) => {
				const y = anchorY + paddingY + lineHeight * (index + 1) - lineHeight * 0.3;
				ctx.fillText(line, centerX, y);
			});
		}

		ctx.restore();
	}

	private renderFrame(): void {
		const { ctx, canvas, config } = this;
		const now = config.getPlaybackTimeMs();

		ctx.save();
		if (config.backgroundBlur) ctx.filter = `blur(${config.backgroundBlur}px)`;
		drawBackground(
			ctx,
			canvas.width,
			canvas.height,
			config.background,
			config.customBackgroundImage,
			config.customBackgroundColor,
			config.getBackgroundVideoElement?.(),
		);
		ctx.restore();

		this.updateZoom(now);

		this.drawSource();
		this.drawWebcam();
		this.drawCursorOverlay();
		this.drawAnnotations();
		this.drawCaptions();
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let currentLine = "";
	for (const word of words) {
		const candidate = currentLine ? `${currentLine} ${word}` : word;
		if (currentLine && ctx.measureText(candidate).width > maxWidth) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = candidate;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines.length > 0 ? lines : [""];
}

function roundedRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void {
	const r = Math.min(radius, width / 2, height / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + width, y, x + width, y + height, r);
	ctx.arcTo(x + width, y + height, x, y + height, r);
	ctx.arcTo(x, y + height, x, y, r);
	ctx.arcTo(x, y, x + width, y, r);
	ctx.closePath();
}

const FIGURE_DIRECTION_ANGLES_DEG: Record<FigureDirection, number> = {
	e: 0,
	se: 45,
	s: 90,
	sw: 135,
	w: 180,
	nw: 225,
	n: 270,
	ne: 315,
};

/** A filled block-arrow "callout" icon (distinct from the freehand line+arrowhead type), rotatable to 8 compass directions. */
function drawFigureArrow(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	color: string,
	direction: FigureDirection,
): void {
	const cx = x + w / 2;
	const cy = y + h / 2;
	const size = Math.min(w, h);
	const half = size / 2;
	const angle = (FIGURE_DIRECTION_ANGLES_DEG[direction] * Math.PI) / 180;

	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(angle);
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(-half, -half * 0.35);
	ctx.lineTo(half * 0.25, -half * 0.35);
	ctx.lineTo(half * 0.25, -half * 0.7);
	ctx.lineTo(half, 0);
	ctx.lineTo(half * 0.25, half * 0.7);
	ctx.lineTo(half * 0.25, half * 0.35);
	ctx.lineTo(-half, half * 0.35);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number): void {
	const headLength = 16;
	const angle = Math.atan2(toY - fromY, toX - fromX);

	ctx.beginPath();
	ctx.moveTo(fromX, fromY);
	ctx.lineTo(toX, toY);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(toX, toY);
	ctx.lineTo(
		toX - headLength * Math.cos(angle - Math.PI / 6),
		toY - headLength * Math.sin(angle - Math.PI / 6),
	);
	ctx.lineTo(
		toX - headLength * Math.cos(angle + Math.PI / 6),
		toY - headLength * Math.sin(angle + Math.PI / 6),
	);
	ctx.closePath();
	ctx.fill();
}
