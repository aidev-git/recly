import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
	captureEditorAccelerator,
	EDITOR_ACTIONS,
	findShortcutConflict,
	type EditorActionId,
	type EditorShortcutsConfig,
} from "@/lib/editorShortcuts";

interface EditorShortcutsDialogProps {
	config: EditorShortcutsConfig;
	onChange: (config: EditorShortcutsConfig) => void;
	onClose: () => void;
}

const ACTION_LABEL_KEYS: Record<EditorActionId, string> = {
	playPause: "editorShortcut.playPause",
	splitClip: "editorShortcut.splitClip",
	deleteSelected: "editorShortcut.deleteSelected",
	addZoomAtPlayhead: "editorShortcut.addZoomAtPlayhead",
	cycleAnnotationTool: "editorShortcut.cycleAnnotationTool",
};

export function EditorShortcutsDialog({ config, onChange, onClose }: EditorShortcutsDialogProps) {
	const { t } = useI18n();
	const [capturingAction, setCapturingAction] = useState<EditorActionId | null>(null);
	const [conflictMessage, setConflictMessage] = useState<string | null>(null);

	const handleKeyDown = (action: EditorActionId) => (event: React.KeyboardEvent) => {
		event.preventDefault();
		const accelerator = captureEditorAccelerator(event);
		if (!accelerator) return;

		const conflict = findShortcutConflict(config, action, accelerator);
		if (conflict) {
			setConflictMessage(t("editorShortcut.conflictWith", { action: t(ACTION_LABEL_KEYS[conflict]) }));
			return;
		}

		setConflictMessage(null);
		setCapturingAction(null);
		onChange({ ...config, [action]: accelerator });
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
			onClick={onClose}
			role="presentation"
		>
			<div
				className="flex w-80 flex-col gap-3 rounded-2xl border border-white/10 bg-brand-950 p-4"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-white">{t("editorShortcut.title")}</h3>
					<button type="button" onClick={onClose} className="text-white/50 hover:text-white">
						✕
					</button>
				</div>

				{EDITOR_ACTIONS.map((action) => (
					<div key={action} className="flex flex-col gap-1">
						<span className="text-[11px] text-white/50">{t(ACTION_LABEL_KEYS[action])}</span>
						<button
							type="button"
							onClick={() => {
								setCapturingAction(action);
								setConflictMessage(null);
							}}
							onBlur={() => setCapturingAction((current) => (current === action ? null : current))}
							onKeyDown={capturingAction === action ? handleKeyDown(action) : undefined}
							className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
								capturingAction === action
									? "border-brand-400 bg-brand-500/15 text-brand-100"
									: "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
							}`}
						>
							{capturingAction === action ? t("settingsWindow.pressKeys") : config[action]}
						</button>
					</div>
				))}

				{conflictMessage && <p className="text-[10px] text-red-300">{conflictMessage}</p>}
			</div>
		</div>
	);
}
