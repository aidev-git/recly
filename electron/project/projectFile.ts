import { promises as fs } from "node:fs";
import { type BrowserWindow, dialog } from "electron";
import type { ReclyProject } from "./projectTypes";

export async function saveProjectFile(
	win: BrowserWindow,
	project: ReclyProject,
	defaultPath?: string,
): Promise<string | null> {
	const result = await dialog.showSaveDialog(win, {
		title: "Save Recly Project",
		defaultPath: defaultPath ?? "recording.reclyproj",
		filters: [{ name: "Recly Project", extensions: ["reclyproj"] }],
	});

	if (result.canceled || !result.filePath) {
		return null;
	}

	await fs.writeFile(result.filePath, JSON.stringify(project, null, 2), "utf8");
	return result.filePath;
}

export async function openProjectFile(
	win: BrowserWindow,
): Promise<{ path: string; project: ReclyProject } | null> {
	const result = await dialog.showOpenDialog(win, {
		title: "Open Recly Project",
		properties: ["openFile"],
		filters: [{ name: "Recly Project", extensions: ["reclyproj"] }],
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	const filePath = result.filePaths[0];
	const raw = await fs.readFile(filePath, "utf8");
	const project = JSON.parse(raw) as ReclyProject;
	return { path: filePath, project };
}
