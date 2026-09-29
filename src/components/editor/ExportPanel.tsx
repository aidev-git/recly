import type {
	ExportFormat,
	ExportGifFrameRate,
	ExportGifSizePreset,
	ExportMp4FrameRate,
	ExportQuality,
} from "../../../electron/export/exportMedia";
import { useI18n } from "@/hooks/useI18n";

export type ExportEncoderBackend = "legacy" | "modern";

interface ExportMetrics {
	durationMs: number;
	fileSizeBytes: number;
}

interface ExportPanelProps {
	format: ExportFormat;
	quality: ExportQuality;
	mp4FrameRate: ExportMp4FrameRate;
	gifFrameRate: ExportGifFrameRate;
	gifSizePreset: ExportGifSizePreset;
	gifLoop: boolean;
	encoderBackend: ExportEncoderBackend;
	onChangeEncoderBackend: (backend: ExportEncoderBackend) => void;
	onChangeFormat: (format: ExportFormat) => void;
	onChangeQuality: (quality: ExportQuality) => void;
	onChangeMp4FrameRate: (frameRate: ExportMp4FrameRate) => void;
	onChangeGifFrameRate: (frameRate: ExportGifFrameRate) => void;
	onChangeGifSizePreset: (preset: ExportGifSizePreset) => void;
	onChangeGifLoop: (loop: boolean) => void;
	hasCaptions: boolean;
	includeCaptionSidecar: boolean;
	onChangeIncludeCaptionSidecar: (value: boolean) => void;
	isExporting: boolean;
	exportedPath: string | null;
	metrics: ExportMetrics | null;
	onExport: () => void;
	onReveal: () => void;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

const QUALITY_OPTIONS: ExportQuality[] = ["medium", "good", "high", "source"];
const MP4_FRAME_RATES: ExportMp4FrameRate[] = [24, 30, 60];
const GIF_FRAME_RATES: ExportGifFrameRate[] = [15, 20, 25, 30];
const GIF_SIZE_PRESETS: ExportGifSizePreset[] = ["medium", "large", "original"];

const QUALITY_LABEL_KEYS: Record<ExportQuality, string> = {
	medium: "exportQuality.medium",
	good: "exportQuality.good",
	high: "exportQuality.high",
	source: "exportQuality.source",
};

const GIF_SIZE_LABEL_KEYS: Record<ExportGifSizePreset, string> = {
	medium: "exportGifSize.medium",
	large: "exportGifSize.large",
	original: "exportGifSize.original",
};

export function ExportPanel({
	format,
	quality,
	mp4FrameRate,
	gifFrameRate,
	gifSizePreset,
	gifLoop,
	encoderBackend,
	onChangeEncoderBackend,
	onChangeFormat,
	onChangeQuality,
	onChangeMp4FrameRate,
	onChangeGifFrameRate,
	onChangeGifSizePreset,
	onChangeGifLoop,
	hasCaptions,
	includeCaptionSidecar,
	onChangeIncludeCaptionSidecar,
	isExporting,
	exportedPath,
	metrics,
	onExport,
	onReveal,
}: ExportPanelProps) {
	const { t } = useI18n();
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
			<div className="flex gap-2">
				{(["mp4", "gif"] as const).map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => onChangeFormat(option)}
						className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
							format === option
								? "bg-brand-500 text-white"
								: "bg-white/5 text-white/60 hover:bg-white/10"
						}`}
					>
						{option}
					</button>
				))}
			</div>

			{format === "mp4" ? (
				<>
					<div className="flex gap-2">
						{QUALITY_OPTIONS.map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => onChangeQuality(option)}
								className={`flex-1 rounded-lg px-3 py-1.5 text-xs capitalize transition-colors ${
									quality === option
										? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
										: "bg-white/5 text-white/60 hover:bg-white/10"
								}`}
							>
								{t(QUALITY_LABEL_KEYS[option])}
							</button>
						))}
					</div>

					<label className="flex items-center justify-between text-xs text-white/60">
						{t("exportPanel.frameRate")}
						<div className="flex gap-1">
							{MP4_FRAME_RATES.map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => onChangeMp4FrameRate(option)}
									className={`rounded-md px-2 py-1 text-xs transition-colors ${
										mp4FrameRate === option
											? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
											: "bg-white/5 text-white/60 hover:bg-white/10"
									}`}
								>
									{option}
								</button>
							))}
						</div>
					</label>

					<label className="flex items-center justify-between text-xs text-white/60">
						<span className="flex flex-col">
							{t("exportPanel.encoderBackend")}
							<span className="text-[10px] text-white/40">
								{encoderBackend === "modern"
									? t("exportPanel.encoderBackendModernHint")
									: t("exportPanel.encoderBackendLegacyHint")}
							</span>
						</span>
						<div className="flex gap-1">
							{(["legacy", "modern"] as const).map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => onChangeEncoderBackend(option)}
									className={`rounded-md px-2 py-1 text-xs capitalize transition-colors ${
										encoderBackend === option
											? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
											: "bg-white/5 text-white/60 hover:bg-white/10"
									}`}
								>
									{t(option === "modern" ? "exportPanel.modern" : "exportPanel.legacy")}
								</button>
							))}
						</div>
					</label>
				</>
			) : (
				<>
					<label className="flex items-center justify-between text-xs text-white/60">
						{t("exportPanel.frameRate")}
						<div className="flex gap-1">
							{GIF_FRAME_RATES.map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => onChangeGifFrameRate(option)}
									className={`rounded-md px-2 py-1 text-xs transition-colors ${
										gifFrameRate === option
											? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
											: "bg-white/5 text-white/60 hover:bg-white/10"
									}`}
								>
									{option}
								</button>
							))}
						</div>
					</label>

					<div className="flex gap-2">
						{GIF_SIZE_PRESETS.map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => onChangeGifSizePreset(option)}
								className={`flex-1 rounded-lg px-3 py-1.5 text-xs capitalize transition-colors ${
									gifSizePreset === option
										? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
										: "bg-white/5 text-white/60 hover:bg-white/10"
								}`}
							>
								{t(GIF_SIZE_LABEL_KEYS[option])}
							</button>
						))}
					</div>

					<label className="flex items-center justify-between text-xs text-white/60">
						{t("exportPanel.loop")}
						<button
							type="button"
							onClick={() => onChangeGifLoop(!gifLoop)}
							className={`relative h-4 w-7 rounded-full transition-colors ${gifLoop ? "bg-brand-500" : "bg-white/15"}`}
						>
							<span
								className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
									gifLoop ? "translate-x-3.5" : "translate-x-0.5"
								}`}
							/>
						</button>
					</label>
				</>
			)}

			{hasCaptions && (
				<label className="flex items-center justify-between text-xs text-white/60">
					<span className="flex flex-col">
						{t("exportPanel.captionSidecar")}
						<span className="text-[10px] text-white/40">{t("exportPanel.captionSidecarHint")}</span>
					</span>
					<button
						type="button"
						onClick={() => onChangeIncludeCaptionSidecar(!includeCaptionSidecar)}
						className={`relative h-4 w-7 rounded-full transition-colors ${includeCaptionSidecar ? "bg-brand-500" : "bg-white/15"}`}
					>
						<span
							className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
								includeCaptionSidecar ? "translate-x-3.5" : "translate-x-0.5"
							}`}
						/>
					</button>
				</label>
			)}

			<button
				type="button"
				onClick={onExport}
				disabled={isExporting}
				className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-brand-glow transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isExporting ? t("editor.exporting") : t("editor.export")}
			</button>

			{exportedPath && !isExporting && (
				<>
					<button
						type="button"
						onClick={onReveal}
						className="truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
					>
						{t("recorder.savedTo", { path: exportedPath })}
					</button>
					{metrics && (
						<p className="text-[10px] text-white/40">
							{t("exportPanel.metrics", {
								duration: formatDuration(metrics.durationMs),
								size: formatBytes(metrics.fileSizeBytes),
							})}
						</p>
					)}
				</>
			)}
		</div>
	);
}
