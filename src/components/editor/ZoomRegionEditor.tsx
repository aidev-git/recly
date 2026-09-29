import type { ZoomDepth, ZoomRegion, ZoomTransitionEasing } from "../../../electron/project/projectTypes";
import { useI18n } from "@/hooks/useI18n";

interface ZoomRegionEditorProps {
	regions: ZoomRegion[];
	selectedRegionId: string | null;
	onSelectRegion: (id: string) => void;
	hasCursorTelemetry: boolean;
	onAutoDetect: () => void;
	onAddAtPlayhead: () => void;
	onChangeRegion: (id: string, patch: Partial<ZoomRegion>) => void;
	onDeleteRegion: (id: string) => void;
	onSeekTo: (sourceMs: number) => void;
}

const DEPTHS: ZoomDepth[] = [1, 2, 3, 4, 5, 6];
const EASING_OPTIONS: ZoomTransitionEasing[] = ["linear", "glide", "smooth", "snappy", "signature"];

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2);
}

export function ZoomRegionEditor({
	regions,
	selectedRegionId,
	onSelectRegion,
	hasCursorTelemetry,
	onAutoDetect,
	onAddAtPlayhead,
	onChangeRegion,
	onDeleteRegion,
	onSeekTo,
}: ZoomRegionEditorProps) {
	const { t } = useI18n();
	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("editor.zoomRegions")}
				</h3>
				<div className="flex gap-1.5">
					<button
						type="button"
						onClick={onAutoDetect}
						disabled={!hasCursorTelemetry}
						className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
						title={hasCursorTelemetry ? undefined : t("editor.noTelemetry")}
					>
						{t("editor.autoDetect")}
					</button>
					<button
						type="button"
						onClick={onAddAtPlayhead}
						className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/15"
					>
						{t("editor.addRegion")}
					</button>
				</div>
			</div>

			{regions.length === 0 && (
				<p className="text-[11px] text-white/40">{t("editor.noZoomRegions")}</p>
			)}

			<div className="flex flex-col gap-1.5">
				{regions.map((region) => (
					<div
						key={region.id}
						onClick={() => onSelectRegion(region.id)}
						className={`flex flex-col gap-1.5 rounded-lg p-1.5 text-[10px] ${
							region.id === selectedRegionId ? "bg-brand-500/15 ring-1 ring-brand-400" : "bg-white/5"
						}`}
					>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onSeekTo(region.startMs);
								}}
								className="text-brand-200 hover:underline"
							>
								{formatSeconds(region.startMs)}s
							</button>
							<span className="text-white/30">–</span>
							<input
								type="number"
								step={0.1}
								value={formatSeconds(region.endMs)}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									onChangeRegion(region.id, { endMs: Number(event.target.value) * 1000 })
								}
								className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
							/>
							<span className="text-white/30">s</span>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onDeleteRegion(region.id);
								}}
								className="ml-auto text-red-300 hover:text-red-200"
							>
								✕
							</button>
						</div>

						<div className="flex items-center gap-1">
							<span className="text-white/40">{t("zoomRegion.depth")}</span>
							{DEPTHS.map((depth) => (
								<button
									key={depth}
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										onChangeRegion(region.id, { depth });
									}}
									className={`h-4 w-4 rounded transition-colors ${
										region.depth === depth
											? "bg-brand-500 text-white"
											: "bg-white/10 text-white/50 hover:bg-white/15"
									}`}
								>
									{depth}
								</button>
							))}
						</div>

						<div className="flex items-center gap-1">
							<span className="text-white/40">{t("zoomRegion.easingIn")}</span>
							<select
								value={region.easingIn}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									onChangeRegion(region.id, { easingIn: event.target.value as ZoomTransitionEasing })
								}
								className="rounded border border-white/15 bg-brand-950 px-1 py-0.5 text-white/70"
							>
								{EASING_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
							<input
								type="number"
								min={0}
								max={2000}
								step={50}
								value={region.durationInMs}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									onChangeRegion(region.id, { durationInMs: Number(event.target.value) })
								}
								className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
							/>
							<span className="text-white/40">{t("zoomRegion.easingOut")}</span>
							<select
								value={region.easingOut}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									onChangeRegion(region.id, { easingOut: event.target.value as ZoomTransitionEasing })
								}
								className="rounded border border-white/15 bg-brand-950 px-1 py-0.5 text-white/70"
							>
								{EASING_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
							<input
								type="number"
								min={0}
								max={2000}
								step={50}
								value={region.durationOutMs}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									onChangeRegion(region.id, { durationOutMs: Number(event.target.value) })
								}
								className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
