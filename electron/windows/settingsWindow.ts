import type { BrowserWindow } from "electron";
import { createAppWindow } from "./createChildWindow";

export function createSettingsWindow(): BrowserWindow {
	return createAppWindow("settings", {
		width: 420,
		height: 560,
		minWidth: 380,
		minHeight: 480,
		title: "Recly Settings",
		backgroundColor: "#190f1d",
	});
}
