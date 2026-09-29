import { promises as fs } from "node:fs";
import path from "node:path";
import { app, globalShortcut } from "electron";

export interface ShortcutsConfig {
	toggleRecording: string;
	pauseResumeRecording: string;
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
	toggleRecording: "CommandOrControl+Shift+R",
	pauseResumeRecording: "CommandOrControl+Shift+P",
};

function getShortcutsFilePath(): string {
	return path.join(app.getPath("userData"), "shortcuts.json");
}

export async function loadShortcutsConfig(): Promise<ShortcutsConfig> {
	try {
		const raw = await fs.readFile(getShortcutsFilePath(), "utf8");
		return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULT_SHORTCUTS;
	}
}

export async function saveShortcutsConfig(config: ShortcutsConfig): Promise<void> {
	await fs.writeFile(getShortcutsFilePath(), JSON.stringify(config, null, 2), "utf8");
}

export interface ShortcutHandlers {
	onToggleRecording: () => void;
	onPauseResumeRecording: () => void;
}

export function registerShortcuts(config: ShortcutsConfig, handlers: ShortcutHandlers): void {
	globalShortcut.unregisterAll();

	const bindings: Array<[string, () => void]> = [
		[config.toggleRecording, handlers.onToggleRecording],
		[config.pauseResumeRecording, handlers.onPauseResumeRecording],
	];

	for (const [accelerator, handler] of bindings) {
		if (!accelerator) continue;
		try {
			globalShortcut.register(accelerator, handler);
		} catch {
			// Invalid/unavailable accelerator — leave unregistered.
		}
	}
}
