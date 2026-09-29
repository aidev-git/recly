import { contextBridge, ipcRenderer } from "electron";
import type { TranscriptionProgress, WhisperModelSize } from "./captions/transcribe";
import type { CaptureSource } from "./capture/sources";
import type { CursorSample } from "./cursor/cursorTracker";
import type { ExportAudioRegionInput, ExportOptions, ExportResult } from "./export/exportMedia";
import type { ProjectLibraryEntry } from "./project/projectLibrary";
import type { CaptionCue, CursorSampleRecord, ReclyProject } from "./project/projectTypes";
import type { DisplayInfo } from "./screenInfo";
import type { ShortcutsConfig } from "./shortcuts";
import type { UpdateStatusSummary, UpdateToastPayload } from "./updater";

export interface ReclyBridge {
	getSources: () => Promise<CaptureSource[]>;
	getDisplayInfo: () => Promise<DisplayInfo>;
	getDefaultSaveDirectory: () => Promise<string>;
	chooseSaveDirectory: () => Promise<string | null>;
	chooseBackgroundImage: () => Promise<string | null>;
	chooseBackgroundVideo: () => Promise<string | null>;
	chooseFontFile: () => Promise<string | null>;
	chooseAnnotationImage: () => Promise<string | null>;
	chooseAudioFile: () => Promise<string | null>;

	beginCountdown: () => Promise<void>;
	countdownComplete: () => Promise<void>;
	onBeginCapture: (callback: () => void) => () => void;

	isNativeCaptureAvailable: () => Promise<boolean>;
	startNativeCapture: (options: {
		directory: string;
		fileName: string;
		monitorIndex: number;
		fps: number;
		bitrate: number;
	}) => Promise<void>;
	stopNativeCapture: () => Promise<{ filePath: string; fileSizeBytes: number }>;
	saveMicSidecar: (videoPath: string, data: ArrayBuffer) => Promise<string>;
	checkMicSidecar: (videoPath: string) => Promise<string | null>;

	hudCommand: (command: "pause" | "resume" | "stop") => Promise<void>;
	onHudCommand: (callback: (command: "pause" | "resume" | "stop") => void) => () => void;
	recordingFinished: () => Promise<void>;

	hudOverlayDrag: (payload: { phase: "start" | "move" | "end"; screenX: number; screenY: number }) => void;
	setHudOverlayMousePassthrough: (ignore: boolean) => void;
	getHudOverlayCaptureProtection: () => Promise<boolean>;
	setHudOverlayCaptureProtection: (enabled: boolean) => Promise<void>;
	getHudOverlayMousePassthroughSupported: () => Promise<boolean>;

	startCursorTracking: () => Promise<void>;
	stopCursorTracking: () => Promise<void>;
	onCursorSample: (callback: (sample: CursorSample) => void) => () => void;
	saveCursorTelemetry: (videoPath: string, samples: CursorSampleRecord[]) => Promise<string | null>;
	loadCursorTelemetry: (videoPath: string) => Promise<CursorSampleRecord[]>;

	saveRecording: (payload: {
		data: ArrayBuffer;
		directory: string;
		fileName: string;
	}) => Promise<{ filePath: string }>;
	exportMedia: (payload: {
		data: ArrayBuffer;
		directory: string;
		fileName: string;
		options: ExportOptions;
	}) => Promise<ExportResult>;
	exportPrecodedMp4: (payload: {
		videoData: ArrayBuffer;
		audioData: ArrayBuffer | null;
		audioDataFormat?: "webm" | "wav";
		audioRegions: ExportAudioRegionInput[];
		directory: string;
		fileName: string;
	}) => Promise<ExportResult>;
	revealInFolder: (filePath: string) => Promise<void>;
	writeSubtitleSidecar: (videoFilePath: string, contents: string) => Promise<string>;

	openEditor: (videoPath: string) => Promise<void>;
	onEditorOpenVideo: (callback: (videoPath: string) => void) => () => void;
	onEditorOpenProject: (callback: (payload: { path: string; project: ReclyProject }) => void) => () => void;

	saveProject: (project: ReclyProject) => Promise<string | null>;
	openProject: () => Promise<{ path: string; project: ReclyProject } | null>;
	listProjectLibrary: () => Promise<ProjectLibraryEntry[]>;
	openProjectAt: (filePath: string) => Promise<{ path: string; project: ReclyProject } | null>;
	removeProjectFromLibrary: (filePath: string) => Promise<void>;

	transcribeCaptions: (videoPath: string, modelSize: WhisperModelSize, language: string) => Promise<CaptionCue[]>;
	onCaptionProgress: (callback: (progress: TranscriptionProgress) => void) => () => void;

	onMenuSaveProject: (callback: () => void) => () => void;
	onMenuOpenProject: (callback: () => void) => () => void;
	setHasUnsavedChanges: (value: boolean) => void;
	onRequestSaveBeforeClose: (callback: () => void) => () => void;
	saveBeforeCloseDone: (saved: boolean) => void;

	getPlatform: () => Promise<NodeJS.Platform>;
	getAppVersion: () => Promise<string>;
	getAnnouncements: () => Promise<unknown[]>;
	openExternalUrl: (url: string) => Promise<void>;
	getAccessibilityPermissionStatus: () => Promise<{ trusted: boolean }>;
	requestAccessibilityPermissionStatus: () => Promise<{ trusted: boolean }>;
	getScreenRecordingPermissionStatus: () => Promise<{
		status: "granted" | "denied" | "not-determined" | "restricted" | "unknown";
	}>;
	openScreenRecordingPreferences: () => Promise<void>;
	openAccessibilityPreferences: () => Promise<void>;

	checkForAppUpdates: () => Promise<void>;
	downloadAvailableUpdate: () => Promise<void>;
	installDownloadedUpdate: () => Promise<void>;
	dismissUpdateToast: () => Promise<void>;
	getUpdateStatusSummary: () => Promise<UpdateStatusSummary>;
	getCurrentUpdateToastPayload: () => Promise<UpdateToastPayload | null>;
	previewUpdateToast: () => Promise<void>;
	onUpdateToastState: (callback: (toast: UpdateToastPayload | null) => void) => () => void;

	openSettings: () => Promise<void>;
	getShortcuts: () => Promise<ShortcutsConfig>;
	setShortcuts: (config: ShortcutsConfig) => Promise<void>;
	onGlobalShortcut: (
		callback: (action: "toggle-recording" | "pause-resume-recording") => void,
	) => () => void;
}

function onEvent<T>(channel: string, callback: (value: T) => void): () => void {
	const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
	ipcRenderer.on(channel, listener);
	return () => ipcRenderer.removeListener(channel, listener);
}

const bridge: ReclyBridge = {
	getSources: () => ipcRenderer.invoke("recly:get-sources"),
	getDisplayInfo: () => ipcRenderer.invoke("recly:get-display-info"),
	getDefaultSaveDirectory: () => ipcRenderer.invoke("recly:get-default-save-directory"),
	chooseSaveDirectory: () => ipcRenderer.invoke("recly:choose-save-directory"),
	chooseBackgroundImage: () => ipcRenderer.invoke("recly:choose-background-image"),
	chooseBackgroundVideo: () => ipcRenderer.invoke("recly:choose-background-video"),
	chooseFontFile: () => ipcRenderer.invoke("recly:choose-font-file"),
	chooseAnnotationImage: () => ipcRenderer.invoke("recly:choose-annotation-image"),
	chooseAudioFile: () => ipcRenderer.invoke("recly:choose-audio-file"),

	beginCountdown: () => ipcRenderer.invoke("recly:begin-countdown"),
	countdownComplete: () => ipcRenderer.invoke("recly:countdown-complete"),
	onBeginCapture: (callback) => onEvent("recly:begin-capture", callback),

	isNativeCaptureAvailable: () => ipcRenderer.invoke("recly:native-capture-available"),
	startNativeCapture: (options) => ipcRenderer.invoke("recly:native-capture-start", options),
	stopNativeCapture: () => ipcRenderer.invoke("recly:native-capture-stop"),
	saveMicSidecar: (videoPath, data) =>
		ipcRenderer.invoke("recly:save-mic-sidecar", { videoPath, data }),
	checkMicSidecar: (videoPath) => ipcRenderer.invoke("recly:check-mic-sidecar", videoPath),

	hudCommand: (command) => ipcRenderer.invoke("recly:hud-command", command),
	onHudCommand: (callback) => onEvent("recly:hud-command", callback),
	recordingFinished: () => ipcRenderer.invoke("recly:recording-finished"),

	hudOverlayDrag: (payload) => ipcRenderer.send("recly:hud-overlay-drag", payload),
	setHudOverlayMousePassthrough: (ignore) => ipcRenderer.send("recly:hud-overlay-set-ignore-mouse", ignore),
	getHudOverlayCaptureProtection: () => ipcRenderer.invoke("recly:get-hud-overlay-capture-protection"),
	setHudOverlayCaptureProtection: (enabled) =>
		ipcRenderer.invoke("recly:set-hud-overlay-capture-protection", enabled),
	getHudOverlayMousePassthroughSupported: () =>
		ipcRenderer.invoke("recly:get-hud-overlay-mouse-passthrough-supported"),

	startCursorTracking: () => ipcRenderer.invoke("recly:start-cursor-tracking"),
	stopCursorTracking: () => ipcRenderer.invoke("recly:stop-cursor-tracking"),
	onCursorSample: (callback) => onEvent("recly:cursor-sample", callback),
	saveCursorTelemetry: (videoPath, samples) =>
		ipcRenderer.invoke("recly:save-cursor-telemetry", { videoPath, samples }),
	loadCursorTelemetry: (videoPath) => ipcRenderer.invoke("recly:load-cursor-telemetry", videoPath),

	saveRecording: (payload) => ipcRenderer.invoke("recly:save-recording", payload),
	exportMedia: (payload) => ipcRenderer.invoke("recly:export-media", payload),
	exportPrecodedMp4: (payload) => ipcRenderer.invoke("recly:export-precoded-mp4", payload),
	revealInFolder: (filePath) => ipcRenderer.invoke("recly:reveal-in-folder", filePath),
	writeSubtitleSidecar: (videoFilePath, contents) =>
		ipcRenderer.invoke("recly:write-subtitle-sidecar", { videoFilePath, contents }),

	openEditor: (videoPath) => ipcRenderer.invoke("recly:open-editor", videoPath),
	onEditorOpenVideo: (callback) => onEvent("recly:editor-open-video", callback),
	onEditorOpenProject: (callback) => onEvent("recly:editor-open-project", callback),

	saveProject: (project) => ipcRenderer.invoke("recly:save-project", project),
	openProject: () => ipcRenderer.invoke("recly:open-project"),
	listProjectLibrary: () => ipcRenderer.invoke("recly:list-project-library"),
	openProjectAt: (filePath) => ipcRenderer.invoke("recly:open-project-at", filePath),
	removeProjectFromLibrary: (filePath) => ipcRenderer.invoke("recly:remove-project-from-library", filePath),

	transcribeCaptions: (videoPath, modelSize, language) =>
		ipcRenderer.invoke("recly:transcribe-captions", { videoPath, modelSize, language }),
	onCaptionProgress: (callback) => onEvent("recly:caption-progress", callback),

	onMenuSaveProject: (callback) => onEvent("recly:menu-save-project", callback),
	onMenuOpenProject: (callback) => onEvent("recly:menu-open-project", callback),
	setHasUnsavedChanges: (value) => ipcRenderer.send("recly:set-has-unsaved-changes", value),
	onRequestSaveBeforeClose: (callback) => onEvent("recly:request-save-before-close", callback),
	saveBeforeCloseDone: (saved) => ipcRenderer.send("recly:save-before-close-done", saved),

	getPlatform: () => ipcRenderer.invoke("recly:get-platform"),
	getAppVersion: () => ipcRenderer.invoke("recly:get-app-version"),
	getAnnouncements: () => ipcRenderer.invoke("recly:get-announcements"),
	openExternalUrl: (url) => ipcRenderer.invoke("recly:open-external-url", url),
	getAccessibilityPermissionStatus: () => ipcRenderer.invoke("recly:get-accessibility-permission-status"),
	requestAccessibilityPermissionStatus: () =>
		ipcRenderer.invoke("recly:request-accessibility-permission-status"),
	getScreenRecordingPermissionStatus: () => ipcRenderer.invoke("recly:get-screen-recording-permission-status"),
	openScreenRecordingPreferences: () => ipcRenderer.invoke("recly:open-screen-recording-preferences"),
	openAccessibilityPreferences: () => ipcRenderer.invoke("recly:open-accessibility-preferences"),

	checkForAppUpdates: () => ipcRenderer.invoke("recly:check-for-app-updates"),
	downloadAvailableUpdate: () => ipcRenderer.invoke("recly:download-available-update"),
	installDownloadedUpdate: () => ipcRenderer.invoke("recly:install-downloaded-update"),
	dismissUpdateToast: () => ipcRenderer.invoke("recly:dismiss-update-toast"),
	getUpdateStatusSummary: () => ipcRenderer.invoke("recly:get-update-status-summary"),
	getCurrentUpdateToastPayload: () => ipcRenderer.invoke("recly:get-current-update-toast-payload"),
	previewUpdateToast: () => ipcRenderer.invoke("recly:preview-update-toast"),
	onUpdateToastState: (callback) => onEvent("recly:update-toast-state", callback),

	openSettings: () => ipcRenderer.invoke("recly:open-settings"),
	getShortcuts: () => ipcRenderer.invoke("recly:get-shortcuts"),
	setShortcuts: (config) => ipcRenderer.invoke("recly:set-shortcuts", config),
	onGlobalShortcut: (callback) => onEvent("recly:global-shortcut", callback),
};

contextBridge.exposeInMainWorld("recly", bridge);
