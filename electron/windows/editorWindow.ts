import type { BrowserWindow } from "electron";
import { createAppWindow } from "./createChildWindow";

export function createEditorWindow(): BrowserWindow {
	return createAppWindow("editor", {
		width: 1100,
		height: 720,
		minWidth: 760,
		minHeight: 520,
		title: "Recly Editor",
		backgroundColor: "#190f1d",
	});
}
