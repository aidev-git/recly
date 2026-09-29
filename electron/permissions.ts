import { shell, systemPreferences } from "electron";

export type ScreenRecordingPermissionStatus = "granted" | "denied" | "not-determined" | "restricted" | "unknown";

/** Screen-recording and accessibility permission prompts are a macOS-only concept — every
 * function here is a no-op reporting "already granted" on other platforms, matching how macOS
 * itself treats an app that's never been sandboxed for these permissions. */

export function getAccessibilityPermissionStatus(): { trusted: boolean } {
	if (process.platform !== "darwin") return { trusted: true };
	return { trusted: systemPreferences.isTrustedAccessibilityClient(false) };
}

export function requestAccessibilityPermissionStatus(): { trusted: boolean } {
	if (process.platform !== "darwin") return { trusted: true };
	return { trusted: systemPreferences.isTrustedAccessibilityClient(true) };
}

export function getScreenRecordingPermissionStatus(): { status: ScreenRecordingPermissionStatus } {
	if (process.platform !== "darwin") return { status: "granted" };
	return { status: systemPreferences.getMediaAccessStatus("screen") };
}

export function openScreenRecordingPreferences(): void {
	if (process.platform !== "darwin") return;
	void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
}

export function openAccessibilityPreferences(): void {
	if (process.platform !== "darwin") return;
	void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
}
