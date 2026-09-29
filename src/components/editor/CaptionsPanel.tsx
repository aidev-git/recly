import { useState } from "react";
import type { TranscriptionProgress } from "../../../electron/captions/transcribe";
import type {
	AutoCaptionSettings,
	CaptionAnimationStyle,
	CaptionCue,
	CaptionPosition,
} from "../../../electron/project/projectTypes";
import { useI18n } from "@/hooks/useI18n";

type WhisperModelSize = "tiny" | "base" | "small";

interface CaptionsPanelProps {
	captions: CaptionCue[];
	isGenerating: boolean;
	progress: TranscriptionProgress | null;
	modelSize: WhisperModelSize;
	onChangeModelSize: (size: WhisperModelSize) => void;
	captionSettings: AutoCaptionSettings;
	onChangeCaptionSettings: (patch: Partial<AutoCaptionSettings>) => void;
	onGenerate: () => void;
	onChange: (id: string, patch: Partial<CaptionCue>) => void;
	onDelete: (id: string) => void;
	onSeekTo: (sourceMs: number) => void;
}

const MODEL_SIZES: WhisperModelSize[] = ["tiny", "base", "small"];
const MODEL_LABEL_KEYS: Record<WhisperModelSize, string> = {
	tiny: "captions.modelTiny",
	base: "captions.modelBase",
	small: "captions.modelSmall",
};

const LANGUAGES = [
	"auto",
	"english",
	"spanish",
	"french",
	"german",
	"italian",
	"portuguese",
	"dutch",
	"russian",
	"japanese",
	"korean",
	"chinese",
	"arabic",
	"hindi",
];

const POSITIONS: CaptionPosition[] = ["top", "center", "bottom"];
const POSITION_LABEL_KEYS: Record<CaptionPosition, string> = {
	top: "captions.positionTop",
	center: "captions.positionCenter",
	bottom: "captions.positionBottom",
};

const ANIMATION_STYLES: CaptionAnimationStyle[] = ["fade", "pop", "slide-up", "typewriter", "karaoke"];
const ANIMATION_LABEL_KEYS: Record<CaptionAnimationStyle, string> = {
	fade: "captions.animationFade",
	pop: "captions.animationPop",
	"slide-up": "captions.animationSlideUp",
	typewriter: "captions.animationTypewriter",
	karaoke: "captions.animationKaraoke",
};

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2);
}

export function CaptionsPanel({
	captions,
	isGenerating,
	progress,
	modelSize,
	onChangeModelSize,
	captionSettings,
	onChangeCaptionSettings,
	onGenerate,
	onChange,
	onDelete,
	onSeekTo,
}: CaptionsPanelProps) {
	const { t } = useI18n();
	const [showStyling, setShowStyling] = useState(false);

	const progressLabel =
		progress?.phase === "downloading-model"
			? t("captions.downloadingModel", { percent: Math.round(progress.progress) })
			: progress?.phase === "transcribing"
				? t("captions.transcribing")
				: null;

	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("captions.title")}
				</h3>
				<button
					type="button"
					onClick={onGenerate}
					disabled={isGenerating}
					className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{isGenerating ? t("captions.generating") : t("captions.generate")}
				</button>
			</div>

			<div className="flex gap-1.5">
				{MODEL_SIZES.map((size) => (
					<button
						key={size}
						type="button"
						disabled={isGenerating}
						onClick={() => onChangeModelSize(size)}
						className={`flex-1 rounded-md px-2 py-1 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
							modelSize === size
								? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400"
								: "bg-white/5 text-white/50 hover:bg-white/10"
						}`}
					>
						{t(MODEL_LABEL_KEYS[size])}
					</button>
				))}
			</div>
			<p className="text-[10px] text-white/30">{t("captions.modelSizeHint")}</p>

			<label className="flex items-center justify-between text-[10px] text-white/50">
				{t("captions.language")}
				<select
					disabled={isGenerating}
					value={captionSettings.language}
					onChange={(event) => onChangeCaptionSettings({ language: event.target.value })}
					className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white"
				>
					{LANGUAGES.map((language) => (
						<option key={language} value={language}>
							{language === "auto" ? t("captions.languageAuto") : language}
						</option>
					))}
				</select>
			</label>

			{progressLabel && <p className="text-[10px] text-white/40">{progressLabel}</p>}

			<button
				type="button"
				onClick={() => setShowStyling((current) => !current)}
				className="self-start text-[10px] text-brand-200 hover:underline"
			>
				{showStyling ? t("captions.hideStyling") : t("captions.showStyling")}
			</button>

			{showStyling && (
				<div className="flex flex-col gap-2 rounded-lg bg-white/5 p-2">
					<div className="flex gap-1.5">
						{POSITIONS.map((position) => (
							<button
								key={position}
								type="button"
								onClick={() => onChangeCaptionSettings({ position })}
								className={`flex-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
									captionSettings.position === position
										? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400"
										: "bg-white/5 text-white/50 hover:bg-white/10"
								}`}
							>
								{t(POSITION_LABEL_KEYS[position])}
							</button>
						))}
					</div>
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.offset")}</span>
							<span className="text-white/30">{Math.round(captionSettings.positionOffsetNorm * 100)}%</span>
						</span>
						<input
							type="range"
							min={0}
							max={0.3}
							step={0.01}
							value={captionSettings.positionOffsetNorm}
							onChange={(event) => onChangeCaptionSettings({ positionOffsetNorm: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.maxWidth")}</span>
							<span className="text-white/30">{Math.round(captionSettings.maxWidthNorm * 100)}%</span>
						</span>
						<input
							type="range"
							min={0.3}
							max={1}
							step={0.02}
							value={captionSettings.maxWidthNorm}
							onChange={(event) => onChangeCaptionSettings({ maxWidthNorm: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.maxRows")}</span>
							<span className="text-white/30">{captionSettings.maxRows}</span>
						</span>
						<input
							type="range"
							min={1}
							max={4}
							step={1}
							value={captionSettings.maxRows}
							onChange={(event) => onChangeCaptionSettings({ maxRows: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.fontSize")}</span>
							<span className="text-white/30">
								{captionSettings.fontSizePx === 0 ? t("captions.fontSizeAuto") : `${captionSettings.fontSizePx}px`}
							</span>
						</span>
						<input
							type="range"
							min={0}
							max={64}
							step={2}
							value={captionSettings.fontSizePx}
							onChange={(event) => onChangeCaptionSettings({ fontSizePx: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
					<div className="flex gap-1.5">
						{ANIMATION_STYLES.map((style) => (
							<button
								key={style}
								type="button"
								onClick={() => onChangeCaptionSettings({ animationStyle: style })}
								className={`flex-1 rounded-md px-1.5 py-1 text-[9px] transition-colors ${
									captionSettings.animationStyle === style
										? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400"
										: "bg-white/5 text-white/50 hover:bg-white/10"
								}`}
							>
								{t(ANIMATION_LABEL_KEYS[style])}
							</button>
						))}
					</div>
					{captionSettings.animationStyle === "karaoke" && (
						<p className="text-[9px] text-white/30">{t("captions.karaokeHint")}</p>
					)}
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.boxRadius")}</span>
							<span className="text-white/30">{captionSettings.boxRadius}px</span>
						</span>
						<input
							type="range"
							min={0}
							max={24}
							step={1}
							value={captionSettings.boxRadius}
							onChange={(event) => onChangeCaptionSettings({ boxRadius: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
					<div className="flex items-center gap-3">
						<label className="flex items-center gap-1.5 text-[10px] text-white/50">
							{t("captions.textColor")}
							<input
								type="color"
								value={captionSettings.textColor}
								onChange={(event) => onChangeCaptionSettings({ textColor: event.target.value })}
								className="h-6 w-8 rounded border border-white/15 bg-transparent"
							/>
						</label>
						<label className="flex items-center gap-1.5 text-[10px] text-white/50">
							{t("captions.backgroundColor")}
							<input
								type="color"
								value={captionSettings.backgroundColor}
								onChange={(event) => onChangeCaptionSettings({ backgroundColor: event.target.value })}
								className="h-6 w-8 rounded border border-white/15 bg-transparent"
							/>
						</label>
					</div>
					<label className="flex flex-col gap-1 text-[10px] text-white/50">
						<span className="flex justify-between">
							<span>{t("captions.backgroundOpacity")}</span>
							<span className="text-white/30">{Math.round(captionSettings.backgroundOpacity * 100)}%</span>
						</span>
						<input
							type="range"
							min={0}
							max={1}
							step={0.05}
							value={captionSettings.backgroundOpacity}
							onChange={(event) => onChangeCaptionSettings({ backgroundOpacity: Number(event.target.value) })}
							className="accent-brand-500"
						/>
					</label>
				</div>
			)}

			{!isGenerating && captions.length === 0 && (
				<p className="text-[11px] text-white/40">{t("captions.empty")}</p>
			)}

			<div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
				{captions.map((cue) => (
					<div key={cue.id} className="flex flex-col gap-1 rounded-lg bg-white/5 p-1.5 text-[10px]">
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => onSeekTo(cue.startMs)}
								className="text-brand-200 hover:underline"
							>
								{formatSeconds(cue.startMs)}s
							</button>
							<span className="text-white/30">–</span>
							<span className="text-white/40">{formatSeconds(cue.endMs)}s</span>
							<button
								type="button"
								onClick={() => onDelete(cue.id)}
								className="ml-auto text-red-300 hover:text-red-200"
							>
								✕
							</button>
						</div>
						<input
							type="text"
							value={cue.text}
							onChange={(event) => onChange(cue.id, { text: event.target.value })}
							className="rounded border border-white/15 bg-white/5 px-1.5 py-1 text-white"
						/>
					</div>
				))}
			</div>
		</div>
	);
}
