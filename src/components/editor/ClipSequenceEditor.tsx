import type { ClipRegion } from "../../../electron/project/projectTypes";
import { SPEED_PRESETS } from "../../../electron/project/projectTypes";
import { useI18n } from "@/hooks/useI18n";

interface ClipSequenceEditorProps {
	clips: ClipRegion[];
	selectedClipId: string | null;
	onChangeClip: (clipId: string, patch: Partial<ClipRegion>) => void;
	onSplitAtPlayhead: () => void;
	onDeleteClip: (clipId: string) => void;
	onMoveClip: (clipId: string, direction: -1 | 1) => void;
}

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2);
}

export function ClipSequenceEditor({
	clips,
	selectedClipId,
	onChangeClip,
	onSplitAtPlayhead,
	onDeleteClip,
	onMoveClip,
}: ClipSequenceEditorProps) {
	const { t } = useI18n();
	const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<span className="text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("editor.clips")}
				</span>
				<button
					type="button"
					onClick={onSplitAtPlayhead}
					className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15"
				>
					{t("editor.splitAtPlayhead")}
				</button>
			</div>

			{selectedClip && (
				<div className="flex flex-col gap-2 rounded-lg bg-white/5 p-2.5">
					<div className="grid grid-cols-2 gap-2">
						<label className="flex flex-col gap-0.5 text-[10px] text-white/50">
							{t("editor.clipIn")}
							<input
								type="number"
								step={0.1}
								value={formatSeconds(selectedClip.sourceStartMs)}
								onChange={(event) =>
									onChangeClip(selectedClip.id, {
										sourceStartMs: Math.max(0, Number(event.target.value) * 1000),
									})
								}
								className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white"
							/>
						</label>
						<label className="flex flex-col gap-0.5 text-[10px] text-white/50">
							{t("editor.clipOut")}
							<input
								type="number"
								step={0.1}
								value={formatSeconds(selectedClip.sourceEndMs)}
								onChange={(event) =>
									onChangeClip(selectedClip.id, {
										sourceEndMs: Number(event.target.value) * 1000,
									})
								}
								className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white"
							/>
						</label>
					</div>
					<label className="flex flex-col gap-0.5 text-[10px] text-white/50">
						{t("editor.clipSpeed")}
						<input
							type="number"
							step={0.25}
							min={0.25}
							max={4}
							value={selectedClip.speed}
							onChange={(event) =>
								onChangeClip(selectedClip.id, { speed: Number(event.target.value) || 1 })
							}
							className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white"
						/>
					</label>
					<div className="flex flex-wrap gap-1">
						{SPEED_PRESETS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => onChangeClip(selectedClip.id, { speed: preset })}
								className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
									selectedClip.speed === preset
										? "bg-brand-500 text-white"
										: "bg-white/5 text-white/50 hover:bg-white/10"
								}`}
							>
								{preset}×
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() => onChangeClip(selectedClip.id, { muted: !selectedClip.muted })}
						className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] transition-colors ${
							selectedClip.muted ? "bg-red-500/20 text-red-200" : "bg-white/5 text-white/70 hover:bg-white/10"
						}`}
					>
						{t("editor.clipMuted")}
						<span
							className={`relative h-4 w-7 rounded-full transition-colors ${selectedClip.muted ? "bg-red-500" : "bg-white/20"}`}
						>
							<span
								className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
									selectedClip.muted ? "translate-x-3.5" : "translate-x-0.5"
								}`}
							/>
						</span>
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onMoveClip(selectedClip.id, -1)}
							className="flex-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/15"
						>
							{t("editor.moveEarlier")}
						</button>
						<button
							type="button"
							onClick={() => onMoveClip(selectedClip.id, 1)}
							className="flex-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/15"
						>
							{t("editor.moveLater")}
						</button>
						<button
							type="button"
							disabled={clips.length <= 1}
							onClick={() => onDeleteClip(selectedClip.id)}
							className="flex-1 rounded-md bg-red-500/20 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{t("editor.delete")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
