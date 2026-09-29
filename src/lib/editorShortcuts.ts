export type EditorActionId =
	| "playPause"
	| "splitClip"
	| "deleteSelected"
	| "addZoomAtPlayhead"
	| "cycleAnnotationTool";

export type EditorShortcutsConfig = Record<EditorActionId, string>;

export const EDITOR_ACTIONS: EditorActionId[] = [
	"playPause",
	"splitClip",
	"deleteSelected",
	"addZoomAtPlayhead",
	"cycleAnnotationTool",
];

export const DEFAULT_EDITOR_SHORTCUTS: EditorShortcutsConfig = {
	playPause: "Space",
	splitClip: "S",
	deleteSelected: "Delete",
	addZoomAtPlayhead: "Z",
	cycleAnnotationTool: "A",
};

const STORAGE_KEY = "recly.settings.editorShortcuts";

export function loadEditorShortcuts(): EditorShortcutsConfig {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return { ...DEFAULT_EDITOR_SHORTCUTS };
		return { ...DEFAULT_EDITOR_SHORTCUTS, ...JSON.parse(stored) };
	} catch {
		return { ...DEFAULT_EDITOR_SHORTCUTS };
	}
}

export function saveEditorShortcuts(config: EditorShortcutsConfig): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function normalizeKey(key: string): string {
	if (key === " ") return "Space";
	return key.length === 1 ? key.toUpperCase() : key;
}

/** Single-key capture (no modifiers) — editor shortcuts are always one key, unlike the global app shortcuts. */
export function captureEditorAccelerator(event: { key: string }): string | null {
	if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return null;
	return normalizeKey(event.key);
}

export function findShortcutConflict(
	config: EditorShortcutsConfig,
	action: EditorActionId,
	value: string,
): EditorActionId | null {
	for (const key of EDITOR_ACTIONS) {
		if (key !== action && config[key] === value) return key;
	}
	return null;
}

export function eventMatchesShortcut(event: KeyboardEvent, value: string): boolean {
	return normalizeKey(event.key) === value;
}
