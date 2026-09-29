import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";

// All electron/ source files bundle into a single dist-electron/main.cjs, so
// `import.meta.url` here resolves to that bundle's own location, not this
// file's original source path — dirname is always dist-electron/.
const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export function createAppWindow(
	windowType: string,
	options: BrowserWindowConstructorOptions = {},
): BrowserWindow {
	const win = new BrowserWindow({
		webPreferences: {
			preload: path.join(dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		...options,
	});

	const query = `windowType=${windowType}`;

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(`${VITE_DEV_SERVER_URL}?${query}`);
	} else {
		win.loadFile(path.join(rootDir, "dist", "index.html"), { search: query });
	}

	return win;
}
