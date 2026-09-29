import type { BackgroundChoice } from "../../electron/project/projectTypes";
import { FULL_CROP_REGION } from "../../electron/project/projectTypes";
import type { CropAspect, CropRegion, CursorAppearance, WebcamOverlaySettings } from "@/lib/compositor";
import { DEFAULT_CURSOR_APPEARANCE, DEFAULT_WEBCAM_OVERLAY } from "@/lib/compositor";

const MIC_ENABLED_KEY = "recly.settings.micEnabled";
const SAVE_DIRECTORY_KEY = "recly.settings.saveDirectory";
const RECORDER_SETTINGS_KEY = "recly.settings.recorder";
const WHISPER_MODEL_SIZE_KEY = "recly.settings.whisperModelSize";

export interface RecorderSettings {
	background: BackgroundChoice;
	customBackgroundPath: string | null;
	customBackgroundColor: string;
	customBackgroundVideoPath: string | null;
	backgroundBlur: number;
	cropAspect: CropAspect;
	cropRegion: CropRegion;
	webcamEnabled: boolean;
	webcamOverlay: WebcamOverlaySettings;
	systemAudioEnabled: boolean;
	autoZoomEnabled: boolean;
	cursorAppearance: CursorAppearance;
	nativeCaptureEnabled: boolean;
}

const DEFAULT_RECORDER_SETTINGS: RecorderSettings = {
	background: "none",
	customBackgroundPath: null,
	customBackgroundColor: "#2A2035",
	customBackgroundVideoPath: null,
	backgroundBlur: 0,
	cropAspect: "full",
	cropRegion: { ...FULL_CROP_REGION },
	webcamEnabled: false,
	webcamOverlay: { ...DEFAULT_WEBCAM_OVERLAY },
	systemAudioEnabled: false,
	autoZoomEnabled: true,
	cursorAppearance: DEFAULT_CURSOR_APPEARANCE,
	nativeCaptureEnabled: false,
};

export function loadMicEnabled(): boolean {
	return localStorage.getItem(MIC_ENABLED_KEY) !== "false";
}

export function saveMicEnabled(enabled: boolean): void {
	localStorage.setItem(MIC_ENABLED_KEY, String(enabled));
}

export function loadSavedDirectory(): string | null {
	return localStorage.getItem(SAVE_DIRECTORY_KEY);
}

export function saveDirectoryPreference(directory: string): void {
	localStorage.setItem(SAVE_DIRECTORY_KEY, directory);
}

export function loadRecorderSettings(): RecorderSettings {
	try {
		const stored = localStorage.getItem(RECORDER_SETTINGS_KEY);
		if (!stored) return DEFAULT_RECORDER_SETTINGS;
		const parsed = JSON.parse(stored) as Partial<RecorderSettings>;
		return {
			...DEFAULT_RECORDER_SETTINGS,
			...parsed,
			cursorAppearance: { ...DEFAULT_CURSOR_APPEARANCE, ...parsed.cursorAppearance },
			cropRegion: { ...FULL_CROP_REGION, ...parsed.cropRegion },
			webcamOverlay: { ...DEFAULT_WEBCAM_OVERLAY, ...parsed.webcamOverlay },
		};
	} catch {
		return DEFAULT_RECORDER_SETTINGS;
	}
}

export function saveRecorderSettings(settings: RecorderSettings): void {
	localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadWhisperModelSize(): "tiny" | "base" | "small" {
	const stored = localStorage.getItem(WHISPER_MODEL_SIZE_KEY);
	return stored === "tiny" || stored === "base" || stored === "small" ? stored : "base";
}

export function saveWhisperModelSize(size: "tiny" | "base" | "small"): void {
	localStorage.setItem(WHISPER_MODEL_SIZE_KEY, size);
}
