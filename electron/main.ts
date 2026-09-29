import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell } from "electron";
import { buildAppMenu } from "./menu";
import {
	isNativeCaptureAvailable,
	type NativeCaptureOptions,
	startNativeCapture,
	stopNativeCapture,
} from "./capture/nativeCapture";
import { listCaptureSources } from "./capture/sources";
import { transcribeVideo, type WhisperModelSize } from "./captions/transcribe";
import { cursorTelemetryPathFor, loadCursorTelemetry, saveCursorTelemetry } from "./project/cursorTelemetryFile";
import { subscribeCursorTracking } from "./cursor/cursorTracker";
import {
	exportMediaFile,
	exportPrecodedMp4,
	type ExportAudioRegionInput,
	type ExportOptions,
} from "./export/exportMedia";
import { getRemoteAnnouncements } from "./announcements";
import {
	checkForUpdates,
	dismissUpdateToast,
	downloadAvailableUpdate,
	getCurrentUpdateToastPayload,
	getUpdateStatusSummary,
	initAutoUpdater,
	installDownloadedUpdate,
	previewUpdateToast,
} from "./updater";
import { checkMicSidecar, saveMicSidecar } from "./project/micSidecarFile";
import {
	getAccessibilityPermissionStatus,
	getScreenRecordingPermissionStatus,
	openAccessibilityPreferences,
	openScreenRecordingPreferences,
	requestAccessibilityPermissionStatus,
} from "./permissions";
import { openProjectFile, saveProjectFile } from "./project/projectFile";
import {
	listProjectLibrary,
	registerProjectInLibrary,
	removeProjectFromLibrary,
} from "./project/projectLibrary";
import type { CursorSampleRecord, ReclyProject } from "./project/projectTypes";
import { getPrimaryDisplayInfo } from "./screenInfo";
import {
	DEFAULT_SHORTCUTS,
	loadShortcutsConfig,
	registerShortcuts,
	saveShortcutsConfig,
	type ShortcutsConfig,
} from "./shortcuts";
import { createTray } from "./tray";
import { createAppWindow } from "./windows/createChildWindow";
import { createCountdownWindow } from "./windows/countdownWindow";
import { createEditorWindow } from "./windows/editorWindow";
import { createHudWindow, supportsHudCaptureProtection } from "./windows/hudWindow";
import { createSettingsWindow } from "./windows/settingsWindow";

const dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let hudWindow: BrowserWindow | null = null;
let countdownWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let activeEditorWindow: BrowserWindow | null = null;
let hudCaptureProtectionEnabled = true;
let cursorUnsubscribe: (() => void) | null = null;
let shortcutsConfig: ShortcutsConfig = DEFAULT_SHORTCUTS;

function getDefaultRecordingsDirectory(): string {
	return path.join(app.getPath("videos"), "Recly");
}

function createMainWindow() {
	mainWindow = createAppWindow("main", {
		width: 480,
		height: 700,
		minWidth: 400,
		minHeight: 600,
		title: "Recly",
		backgroundColor: "#190f1d",
		icon: nativeImage.createFromPath(path.join(dirname, "..", "public", "icon", "256.png")),
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// --- Capture sources & screen info -----------------------------------------

ipcMain.handle("recly:get-sources", async () => listCaptureSources());
ipcMain.handle("recly:get-display-info", async () => getPrimaryDisplayInfo());
ipcMain.handle("recly:get-default-save-directory", async () => getDefaultRecordingsDirectory());

ipcMain.handle("recly:choose-save-directory", async () => {
	if (!mainWindow) return null;
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openDirectory", "createDirectory"],
		defaultPath: getDefaultRecordingsDirectory(),
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("recly:choose-background-image", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		properties: ["openFile"],
		filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("recly:choose-background-video", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		properties: ["openFile"],
		filters: [{ name: "Videos", extensions: ["mp4", "webm", "mov"] }],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("recly:choose-audio-file", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		properties: ["openFile"],
		filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac"] }],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("recly:choose-annotation-image", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		properties: ["openFile"],
		filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("recly:choose-font-file", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		properties: ["openFile"],
		filters: [{ name: "Fonts", extensions: ["ttf", "otf", "woff", "woff2"] }],
	});
	return result.canceled ? null : result.filePaths[0];
});

// --- Recording flow: countdown -> capture -> HUD ----------------------------

ipcMain.handle("recly:begin-countdown", async () => {
	if (countdownWindow) return;
	countdownWindow = createCountdownWindow();
	countdownWindow.on("closed", () => {
		countdownWindow = null;
	});
});

ipcMain.handle("recly:countdown-complete", async () => {
	countdownWindow?.close();
	countdownWindow = null;

	hudWindow = createHudWindow();
	hudWindow.on("closed", () => {
		hudWindow = null;
	});

	mainWindow?.webContents.send("recly:begin-capture");
	mainWindow?.hide();
});

interface HudDragState {
	startBoundsX: number;
	startBoundsY: number;
	startScreenX: number;
	startScreenY: number;
}
let hudDragState: HudDragState | null = null;

ipcMain.on(
	"recly:hud-overlay-drag",
	(_event, payload: { phase: "start" | "move" | "end"; screenX: number; screenY: number }) => {
		if (!hudWindow) return;

		if (payload.phase === "start") {
			const bounds = hudWindow.getBounds();
			hudDragState = {
				startBoundsX: bounds.x,
				startBoundsY: bounds.y,
				startScreenX: payload.screenX,
				startScreenY: payload.screenY,
			};
			return;
		}

		if (payload.phase === "move" && hudDragState) {
			const dx = payload.screenX - hudDragState.startScreenX;
			const dy = payload.screenY - hudDragState.startScreenY;
			hudWindow.setBounds({
				x: Math.round(hudDragState.startBoundsX + dx),
				y: Math.round(hudDragState.startBoundsY + dy),
				width: hudWindow.getBounds().width,
				height: hudWindow.getBounds().height,
			});
			return;
		}

		hudDragState = null;
	},
);

ipcMain.on("recly:hud-overlay-set-ignore-mouse", (_event, ignore: boolean) => {
	hudWindow?.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.handle("recly:get-hud-overlay-capture-protection", async () => hudCaptureProtectionEnabled);

ipcMain.handle("recly:set-hud-overlay-capture-protection", async (_event, enabled: boolean) => {
	hudCaptureProtectionEnabled = enabled;
	if (supportsHudCaptureProtection) {
		hudWindow?.setContentProtection(enabled);
	}
});

ipcMain.handle("recly:get-hud-overlay-mouse-passthrough-supported", async () => true);

ipcMain.handle("recly:hud-command", async (_event, command: "pause" | "resume" | "stop") => {
	mainWindow?.webContents.send("recly:hud-command", command);
});

ipcMain.handle("recly:recording-finished", async () => {
	hudWindow?.close();
	hudWindow = null;
	mainWindow?.show();
	mainWindow?.focus();
});

// --- Native capture (Windows only) -------------------------------------------

ipcMain.handle("recly:native-capture-available", async () => isNativeCaptureAvailable());

ipcMain.handle("recly:native-capture-start", async (_event, options: NativeCaptureOptions) => {
	return startNativeCapture(options);
});

ipcMain.handle("recly:native-capture-stop", async () => stopNativeCapture());

ipcMain.handle(
	"recly:save-mic-sidecar",
	async (_event, payload: { videoPath: string; data: ArrayBuffer }) => {
		return saveMicSidecar(payload.videoPath, Buffer.from(payload.data));
	},
);

ipcMain.handle("recly:check-mic-sidecar", async (_event, videoPath: string) => {
	return checkMicSidecar(videoPath);
});

// --- Platform & permissions (screen-recording/accessibility prompts are macOS-only) ------

ipcMain.handle("recly:get-platform", async () => process.platform);
ipcMain.handle("recly:get-app-version", async () => app.getVersion());
ipcMain.handle("recly:get-announcements", async () => getRemoteAnnouncements());

ipcMain.handle("recly:open-external-url", async (_event, url: string) => {
	if (url.startsWith("https://") || url.startsWith("http://")) {
		await shell.openExternal(url);
	}
});

ipcMain.handle("recly:get-accessibility-permission-status", async () => getAccessibilityPermissionStatus());
ipcMain.handle("recly:request-accessibility-permission-status", async () => requestAccessibilityPermissionStatus());
ipcMain.handle("recly:get-screen-recording-permission-status", async () => getScreenRecordingPermissionStatus());
ipcMain.handle("recly:open-screen-recording-preferences", async () => openScreenRecordingPreferences());
ipcMain.handle("recly:open-accessibility-preferences", async () => openAccessibilityPreferences());

// --- Cursor telemetry --------------------------------------------------------

ipcMain.handle("recly:start-cursor-tracking", async (event) => {
	cursorUnsubscribe?.();
	const sender = event.sender;
	cursorUnsubscribe = subscribeCursorTracking((sample) => {
		if (!sender.isDestroyed()) {
			sender.send("recly:cursor-sample", sample);
		}
	});
});

ipcMain.handle("recly:stop-cursor-tracking", async () => {
	cursorUnsubscribe?.();
	cursorUnsubscribe = null;
});

ipcMain.handle(
	"recly:save-cursor-telemetry",
	async (_event, payload: { videoPath: string; samples: CursorSampleRecord[] }) => {
		if (payload.samples.length === 0) return null;
		return saveCursorTelemetry(payload.videoPath, payload.samples);
	},
);

ipcMain.handle("recly:load-cursor-telemetry", async (_event, videoPath: string) => {
	return loadCursorTelemetry(cursorTelemetryPathFor(videoPath));
});

// --- Saving & exporting -------------------------------------------------------

ipcMain.handle(
	"recly:save-recording",
	async (_event, payload: { data: ArrayBuffer; directory: string; fileName: string }) => {
		const buffer = Buffer.from(payload.data);
		return exportMediaFile(buffer, payload.directory, payload.fileName, {
			format: "mp4",
			quality: "medium",
			frameRate: 30,
		});
	},
);

ipcMain.handle(
	"recly:export-media",
	async (
		_event,
		payload: { data: ArrayBuffer; directory: string; fileName: string; options: ExportOptions },
	) => {
		const buffer = Buffer.from(payload.data);
		return exportMediaFile(buffer, payload.directory, payload.fileName, payload.options);
	},
);

ipcMain.handle(
	"recly:export-precoded-mp4",
	async (
		_event,
		payload: {
			videoData: ArrayBuffer;
			audioData: ArrayBuffer | null;
			audioDataFormat?: "webm" | "wav";
			audioRegions: ExportAudioRegionInput[];
			directory: string;
			fileName: string;
		},
	) => {
		const videoBuffer = Buffer.from(payload.videoData);
		const audioBuffer = payload.audioData ? Buffer.from(payload.audioData) : null;
		return exportPrecodedMp4(
			videoBuffer,
			audioBuffer,
			payload.audioRegions,
			payload.directory,
			payload.fileName,
			payload.audioDataFormat ?? "webm",
		);
	},
);

ipcMain.handle("recly:reveal-in-folder", async (_event, filePath: string) => {
	shell.showItemInFolder(filePath);
});

ipcMain.handle(
	"recly:write-subtitle-sidecar",
	async (_event, payload: { videoFilePath: string; contents: string }) => {
		const srtPath = payload.videoFilePath.replace(/\.[^.]+$/, "") + ".srt";
		await fs.writeFile(srtPath, payload.contents, "utf8");
		return srtPath;
	},
);

let editorHasUnsavedChanges = false;
let pendingSaveBeforeCloseResolve: ((saved: boolean) => void) | null = null;

ipcMain.on("recly:set-has-unsaved-changes", (_event, value: boolean) => {
	editorHasUnsavedChanges = value;
});

ipcMain.on("recly:save-before-close-done", (_event, saved: boolean) => {
	pendingSaveBeforeCloseResolve?.(saved);
	pendingSaveBeforeCloseResolve = null;
});

ipcMain.handle("recly:open-editor", async (_event, videoPath: string) => {
	const editorWindow = createEditorWindow();
	activeEditorWindow = editorWindow;
	editorHasUnsavedChanges = false;

	editorWindow.webContents.once("did-finish-load", () => {
		editorWindow.webContents.send("recly:editor-open-video", videoPath);
	});

	let forceClose = false;
	editorWindow.on("close", (event) => {
		if (forceClose || !editorHasUnsavedChanges) return;

		event.preventDefault();
		const choice = dialog.showMessageBoxSync(editorWindow, {
			type: "question",
			buttons: ["Save && Close", "Discard && Close", "Cancel"],
			defaultId: 0,
			cancelId: 2,
			message: "You have unsaved changes. Save your project before closing?",
		});

		if (choice === 2) return;

		if (choice === 1) {
			forceClose = true;
			editorHasUnsavedChanges = false;
			editorWindow.close();
			return;
		}

		editorWindow.webContents.send("recly:request-save-before-close");
		void new Promise<boolean>((resolve) => {
			pendingSaveBeforeCloseResolve = resolve;
		}).then(() => {
			forceClose = true;
			editorHasUnsavedChanges = false;
			editorWindow.close();
		});
	});

	editorWindow.on("closed", () => {
		if (activeEditorWindow === editorWindow) activeEditorWindow = null;
	});
});

// --- Project save/load ---------------------------------------------------------

ipcMain.handle("recly:save-project", async (event, project: ReclyProject) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const savedPath = await saveProjectFile(win, project);
	if (savedPath) await registerProjectInLibrary(savedPath);
	return savedPath;
});

ipcMain.handle("recly:open-project", async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return null;
	const result = await openProjectFile(win);
	if (result) await registerProjectInLibrary(result.path);
	return result;
});

ipcMain.handle("recly:list-project-library", async () => {
	return listProjectLibrary();
});

ipcMain.handle("recly:open-project-at", async (_event, filePath: string) => {
	const raw = await fs.readFile(filePath, "utf8");
	const project = JSON.parse(raw) as ReclyProject;
	await registerProjectInLibrary(filePath);
	return { path: filePath, project };
});

ipcMain.handle("recly:remove-project-from-library", async (_event, filePath: string) => {
	await removeProjectFromLibrary(filePath);
});

// --- Captions (local Whisper transcription) --------------------------------------

ipcMain.handle(
	"recly:transcribe-captions",
	async (event, payload: { videoPath: string; modelSize: WhisperModelSize; language: string }) => {
		return transcribeVideo(payload.videoPath, payload.modelSize, payload.language, (progress) => {
			event.sender.send("recly:caption-progress", progress);
		});
	},
);

// --- Settings & shortcuts --------------------------------------------------------

ipcMain.handle("recly:open-settings", async () => {
	if (settingsWindow) {
		settingsWindow.show();
		settingsWindow.focus();
		return;
	}
	settingsWindow = createSettingsWindow();
	settingsWindow.on("closed", () => {
		settingsWindow = null;
	});
});

function registerAppShortcuts(): void {
	registerShortcuts(shortcutsConfig, {
		onToggleRecording: () => mainWindow?.webContents.send("recly:global-shortcut", "toggle-recording"),
		onPauseResumeRecording: () =>
			mainWindow?.webContents.send("recly:global-shortcut", "pause-resume-recording"),
	});
}

ipcMain.handle("recly:get-shortcuts", async () => shortcutsConfig);

ipcMain.handle("recly:set-shortcuts", async (_event, next: ShortcutsConfig) => {
	shortcutsConfig = next;
	await saveShortcutsConfig(next);
	registerAppShortcuts();
});

// --- Auto-updater ----------------------------------------------------------------

ipcMain.handle("recly:check-for-app-updates", async () => checkForUpdates());
ipcMain.handle("recly:download-available-update", async () => downloadAvailableUpdate());
ipcMain.handle("recly:install-downloaded-update", async () => installDownloadedUpdate());
ipcMain.handle("recly:dismiss-update-toast", async () => dismissUpdateToast());
ipcMain.handle("recly:get-update-status-summary", async () => getUpdateStatusSummary());
ipcMain.handle("recly:get-current-update-toast-payload", async () => getCurrentUpdateToastPayload());
ipcMain.handle("recly:preview-update-toast", async () => {
	if (!app.isPackaged) previewUpdateToast();
});

// --- Launching by double-clicking a .reclyproj file --------------------------------

function extractProjectFilePath(argv: string[]): string | null {
	return argv.find((arg) => arg.toLowerCase().endsWith(".reclyproj")) ?? null;
}

async function openProjectFileAtPath(filePath: string): Promise<void> {
	try {
		const raw = await fs.readFile(filePath, "utf8");
		const project = JSON.parse(raw) as ReclyProject;
		await registerProjectInLibrary(filePath);

		const editorWindow = createEditorWindow();
		activeEditorWindow = editorWindow;
		editorWindow.webContents.once("did-finish-load", () => {
			editorWindow.webContents.send("recly:editor-open-project", { path: filePath, project });
		});
	} catch {
		// Missing/corrupt project file on launch — fail quietly rather than crash startup.
	}
}

let pendingProjectFilePath: string | null = null;

// Fires on macOS when a .reclyproj is opened via Finder/dock, both before and after 'ready'.
app.on("open-file", (event, filePath) => {
	event.preventDefault();
	if (app.isReady()) {
		void openProjectFileAtPath(filePath);
	} else {
		pendingProjectFilePath = filePath;
	}
});

// On Windows/Linux the file path arrives as a plain argv entry instead.
const singleInstanceLockAcquired = app.requestSingleInstanceLock();
if (!singleInstanceLockAcquired) {
	app.quit();
} else {
	app.on("second-instance", (_event, argv) => {
		const filePath = extractProjectFilePath(argv);
		if (filePath) {
			void openProjectFileAtPath(filePath);
		} else {
			mainWindow?.show();
			mainWindow?.focus();
		}
	});
}

// --- App lifecycle -------------------------------------------------------------

app.whenReady().then(async () => {
	createMainWindow();
	createTray(() => mainWindow);

	Menu.setApplicationMenu(
		buildAppMenu({
			getEditorWindow: () => activeEditorWindow,
			onCheckForUpdates: () => void checkForUpdates(),
		}),
	);
	initAutoUpdater(() => mainWindow);

	shortcutsConfig = await loadShortcutsConfig();
	registerAppShortcuts();

	const launchProjectFilePath = pendingProjectFilePath ?? extractProjectFilePath(process.argv);
	if (launchProjectFilePath) {
		void openProjectFileAtPath(launchProjectFilePath);
	}
});

app.on("will-quit", () => {
	globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createMainWindow();
	}
});
