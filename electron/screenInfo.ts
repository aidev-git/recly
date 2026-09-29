import { screen } from "electron";

export interface DisplayInfo {
	widthPx: number;
	heightPx: number;
	scaleFactor: number;
}

export function getPrimaryDisplayInfo(): DisplayInfo {
	const display = screen.getPrimaryDisplay();
	return {
		widthPx: display.size.width * display.scaleFactor,
		heightPx: display.size.height * display.scaleFactor,
		scaleFactor: display.scaleFactor,
	};
}
