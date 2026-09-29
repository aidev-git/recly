import { useCallback, useRef, useState } from "react";
import type { AudioRegion, CaptionCue, ClipRegion, ZoomRegion } from "../../../electron/project/projectTypes";
import { resolveSequencePosition } from "../../../electron/project/projectTypes";
import { sourceTimeToSequenceMs } from "@/lib/sequenceTime";
import { useI18n } from "@/hooks/useI18n";

interface MultiTrackTimelineProps {
	totalDurationMs: number;
	playheadMs: number;
	onSeek: (sequenceMs: number) => void;

	clips: ClipRegion[];
	selectedClipId: string | null;
	onSelectClip: (id: string) => void;
	onReorderClips: (fromIndex: number, toIndex: number) => void;

	zoomRegions: ZoomRegion[];
	selectedZoomRegionId: string | null;
	onSelectZoomRegion: (id: string) => void;
	onChangeZoomRegion: (id: string, patch: Partial<ZoomRegion>) => void;
	onCreateZoomRegion: (startMs: number, endMs: number) => void;
	waveformPeaks?: number[] | null;

	audioRegions: AudioRegion[];
	onChangeAudioRegion: (id: string, patch: Partial<AudioRegion>) => void;

	captions: CaptionCue[];
	selectedCaptionId: string | null;
	onSelectCaption: (id: string) => void;
	onChangeCaption: (id: string, patch: Partial<CaptionCue>) => void;
}

const ZOOM_LEVELS = [1, 2, 4, 8];
const MIN_ZOOM_REGION_SEQ_MS = 200;
const MIN_AUDIO_REGION_MS = 200;
const MIN_CAPTION_SEQ_MS = 150;

function formatClock(ms: number): string {
	const totalSeconds = Math.max(0, ms) / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = (totalSeconds % 60).toFixed(1).padStart(4, "0");
	return `${minutes}:${seconds}`;
}

export function MultiTrackTimeline({
	totalDurationMs,
	playheadMs,
	onSeek,
	clips,
	selectedClipId,
	onSelectClip,
	onReorderClips,
	zoomRegions,
	selectedZoomRegionId,
	onSelectZoomRegion,
	onChangeZoomRegion,
	onCreateZoomRegion,
	waveformPeaks,
	audioRegions,
	onChangeAudioRegion,
	captions,
	selectedCaptionId,
	onSelectCaption,
	onChangeCaption,
}: MultiTrackTimelineProps) {
	const { t } = useI18n();
	const trackRef = useRef<HTMLDivElement>(null);
	const [zoomLevel, setZoomLevel] = useState(1);
	const [dragOverClipIndex, setDragOverClipIndex] = useState<number | null>(null);

	const msFromClientX = useCallback(
		(clientX: number) => {
			const track = trackRef.current;
			if (!track || totalDurationMs === 0) return 0;
			const rect = track.getBoundingClientRect();
			const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
			return ratio * totalDurationMs;
		},
		[totalDurationMs],
	);

	const beginPointerDrag = useCallback((onMove: (sequenceMs: number) => void) => {
		return (downEvent: React.PointerEvent) => {
			downEvent.stopPropagation();
			const handleMove = (moveEvent: PointerEvent) => onMove(msFromClientX(moveEvent.clientX));
			const handleUp = () => {
				window.removeEventListener("pointermove", handleMove);
				window.removeEventListener("pointerup", handleUp);
			};
			window.addEventListener("pointermove", handleMove);
			window.addEventListener("pointerup", handleUp);
		};
	}, [msFromClientX]);

	const pct = (ms: number) => (totalDurationMs === 0 ? 0 : (ms / totalDurationMs) * 100);

	// --- Clips lane: cumulative output-time layout -----------------------------
	let cumulativeMs = 0;
	const clipLayout = clips.map((clip) => {
		const outputDuration = (clip.sourceEndMs - clip.sourceStartMs) / clip.speed;
		const layout = { clip, startMs: cumulativeMs, endMs: cumulativeMs + outputDuration };
		cumulativeMs += outputDuration;
		return layout;
	});

	// --- Zoom lane: convert each region's source-time bounds to sequence-time ---
	const zoomLayout = zoomRegions
		.map((region) => {
			const startMs = sourceTimeToSequenceMs(clips, region.startMs);
			const endMs = sourceTimeToSequenceMs(clips, region.endMs);
			if (startMs === null || endMs === null) return null;
			return { region, startMs, endMs };
		})
		.filter((entry): entry is { region: ZoomRegion; startMs: number; endMs: number } => entry !== null);

	const dragZoomRegionBody = (region: ZoomRegion, layoutStartMs: number, layoutEndMs: number) => {
		const spanMs = layoutEndMs - layoutStartMs;
		return beginPointerDrag((sequenceMs) => {
			onSelectZoomRegion(region.id);
			const nextStartSeq = Math.max(0, Math.min(totalDurationMs - spanMs, sequenceMs - spanMs / 2));
			const nextEndSeq = nextStartSeq + spanMs;
			const nextStartSource = resolveSequencePosition(clips, nextStartSeq)?.sourceTimeMs;
			const nextEndSource = resolveSequencePosition(clips, nextEndSeq)?.sourceTimeMs;
			if (nextStartSource === undefined || nextEndSource === undefined) return;
			onChangeZoomRegion(region.id, { startMs: nextStartSource, endMs: nextEndSource });
		});
	};

	const dragZoomRegionEdge = (region: ZoomRegion, edge: "start" | "end") => {
		return beginPointerDrag((sequenceMs) => {
			onSelectZoomRegion(region.id);
			const resolved = resolveSequencePosition(clips, sequenceMs);
			if (!resolved) return;
			if (edge === "start") {
				const maxStartSeq = (sourceTimeToSequenceMs(clips, region.endMs) ?? totalDurationMs) - MIN_ZOOM_REGION_SEQ_MS;
				const clampedSeq = Math.min(sequenceMs, Math.max(0, maxStartSeq));
				const clampedSource = resolveSequencePosition(clips, clampedSeq)?.sourceTimeMs;
				if (clampedSource !== undefined) onChangeZoomRegion(region.id, { startMs: clampedSource });
			} else {
				const minEndSeq = (sourceTimeToSequenceMs(clips, region.startMs) ?? 0) + MIN_ZOOM_REGION_SEQ_MS;
				const clampedSeq = Math.max(sequenceMs, minEndSeq);
				const clampedSource = resolveSequencePosition(clips, clampedSeq)?.sourceTimeMs;
				if (clampedSource !== undefined) onChangeZoomRegion(region.id, { endMs: clampedSource });
			}
		});
	};

	// --- Captions lane: also source-time native, converted like zoom regions ---
	const captionLayout = captions
		.map((cue) => {
			const startMs = sourceTimeToSequenceMs(clips, cue.startMs);
			const endMs = sourceTimeToSequenceMs(clips, cue.endMs);
			if (startMs === null || endMs === null) return null;
			return { cue, startMs, endMs };
		})
		.filter((entry): entry is { cue: CaptionCue; startMs: number; endMs: number } => entry !== null);

	const dragCaptionBody = (cue: CaptionCue, layoutStartMs: number, layoutEndMs: number) => {
		const spanMs = layoutEndMs - layoutStartMs;
		return beginPointerDrag((sequenceMs) => {
			onSelectCaption(cue.id);
			const nextStartSeq = Math.max(0, Math.min(totalDurationMs - spanMs, sequenceMs - spanMs / 2));
			const nextEndSeq = nextStartSeq + spanMs;
			const nextStartSource = resolveSequencePosition(clips, nextStartSeq)?.sourceTimeMs;
			const nextEndSource = resolveSequencePosition(clips, nextEndSeq)?.sourceTimeMs;
			if (nextStartSource === undefined || nextEndSource === undefined) return;
			onChangeCaption(cue.id, { startMs: nextStartSource, endMs: nextEndSource });
		});
	};

	const dragCaptionEdge = (cue: CaptionCue, edge: "start" | "end") => {
		return beginPointerDrag((sequenceMs) => {
			onSelectCaption(cue.id);
			if (edge === "start") {
				const maxStartSeq = (sourceTimeToSequenceMs(clips, cue.endMs) ?? totalDurationMs) - MIN_CAPTION_SEQ_MS;
				const clampedSeq = Math.min(sequenceMs, Math.max(0, maxStartSeq));
				const clampedSource = resolveSequencePosition(clips, clampedSeq)?.sourceTimeMs;
				if (clampedSource !== undefined) onChangeCaption(cue.id, { startMs: clampedSource });
			} else {
				const minEndSeq = (sourceTimeToSequenceMs(clips, cue.startMs) ?? 0) + MIN_CAPTION_SEQ_MS;
				const clampedSeq = Math.max(sequenceMs, minEndSeq);
				const clampedSource = resolveSequencePosition(clips, clampedSeq)?.sourceTimeMs;
				if (clampedSource !== undefined) onChangeCaption(cue.id, { endMs: clampedSource });
			}
		});
	};

	// --- Audio lane: already sequence-time native -------------------------------
	const laneCount = Math.max(1, ...audioRegions.map((region) => (region.trackIndex ?? 0) + 1));
	const audioLanes: AudioRegion[][] = Array.from({ length: laneCount }, (_, lane) =>
		audioRegions.filter((region) => (region.trackIndex ?? 0) === lane),
	);

	const dragAudioRegionBody = (region: AudioRegion) => {
		const spanMs = region.durationMs;
		return beginPointerDrag((sequenceMs) => {
			const nextStart = Math.max(0, Math.min(totalDurationMs - spanMs, sequenceMs - spanMs / 2));
			onChangeAudioRegion(region.id, { startMs: Math.round(nextStart) });
		});
	};

	const dragAudioRegionEdge = (region: AudioRegion) => {
		return beginPointerDrag((sequenceMs) => {
			const nextDuration = Math.max(MIN_AUDIO_REGION_MS, sequenceMs - region.startMs);
			onChangeAudioRegion(region.id, { durationMs: Math.round(nextDuration) });
		});
	};

	const handleTrackClick = (event: React.MouseEvent) => {
		onSeek(msFromClientX(event.clientX));
	};

	const handleZoomLaneDoubleClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		const sequenceMs = msFromClientX(event.clientX);
		const sourceMs = resolveSequencePosition(clips, sequenceMs)?.sourceTimeMs;
		if (sourceMs === undefined) return;
		onCreateZoomRegion(Math.max(0, sourceMs - 1000), sourceMs + 1000);
	};

	const rulerTicks = Array.from({ length: 11 }, (_, index) => (index / 10) * totalDurationMs);

	return (
		<div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-3">
			<div className="flex items-center justify-between">
				<h3 className="text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("timeline.title")}
				</h3>
				<div className="flex gap-1">
					{ZOOM_LEVELS.map((level) => (
						<button
							key={level}
							type="button"
							onClick={() => setZoomLevel(level)}
							className={`rounded px-1.5 py-0.5 text-[10px] ${
								zoomLevel === level ? "bg-brand-500 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"
							}`}
						>
							{level}x
						</button>
					))}
				</div>
			</div>

			<div className="overflow-x-auto">
				<div
					ref={trackRef}
					className="relative flex flex-col gap-1"
					style={{ width: `${zoomLevel * 100}%`, minWidth: "100%" }}
				>
					{/* Shared ruler */}
					<div className="relative h-4 text-[9px] text-white/40">
						{rulerTicks.map((ms, index) => (
							<span
								key={index}
								className="absolute -translate-x-1/2"
								style={{ left: `${pct(ms)}%` }}
							>
								{formatClock(ms)}
							</span>
						))}
					</div>

					{/* Shared playhead spans all lanes */}
					<div
						className="pointer-events-none absolute top-4 z-20 h-[calc(100%-1rem)] w-0.5 bg-white"
						style={{ left: `${pct(playheadMs)}%` }}
					/>

					{/* Clips lane */}
					<div
						onClick={handleTrackClick}
						className="relative flex h-8 gap-0.5 overflow-hidden rounded-lg bg-black/40"
					>
						{clipLayout.map(({ clip, startMs, endMs }, index) => (
							<div
								key={clip.id}
								draggable
								onDragStart={(event) => {
									event.dataTransfer.setData("text/plain", String(index));
								}}
								onDragOver={(event) => {
									event.preventDefault();
									setDragOverClipIndex(index);
								}}
								onDragLeave={() => setDragOverClipIndex((current) => (current === index ? null : current))}
								onDrop={(event) => {
									event.preventDefault();
									setDragOverClipIndex(null);
									const fromIndex = Number(event.dataTransfer.getData("text/plain"));
									if (!Number.isNaN(fromIndex) && fromIndex !== index) onReorderClips(fromIndex, index);
								}}
								onClick={(event) => {
									event.stopPropagation();
									onSelectClip(clip.id);
								}}
								style={{ left: `${pct(startMs)}%`, width: `${pct(endMs - startMs)}%` }}
								className={`absolute top-0 flex h-8 cursor-grab items-center justify-center truncate rounded-md text-[10px] transition-colors active:cursor-grabbing ${
									clip.id === selectedClipId
										? "bg-brand-500/40 text-white ring-1 ring-brand-300"
										: "bg-white/10 text-white/60 hover:bg-white/15"
								} ${dragOverClipIndex === index ? "ring-2 ring-brand-200" : ""}`}
							>
								{clip.speed !== 1 ? `${clip.speed}x` : ""}
							</div>
						))}
					</div>

					{/* Zoom lane (with waveform) */}
					<div
						onClick={handleTrackClick}
						onDoubleClick={handleZoomLaneDoubleClick}
						title={t("timeline.zoomLaneHint")}
						className="relative h-8 cursor-pointer overflow-hidden rounded-lg bg-black/40"
					>
						{waveformPeaks && waveformPeaks.length > 0 && (
							<div className="pointer-events-none absolute inset-0 flex items-center gap-px overflow-hidden px-0.5">
								{waveformPeaks.map((peak, index) => (
									<div
										key={index}
										className="flex-1 rounded-sm bg-white/20"
										style={{ height: `${Math.max(8, peak * 100)}%` }}
									/>
								))}
							</div>
						)}
						{zoomLayout.map(({ region, startMs, endMs }) => (
							<div
								key={region.id}
								onPointerDown={dragZoomRegionBody(region, startMs, endMs)}
								onClick={(event) => {
									event.stopPropagation();
									onSelectZoomRegion(region.id);
								}}
								style={{ left: `${pct(startMs)}%`, width: `${pct(endMs - startMs)}%` }}
								className={`absolute top-0.5 h-7 cursor-grab rounded-md transition-colors active:cursor-grabbing ${
									region.id === selectedZoomRegionId
										? "bg-brand-500/50 ring-1 ring-brand-300"
										: "bg-brand-500/25 hover:bg-brand-500/35"
								}`}
							>
								<div
									onPointerDown={dragZoomRegionEdge(region, "start")}
									className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize"
								/>
								<div
									onPointerDown={dragZoomRegionEdge(region, "end")}
									className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
								/>
							</div>
						))}
					</div>

					{/* Audio lanes — one row per distinct trackIndex, so overlapping regions
						(e.g. background music + a sound effect) don't visually collide. */}
					{audioLanes.map((laneRegions, laneIndex) => (
						<div
							key={laneIndex}
							onClick={handleTrackClick}
							className="relative h-8 overflow-hidden rounded-lg bg-black/40"
						>
							{laneRegions.map((region) => (
								<div
									key={region.id}
									onPointerDown={dragAudioRegionBody(region)}
									onClick={(event) => event.stopPropagation()}
									style={{ left: `${pct(region.startMs)}%`, width: `${pct(region.durationMs)}%` }}
									className="absolute top-0.5 h-7 cursor-grab truncate rounded-md bg-emerald-500/25 px-1.5 text-[9px] leading-7 text-emerald-100 transition-colors hover:bg-emerald-500/35 active:cursor-grabbing"
								>
									{region.filePath.split(/[\\/]/).pop()}
									<div
										onPointerDown={dragAudioRegionEdge(region)}
										className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
									/>
								</div>
							))}
						</div>
					))}

					{/* Captions lane */}
					<div
						onClick={handleTrackClick}
						className="relative h-8 overflow-hidden rounded-lg bg-black/40"
					>
						{captionLayout.map(({ cue, startMs, endMs }) => (
							<div
								key={cue.id}
								onPointerDown={dragCaptionBody(cue, startMs, endMs)}
								onClick={(event) => {
									event.stopPropagation();
									onSelectCaption(cue.id);
								}}
								style={{ left: `${pct(startMs)}%`, width: `${pct(endMs - startMs)}%` }}
								className={`absolute top-0.5 h-7 cursor-grab truncate rounded-md px-1.5 text-[9px] leading-7 transition-colors active:cursor-grabbing ${
									cue.id === selectedCaptionId
										? "bg-amber-500/50 text-white ring-1 ring-amber-300"
										: "bg-amber-500/25 text-amber-100 hover:bg-amber-500/35"
								}`}
							>
								{cue.text}
								<div
									onPointerDown={dragCaptionEdge(cue, "start")}
									className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize"
								/>
								<div
									onPointerDown={dragCaptionEdge(cue, "end")}
									className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
