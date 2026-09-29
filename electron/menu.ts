import { type BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";

export interface AppMenuCallbacks {
	getEditorWindow: () => BrowserWindow | null;
	onCheckForUpdates: () => void;
}

/** Standard native app menu: mostly built-in Electron roles, plus a few app-specific items
 * (project save/open, routed to whichever editor window is currently open) and a Help entry. */
export function buildAppMenu(callbacks: AppMenuCallbacks): Menu {
	const isMac = process.platform === "darwin";

	const sendToEditor = (channel: string) => {
		const editorWindow = callbacks.getEditorWindow();
		if (editorWindow && !editorWindow.isDestroyed()) {
			editorWindow.webContents.send(channel);
		}
	};

	const template: MenuItemConstructorOptions[] = [
		...(isMac
			? [
					{
						label: "Recly",
						submenu: [
							{ role: "about" as const },
							{ type: "separator" as const },
							{ role: "services" as const },
							{ type: "separator" as const },
							{ role: "hide" as const },
							{ role: "hideOthers" as const },
							{ role: "unhide" as const },
							{ type: "separator" as const },
							{ role: "quit" as const },
						],
					},
				]
			: []),
		{
			label: "File",
			submenu: [
				{
					label: "Open Project…",
					accelerator: "CmdOrCtrl+O",
					click: () => sendToEditor("recly:menu-open-project"),
				},
				{
					label: "Save Project…",
					accelerator: "CmdOrCtrl+S",
					click: () => sendToEditor("recly:menu-save-project"),
				},
				{ type: "separator" },
				isMac ? { role: "close" } : { role: "quit" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				...(isMac ? [{ role: "zoom" as const }, { type: "separator" as const }, { role: "front" as const }] : []),
			],
		},
		{
			label: "Help",
			submenu: [
				{
					label: "Check for Updates…",
					click: callbacks.onCheckForUpdates,
				},
			],
		},
	];

	return Menu.buildFromTemplate(template);
}
