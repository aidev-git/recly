import { app, type BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

export interface UpdateToastPayload {
	version: string;
	detail: string;
	phase: "available" | "downloading" | "ready" | "error";
	progressPercent?: number;
	transferredBytes?: number;
	totalBytes?: number;
	bytesPerSecond?: number;
	primaryAction?: "install-and-restart" | "retry-check";
}

export interface UpdateStatusSummary {
	status: UpdateStatus;
	currentVersion: string;
	availableVersion: string | null;
	detail: string | null;
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 15_000;

let currentStatus: UpdateStatus = "idle";
let availableVersion: string | null = null;
let statusDetail: string | null = null;
let currentToast: UpdateToastPayload | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;

function isAutoUpdateDisabled(): boolean {
	return !app.isPackaged || process.mas === true || process.env.RECLY_DISABLE_AUTO_UPDATES === "1";
}

function broadcastToast(toast: UpdateToastPayload | null): void {
	currentToast = toast;
	const win = getMainWindow?.();
	if (win && !win.isDestroyed()) {
		win.webContents.send("recly:update-toast-state", toast);
	} else if (toast) {
		// No window available to render the toast — fall back to a native dialog so the user
		// still finds out about the update.
		void dialog.showMessageBox({
			type: "info",
			message: `Recly ${toast.version} is available`,
			detail: toast.detail,
			buttons: toast.phase === "ready" ? ["Install && Restart", "Later"] : ["OK"],
		});
	}
}

export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
	getMainWindow = getWindow;
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = false;

	if (process.env.RECLY_UPDATE_FEED_URL) {
		autoUpdater.setFeedURL({ provider: "generic", url: process.env.RECLY_UPDATE_FEED_URL });
	}

	autoUpdater.on("checking-for-update", () => {
		currentStatus = "checking";
	});

	autoUpdater.on("update-not-available", () => {
		currentStatus = "up-to-date";
		availableVersion = null;
		statusDetail = null;
	});

	autoUpdater.on("update-available", (info) => {
		currentStatus = "available";
		availableVersion = info.version;
		statusDetail = null;
		broadcastToast({
			version: info.version,
			detail: "A new version is available to download.",
			phase: "available",
		});
	});

	autoUpdater.on("download-progress", (progress) => {
		currentStatus = "downloading";
		broadcastToast({
			version: availableVersion ?? "",
			detail: "Downloading update…",
			phase: "downloading",
			progressPercent: progress.percent,
			transferredBytes: progress.transferred,
			totalBytes: progress.total,
			bytesPerSecond: progress.bytesPerSecond,
		});
	});

	autoUpdater.on("update-downloaded", (info) => {
		currentStatus = "ready";
		availableVersion = info.version;
		broadcastToast({
			version: info.version,
			detail: "Ready to install — restart Recly to finish updating.",
			phase: "ready",
			primaryAction: "install-and-restart",
		});
	});

	autoUpdater.on("error", (error) => {
		currentStatus = "error";
		statusDetail = error.message;
		broadcastToast({
			version: availableVersion ?? "",
			detail: `Update check failed: ${error.message}`,
			phase: "error",
			primaryAction: "retry-check",
		});
	});

	if (isAutoUpdateDisabled()) return;

	setTimeout(() => void checkForUpdates(), INITIAL_CHECK_DELAY_MS);
	setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}

export async function checkForUpdates(): Promise<void> {
	if (isAutoUpdateDisabled()) {
		broadcastToast(null);
		void dialog.showMessageBox({ type: "info", message: "You're on the latest version.", buttons: ["OK"] });
		return;
	}
	try {
		await autoUpdater.checkForUpdates();
	} catch {
		// Errors already surface via the 'error' event listener above.
	}
}

export async function downloadAvailableUpdate(): Promise<void> {
	if (currentStatus !== "available") return;
	await autoUpdater.downloadUpdate();
}

export function installDownloadedUpdate(): void {
	if (currentStatus !== "ready") return;
	autoUpdater.quitAndInstall();
}

export function dismissUpdateToast(): void {
	broadcastToast(null);
}

export function getUpdateStatusSummary(): UpdateStatusSummary {
	return {
		status: currentStatus,
		currentVersion: app.getVersion(),
		availableVersion,
		detail: statusDetail,
	};
}

export function getCurrentUpdateToastPayload(): UpdateToastPayload | null {
	return currentToast;
}

/** Dev-only: synthesizes a fake toast so the UI can be exercised without a real published
 * release to update to. */
export function previewUpdateToast(): void {
	broadcastToast({
		version: "9.9.9",
		detail: "Preview toast — no real update available.",
		phase: "ready",
		primaryAction: "install-and-restart",
	});
}
