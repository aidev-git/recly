import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";

const dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
	const iconPath = path.join(dirname, "..", "public", "icon", "32.png");
	const icon = nativeImage.createFromPath(iconPath);
	tray = new Tray(icon.resize({ width: 16, height: 16 }));
	tray.setToolTip("Recly");

	const menu = Menu.buildFromTemplate([
		{
			label: "Open Recly",
			click: () => {
				const win = getMainWindow();
				if (win) {
					win.show();
					win.focus();
				}
			},
		},
		{ type: "separator" },
		{
			label: "Quit Recly",
			click: () => app.quit(),
		},
	]);

	tray.setContextMenu(menu);
	tray.on("click", () => {
		const win = getMainWindow();
		if (win) {
			win.show();
			win.focus();
		}
	});

	return tray;
}
