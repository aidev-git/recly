import type {
	Annotation,
	BackgroundChoice,
	CropRegion,
	FramePadding,
} from "../../../electron/project/projectTypes";
import { MAX_FRAME_PADDING_PX } from "../../../electron/project/projectTypes";
import type { CropAspect } from "@/lib/compositor";
import { useI18n } from "@/hooks/useI18n";
import { backgroundSwatchStyle, BACKGROUND_LABEL_KEYS } from "@/lib/backgroundLabels";
import { CropControl } from "@/components/CropControl";

interface AnnotationToolbarProps {
	placingType: Annotation["type"] | null;
	onSelectTool: (type: Annotation["type"] | null) => void;
	background: BackgroundChoice;
	onChangeBackground: (background: BackgroundChoice) => void;
	onChooseCustomBackground: () => void;
	onChooseCustomBackgroundVideo: () => void;
	customBackgroundColor: string;
	onChangeBackgroundColor: (color: string) => void;
	backgroundBlur: number;
	onChangeBackgroundBlur: (blur: number) => void;
	cropAspect: CropAspect;
	onChangeCropAspect: (aspect: CropAspect) => void;
	cropRegion: CropRegion;
	onChangeCropRegion: (region: CropRegion) => void;
	cropPreviewSrc: string | null;
	frameShadowEnabled: boolean;
	onToggleFrameShadow: () => void;
	frameRadius: number;
	onChangeFrameRadius: (radius: number) => void;
	framePadding: FramePadding;
	onChangeFramePadding: (padding: FramePadding) => void;
	customFontFamily: string | null;
	onChooseCustomFont: () => void;
}

export const ANNOTATION_TOOLS: Annotation["type"][] = [
	"arrow",
	"rect",
	"highlight",
	"blur",
	"text",
	"figure",
	"image",
];
const TOOLS = ANNOTATION_TOOLS;
const BACKGROUNDS: BackgroundChoice[] = [
	"none",
	"violet",
	"midnight",
	"sunset",
	"aurora",
	"coral",
	"forest",
	"ocean",
	"ember",
	"lavender",
	"steel",
	"rose",
	"citrus",
	"mint",
	"plum",
	"slate",
	"gold",
	"arctic",
	"berry",
	"indigo",
	"teal",
	"crimson",
	"amber",
	"jade",
	"sapphire",
	"copper",
	"orchid",
	"fern",
	"dusk",
	"flame",
	"glacier",
	"custom",
	"color",
	"video",
];
const CROPS: CropAspect[] = ["full", "16:9", "1:1", "custom"];

export function AnnotationToolbar({
	placingType,
	onSelectTool,
	background,
	onChangeBackground,
	onChooseCustomBackground,
	onChooseCustomBackgroundVideo,
	customBackgroundColor,
	onChangeBackgroundColor,
	backgroundBlur,
	onChangeBackgroundBlur,
	cropAspect,
	onChangeCropAspect,
	cropRegion,
	onChangeCropRegion,
	cropPreviewSrc,
	frameShadowEnabled,
	onToggleFrameShadow,
	frameRadius,
	onChangeFrameRadius,
	framePadding,
	onChangeFramePadding,
	customFontFamily,
	onChooseCustomFont,
}: AnnotationToolbarProps) {
	const { t } = useI18n();
	const handleBackgroundClick = (option: BackgroundChoice) => {
		if (option === "custom") onChooseCustomBackground();
		else if (option === "video") onChooseCustomBackgroundVideo();
		else onChangeBackground(option);
	};

	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
			<div>
				<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("editor.annotate")}
				</h3>
				<div className="grid grid-cols-3 gap-1.5">
					{TOOLS.map((type) => (
						<button
							key={type}
							type="button"
							onClick={() => onSelectTool(placingType === type ? null : type)}
							className={`rounded-lg px-3 py-1.5 text-xs capitalize transition-colors ${
								placingType === type
									? "bg-brand-500 text-white"
									: "bg-white/5 text-white/60 hover:bg-white/10"
							}`}
						>
							{type}
						</button>
					))}
				</div>
				{placingType && (
					<p className="mt-1.5 text-[11px] text-white/50">
						{placingType === "text" ? t("editor.clickToPlaceText") : t("editor.dragToPlace")}
					</p>
				)}
				{TOOLS.includes("text") && (
					<button
						type="button"
						onClick={onChooseCustomFont}
						className="mt-1.5 w-full truncate rounded-lg bg-white/5 px-2 py-1.5 text-[10px] text-white/60 hover:bg-white/10"
					>
						{customFontFamily ? t("editor.fontLoaded", { font: customFontFamily }) : t("editor.chooseFont")}
					</button>
				)}
			</div>

			<div>
				<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("settingsPanel.background")}
				</h3>
				<div className="grid grid-cols-6 gap-1.5">
					{BACKGROUNDS.map((option) => (
						<button
							key={option}
							type="button"
							onClick={() => handleBackgroundClick(option)}
							title={t(BACKGROUND_LABEL_KEYS[option])}
							aria-label={t(BACKGROUND_LABEL_KEYS[option])}
							style={backgroundSwatchStyle(option, customBackgroundColor)}
							className={`aspect-square rounded-md bg-cover transition-all ${
								background === option ? "ring-2 ring-brand-400 ring-offset-1 ring-offset-brand-950" : "hover:brightness-110"
							}`}
						/>
					))}
				</div>
				{background === "color" && (
					<label className="mt-1.5 flex items-center justify-between text-[11px] text-white/60">
						{t("background.colorPick")}
						<input
							type="color"
							value={customBackgroundColor}
							onChange={(event) => onChangeBackgroundColor(event.target.value)}
							className="h-6 w-10 rounded border border-white/15 bg-transparent"
						/>
					</label>
				)}
				{background !== "none" && (
					<label className="mt-1.5 flex flex-col gap-1 text-[11px] text-white/60">
						<span className="flex justify-between">
							<span>{t("background.blur")}</span>
							<span className="text-white/40">{backgroundBlur}px</span>
						</span>
						<input
							type="range"
							min={0}
							max={40}
							step={1}
							value={backgroundBlur}
							onChange={(event) => onChangeBackgroundBlur(Number(event.target.value))}
							className="accent-brand-500"
						/>
					</label>
				)}
			</div>

			<div>
				<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
					{t("settingsPanel.crop")}
				</h3>
				<div className="flex gap-2">
					{CROPS.map((option) => (
						<button
							key={option}
							type="button"
							onClick={() => onChangeCropAspect(option)}
							className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
								cropAspect === option
									? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-400"
									: "bg-white/5 text-white/60 hover:bg-white/10"
							}`}
						>
							{option === "full" ? t("crop.full") : option === "custom" ? t("crop.custom") : option}
						</button>
					))}
				</div>
				{cropAspect === "custom" && (
					<div className="mt-1.5">
						<CropControl previewSrc={cropPreviewSrc} region={cropRegion} onChange={onChangeCropRegion} />
					</div>
				)}
			</div>

			<div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
				<button
					type="button"
					onClick={onToggleFrameShadow}
					className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
				>
					{t("editor.frameShadow")}
					<span
						className={`relative h-4 w-7 rounded-full transition-colors ${frameShadowEnabled ? "bg-brand-500" : "bg-white/20"}`}
					>
						<span
							className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
								frameShadowEnabled ? "translate-x-3.5" : "translate-x-0.5"
							}`}
						/>
					</span>
				</button>
				<label className="flex flex-col gap-1 text-[11px] text-white/60">
					<span className="flex justify-between">
						<span>{t("editor.cornerRadius")}</span>
						<span className="text-white/40">{frameRadius}px</span>
					</span>
					<input
						type="range"
						min={0}
						max={48}
						step={2}
						value={frameRadius}
						onChange={(event) => onChangeFrameRadius(Number(event.target.value))}
						className="accent-brand-500"
					/>
				</label>

				<div className="flex items-center justify-between">
					<span className="text-[11px] text-white/60">{t("editor.framePadding")}</span>
					<button
						type="button"
						onClick={() => onChangeFramePadding({ ...framePadding, linked: !framePadding.linked })}
						className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
							framePadding.linked
								? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400"
								: "bg-white/5 text-white/50 hover:bg-white/10"
						}`}
					>
						{t("editor.framePaddingLinked")}
					</button>
				</div>
				{framePadding.linked ? (
					<label className="flex flex-col gap-1 text-[11px] text-white/60">
						<span className="flex justify-between">
							<span>{t("editor.framePaddingAll")}</span>
							<span className="text-white/40">{framePadding.top}px</span>
						</span>
						<input
							type="range"
							min={0}
							max={MAX_FRAME_PADDING_PX}
							step={2}
							value={framePadding.top}
							onChange={(event) => {
								const value = Number(event.target.value);
								onChangeFramePadding({ top: value, bottom: value, left: value, right: value, linked: true });
							}}
							className="accent-brand-500"
						/>
					</label>
				) : (
					<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
						{(
							[
								{ side: "top", labelKey: "editor.framePaddingTop" },
								{ side: "bottom", labelKey: "editor.framePaddingBottom" },
								{ side: "left", labelKey: "editor.framePaddingLeft" },
								{ side: "right", labelKey: "editor.framePaddingRight" },
							] as const
						).map(({ side, labelKey }) => (
							<label key={side} className="flex flex-col gap-1 text-[11px] text-white/60">
								<span className="flex justify-between">
									<span>{t(labelKey)}</span>
									<span className="text-white/40">{framePadding[side]}px</span>
								</span>
								<input
									type="range"
									min={0}
									max={MAX_FRAME_PADDING_PX}
									step={2}
									value={framePadding[side]}
									onChange={(event) =>
										onChangeFramePadding({ ...framePadding, [side]: Number(event.target.value) })
									}
									className="accent-brand-500"
								/>
							</label>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
