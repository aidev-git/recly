import { type BrowserWindow, screen } from "electron";
import { createAppWindow } from "./createChildWindow";

export function createCountdownWindow(): BrowserWindow {
	const display = screen.getPrimaryDisplay();

	return createAppWindow("countdown", {
		x: display.bounds.x,
		y: display.bounds.y,
		width: display.bounds.width,
		height: display.bounds.height,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		focusable: false,
		hasShadow: false,
	});
}
