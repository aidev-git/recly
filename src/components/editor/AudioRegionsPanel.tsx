import type { AudioRegion } from "../../../electron/project/projectTypes";
import { MAX_AUDIO_TRACK_LANES } from "../../../electron/project/projectTypes";
import { useI18n } from "@/hooks/useI18n";

interface AudioRegionsPanelProps {
	regions: AudioRegion[];
	onAdd: () => void;
	onChange: (id: string, patch: Partial<AudioRegion>) => void;
	onDelete: (id: string) => void;
}

function baseName(filePath: string): string {
	return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2);
}

export function AudioRegionsPanel({ regions, onAdd, onChange, onDelete }: AudioRegionsPanelProps) {
	const { t } = useI18n();

	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("audioRegions.title")}
				</h3>
				<button
					type="button"
					onClick={onAdd}
					className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/15"
				>
					{t("audioRegions.add")}
				</button>
			</div>

			{regions.length === 0 && <p className="text-[11px] text-white/40">{t("audioRegions.empty")}</p>}

			<div className="flex flex-col gap-1.5">
				{regions.map((region) => (
					<div key={region.id} className="flex flex-col gap-1.5 rounded-lg bg-white/5 p-1.5 text-[10px]">
						<div className="flex items-center justify-between gap-2">
							<span className="truncate text-white/70">{baseName(region.filePath)}</span>
							<button
								type="button"
								onClick={() => onDelete(region.id)}
								className="text-red-300 hover:text-red-200"
							>
								✕
							</button>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="text-white/40">{t("audioRegions.start")}</span>
							<input
								type="number"
								step={0.1}
								value={formatSeconds(region.startMs)}
								onChange={(event) => onChange(region.id, { startMs: Number(event.target.value) * 1000 })}
								className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
							/>
							<span className="text-white/30">s</span>
							<span className="ml-1 text-white/40">{t("audioRegions.duration")}</span>
							<input
								type="number"
								step={0.1}
								min={0.1}
								value={formatSeconds(region.durationMs)}
								onChange={(event) =>
									onChange(region.id, { durationMs: Math.max(100, Number(event.target.value) * 1000) })
								}
								className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
							/>
							<span className="text-white/30">s</span>
						</div>
						<label className="flex items-center gap-1.5 text-white/40">
							{t("audioRegions.volume")}
							<input
								type="range"
								min={0}
								max={2}
								step={0.05}
								value={region.volume}
								onChange={(event) => onChange(region.id, { volume: Number(event.target.value) })}
								className="flex-1 accent-brand-500"
							/>
							<span className="w-8 text-white/50">{region.volume.toFixed(2)}x</span>
						</label>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => onChange(region.id, { normalize: !region.normalize })}
								className={`rounded px-1.5 py-0.5 ${region.normalize ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
							>
								{t("audioRegions.normalize")}
							</button>
							<span className="ml-1 text-white/40">{t("audioRegions.lane")}</span>
							{Array.from({ length: MAX_AUDIO_TRACK_LANES }, (_, lane) => lane).map((lane) => (
								<button
									key={lane}
									type="button"
									onClick={() => onChange(region.id, { trackIndex: lane })}
									className={`h-4 w-4 rounded ${
										(region.trackIndex ?? 0) === lane
											? "bg-brand-500 text-white"
											: "bg-white/10 text-white/50 hover:bg-white/15"
									}`}
								>
									{lane + 1}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
