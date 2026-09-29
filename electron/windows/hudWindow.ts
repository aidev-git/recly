import { type BrowserWindow, screen } from "electron";
import { createAppWindow } from "./createChildWindow";

const HUD_WIDTH = 220;
const HUD_HEIGHT = 56;

/** Only these platforms support hiding a window from screen-capture APIs (Electron's
 * setContentProtection); on other platforms the call is a silent no-op. */
export const supportsHudCaptureProtection = process.platform === "win32" || process.platform === "darwin";

export function createHudWindow(): BrowserWindow {
	const display = screen.getPrimaryDisplay();
	const x = Math.round(display.workArea.x + (display.workArea.width - HUD_WIDTH) / 2);
	const y = display.workArea.y + 16;

	const win = createAppWindow("hud", {
		width: HUD_WIDTH,
		height: HUD_HEIGHT,
		x,
		y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
	});

	// The HUD shouldn't appear in the user's own recording. Click-through by default (the whole
	// window is a small floating bar with no "background" content behind it to interact with);
	// the renderer disables passthrough on hover so the pause/stop buttons remain clickable.
	if (supportsHudCaptureProtection) {
		win.setContentProtection(true);
	}
	win.setIgnoreMouseEvents(true, { forward: true });

	return win;
}
