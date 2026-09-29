import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { backgroundSwatchStyle, BACKGROUND_LABEL_KEYS } from "@/lib/backgroundLabels";
import { normalizeCursorClickEffectColor } from "@/lib/compositor";
import { CURSOR_MOTION_PRESETS } from "@/lib/cursorMotionPresets";
import type { RecorderSettings } from "@/lib/settings";
import type {
	BackgroundChoice,
	CropAspect,
	CursorClickEffectStyle,
	CursorSkin,
	WebcamPosition,
} from "@/hooks/useRecorder";
import { CropControl } from "@/components/CropControl";
import { WebcamCropControl } from "@/components/WebcamCropControl";

interface RecorderSettingsPanelProps {
	settings: RecorderSettings;
	onUpdate: <K extends keyof RecorderSettings>(key: K, value: RecorderSettings[K]) => void;
	previewSrc?: string | null;
	disabled?: boolean;
	nativeCaptureAvailable?: boolean;
}

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
const CROP_LABEL_KEYS: Partial<Record<CropAspect, string>> = {
	full: "crop.full",
	custom: "crop.custom",
};
const WEBCAM_POSITIONS: WebcamPosition[] = [
	"top-left",
	"top-center",
	"top-right",
	"middle-left",
	"middle-center",
	"middle-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];
const WEBCAM_POSITION_LABEL_KEYS: Record<WebcamPosition, string> = {
	"top-left": "webcamPosition.topLeft",
	"top-center": "webcamPosition.topCenter",
	"top-right": "webcamPosition.topRight",
	"middle-left": "webcamPosition.middleLeft",
	"middle-center": "webcamPosition.middleCenter",
	"middle-right": "webcamPosition.middleRight",
	"bottom-left": "webcamPosition.bottomLeft",
	"bottom-center": "webcamPosition.bottomCenter",
	"bottom-right": "webcamPosition.bottomRight",
	custom: "webcamPosition.custom",
};
const CLICK_EFFECT_COLOR_PRESETS = [
	"#8A5F99",
	"#EF4444",
	"#F59E0B",
	"#22C55E",
	"#A855F7",
	"#EC4899",
	"#14B8A6",
	"#F97316",
	"#3B82F6",
	"#F43F5E",
	"#84CC16",
	"#06B6D4",
];
const CLICK_EFFECT_STYLES: CursorClickEffectStyle[] = ["none", "spotlight", "ripple", "echo"];
const CLICK_EFFECT_LABEL_KEYS: Record<CursorClickEffectStyle, string> = {
	none: "clickEffect.none",
	spotlight: "clickEffect.spotlight",
	ripple: "clickEffect.ripple",
	echo: "clickEffect.echo",
};
const CURSOR_SKINS: CursorSkin[] = ["dot", "macos", "windows11", "tahoe", "tahoe-inverted", "figma", "custom"];
const CURSOR_SKIN_LABEL_KEYS: Record<CursorSkin, string> = {
	dot: "cursorSkin.dot",
	macos: "cursorSkin.macos",
	windows11: "cursorSkin.windows11",
	tahoe: "cursorSkin.tahoe",
	"tahoe-inverted": "cursorSkin.tahoeInverted",
	figma: "cursorSkin.figma",
	custom: "cursorSkin.custom",
};

const SAVED_CUSTOM_CURSORS_KEY = "recly.settings.savedCustomCursors";

function loadSavedCustomCursors(): string[] {
	try {
		const raw = localStorage.getItem(SAVED_CUSTOM_CURSORS_KEY);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}

function saveSavedCustomCursors(paths: string[]): void {
	localStorage.setItem(SAVED_CUSTOM_CURSORS_KEY, JSON.stringify(paths));
}

function ToggleRow({
	label,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onChange}
			disabled={disabled}
			className="flex items-center justify-between rounded-lg bg-[var(--panel-bg)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--panel-bg-strong)] disabled:cursor-not-allowed disabled:opacity-50"
		>
			{label}
			<span
				className={`relative h-4 w-7 rounded-full transition-colors ${checked ? "bg-brand-500" : "bg-[var(--panel-bg-strong)]"}`}
			>
				<span
					className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform ${
						checked ? "translate-x-3.5" : "translate-x-0.5"
					}`}
				/>
			</span>
		</button>
	);
}

function SliderRow({
	label,
	value,
	min,
	max,
	step,
	onChange,
	disabled,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	disabled?: boolean;
}) {
	return (
		<label className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">
			<span className="flex justify-between">
				<span>{label}</span>
				<span className="text-[var(--text-tertiary)]">{value.toFixed(2)}</span>
			</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
				className="accent-brand-500"
			/>
		</label>
	);
}

export function RecorderSettingsPanel({
	settings,
	onUpdate,
	previewSrc,
	disabled,
	nativeCaptureAvailable,
}: RecorderSettingsPanelProps) {
	const { t } = useI18n();
	const [showWebcamCrop, setShowWebcamCrop] = useState(false);
	const [savedCustomCursors, setSavedCustomCursors] = useState(loadSavedCustomCursors);
	const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);

	useEffect(() => {
		if (!settings.webcamEnabled) return;
		void navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => setWebcamDevices(devices.filter((device) => device.kind === "videoinput")))
			.catch(() => undefined);
	}, [settings.webcamEnabled]);

	const handleBackgroundClick = async (option: BackgroundChoice) => {
		if (option === "custom") {
			const chosenPath = await window.recly.chooseBackgroundImage();
			if (!chosenPath) return;
			onUpdate("customBackgroundPath", chosenPath);
		} else if (option === "video") {
			const chosenPath = await window.recly.chooseBackgroundVideo();
			if (!chosenPath) return;
			onUpdate("customBackgroundVideoPath", chosenPath);
		}
		onUpdate("background", option);
	};

	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
			{nativeCaptureAvailable && (
				<div className="flex flex-col gap-1 rounded-lg bg-[var(--panel-bg)] p-1">
					<ToggleRow
						label={t("settingsPanel.nativeCapture")}
						checked={settings.nativeCaptureEnabled}
						onChange={() => onUpdate("nativeCaptureEnabled", !settings.nativeCaptureEnabled)}
						disabled={disabled}
					/>
					{settings.nativeCaptureEnabled && (
						<p className="px-1 text-[10px] leading-snug text-[var(--text-tertiary)]">
							{t("settingsPanel.nativeCaptureHint")}
						</p>
					)}
				</div>
			)}
			<ToggleRow
				label={t("settingsPanel.webcamOverlay")}
				checked={settings.webcamEnabled}
				onChange={() => onUpdate("webcamEnabled", !settings.webcamEnabled)}
				disabled={disabled}
			/>
			{settings.webcamEnabled && (
				<div className="flex flex-col gap-1.5 rounded-lg bg-[var(--panel-bg)] p-2">
					<div className="grid grid-cols-3 gap-1.5">
						{WEBCAM_POSITIONS.map((position) => (
							<button
								key={position}
								type="button"
								disabled={disabled}
								onClick={() =>
									onUpdate("webcamOverlay", { ...settings.webcamOverlay, position })
								}
								className={`rounded-md px-2 py-1 text-[10px] transition-colors disabled:opacity-50 ${
									settings.webcamOverlay.position === position
										? "bg-brand-500/25 text-brand-600 ring-1 ring-brand-400 dark:text-brand-100"
										: "bg-[var(--panel-bg-strong)] text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
								}`}
							>
								{t(WEBCAM_POSITION_LABEL_KEYS[position])}
							</button>
						))}
					</div>
					<SliderRow
						label={t("webcamPanel.width")}
						value={settings.webcamOverlay.widthNorm}
						min={0.1}
						max={0.5}
						step={0.01}
						disabled={disabled}
						onChange={(widthNorm) =>
							onUpdate("webcamOverlay", { ...settings.webcamOverlay, widthNorm })
						}
					/>
					<SliderRow
						label={t("webcamPanel.height")}
						value={settings.webcamOverlay.heightNorm}
						min={0.1}
						max={0.5}
						step={0.01}
						disabled={disabled}
						onChange={(heightNorm) =>
							onUpdate("webcamOverlay", { ...settings.webcamOverlay, heightNorm })
						}
					/>
					<SliderRow
						label={t("webcamPanel.roundness")}
						value={settings.webcamOverlay.roundness}
						min={0}
						max={1}
						step={0.05}
						disabled={disabled}
						onChange={(roundness) =>
							onUpdate("webcamOverlay", { ...settings.webcamOverlay, roundness })
						}
					/>
					<SliderRow
						label={t("webcamPanel.margin")}
						value={settings.webcamOverlay.marginNorm}
						min={0}
						max={0.1}
						step={0.005}
						disabled={disabled}
						onChange={(marginNorm) =>
							onUpdate("webcamOverlay", { ...settings.webcamOverlay, marginNorm })
						}
					/>
					<ToggleRow
						label={t("webcamPanel.mirror")}
						checked={settings.webcamOverlay.mirror}
						onChange={() =>
							onUpdate("webcamOverlay", { ...settings.webcamOverlay, mirror: !settings.webcamOverlay.mirror })
						}
						disabled={disabled}
					/>
					<ToggleRow
						label={t("webcamPanel.shadow")}
						checked={settings.webcamOverlay.shadowEnabled}
						onChange={() =>
							onUpdate("webcamOverlay", {
								...settings.webcamOverlay,
								shadowEnabled: !settings.webcamOverlay.shadowEnabled,
							})
						}
						disabled={disabled}
					/>
					{settings.webcamOverlay.shadowEnabled && (
						<SliderRow
							label={t("webcamPanel.shadowOpacity")}
							value={settings.webcamOverlay.shadowOpacity}
							min={0.1}
							max={1}
							step={0.05}
							disabled={disabled}
							onChange={(shadowOpacity) =>
								onUpdate("webcamOverlay", { ...settings.webcamOverlay, shadowOpacity })
							}
						/>
					)}
					<label className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">
						<span className="flex justify-between">
							<span>{t("webcamPanel.syncOffset")}</span>
							<span className="text-[var(--text-tertiary)]">{settings.webcamOverlay.timeOffsetMs}ms</span>
						</span>
						<input
							type="range"
							min={-500}
							max={500}
							step={10}
							disabled={disabled}
							value={settings.webcamOverlay.timeOffsetMs}
							onChange={(event) =>
								onUpdate("webcamOverlay", {
									...settings.webcamOverlay,
									timeOffsetMs: Number(event.target.value),
								})
							}
							className="accent-brand-500"
						/>
					</label>
					{webcamDevices.length > 1 && (
						<label className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">
							{t("webcamPanel.device")}
							<select
								disabled={disabled}
								value={settings.webcamOverlay.deviceId ?? ""}
								onChange={(event) =>
									onUpdate("webcamOverlay", {
										...settings.webcamOverlay,
										deviceId: event.target.value || null,
									})
								}
								className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text-primary)]"
							>
								<option value="">{t("webcamPanel.deviceDefault")}</option>
								{webcamDevices.map((device, index) => (
									<option key={device.deviceId} value={device.deviceId}>
										{device.label || `${t("webcamPanel.device")} ${index + 1}`}
									</option>
								))}
							</select>
						</label>
					)}
					<ToggleRow
						label={t("webcamPanel.reactToZoom")}
						checked={settings.webcamOverlay.reactToZoom}
						onChange={() =>
							onUpdate("webcamOverlay", {
								...settings.webcamOverlay,
								reactToZoom: !settings.webcamOverlay.reactToZoom,
							})
						}
						disabled={disabled}
					/>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setShowWebcamCrop((current) => !current)}
						className="rounded-md bg-[var(--panel-bg-strong)] px-2 py-1 text-[10px] text-[var(--text-tertiary)] transition-colors hover:opacity-80 disabled:opacity-50"
					>
						{t("webcamPanel.adjustCrop")}
					</button>
					{showWebcamCrop && !disabled && (
						<WebcamCropControl
							region={settings.webcamOverlay.cropRegion}
							onChange={(cropRegion) =>
								onUpdate("webcamOverlay", { ...settings.webcamOverlay, cropRegion })
							}
						/>
					)}
				</div>
			)}
			<ToggleRow
				label={t("settingsPanel.systemAudio")}
				checked={settings.systemAudioEnabled}
				onChange={() => onUpdate("systemAudioEnabled", !settings.systemAudioEnabled)}
				disabled={disabled}
			/>
			<ToggleRow
				label={t("settingsPanel.trackCursor")}
				checked={settings.autoZoomEnabled}
				onChange={() => onUpdate("autoZoomEnabled", !settings.autoZoomEnabled)}
				disabled={disabled}
			/>

			<div>
				<p className="mb-1 mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsPanel.background")}
				</p>
				<div className="grid grid-cols-6 gap-1.5">
					{BACKGROUNDS.map((option) => (
						<button
							key={option}
							type="button"
							disabled={disabled}
							onClick={() => void handleBackgroundClick(option)}
							title={t(BACKGROUND_LABEL_KEYS[option])}
							aria-label={t(BACKGROUND_LABEL_KEYS[option])}
							style={backgroundSwatchStyle(option, settings.customBackgroundColor)}
							className={`aspect-square rounded-md bg-cover transition-all disabled:opacity-50 ${
								settings.background === option
									? "ring-2 ring-brand-400 ring-offset-1 ring-offset-[var(--panel-bg)]"
									: "hover:brightness-110"
							}`}
						/>
					))}
				</div>
				{settings.background === "color" && (
					<label className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
						{t("background.colorPick")}
						<input
							type="color"
							disabled={disabled}
							value={settings.customBackgroundColor}
							onChange={(event) => {
								onUpdate("customBackgroundColor", event.target.value);
								onUpdate("background", "color");
							}}
							className="h-6 w-10 rounded border border-[var(--panel-border)] bg-transparent"
						/>
					</label>
				)}
				{settings.background !== "none" && (
					<label className="mt-1.5 flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">
						<span className="flex justify-between">
							<span>{t("background.blur")}</span>
							<span className="text-[var(--text-tertiary)]">{settings.backgroundBlur}px</span>
						</span>
						<input
							type="range"
							min={0}
							max={40}
							step={1}
							disabled={disabled}
							value={settings.backgroundBlur}
							onChange={(event) => onUpdate("backgroundBlur", Number(event.target.value))}
							className="accent-brand-500"
						/>
					</label>
				)}
			</div>

			<div>
				<p className="mb-1 mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsPanel.crop")}
				</p>
				<div className="flex gap-1.5">
					{CROPS.map((option) => (
						<button
							key={option}
							type="button"
							disabled={disabled}
							onClick={() => onUpdate("cropAspect", option)}
							className={`flex-1 rounded-md px-2 py-1 text-[10px] transition-colors disabled:opacity-50 ${
								settings.cropAspect === option
									? "bg-brand-500/25 text-brand-600 ring-1 ring-brand-400 dark:text-brand-100"
									: "bg-[var(--panel-bg)] text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
							}`}
						>
							{CROP_LABEL_KEYS[option] ? t(CROP_LABEL_KEYS[option] as string) : option}
						</button>
					))}
				</div>
				{settings.cropAspect === "custom" && (
					<div className="mt-1.5">
						<CropControl
							previewSrc={previewSrc ?? null}
							region={settings.cropRegion}
							onChange={(cropRegion) => onUpdate("cropRegion", cropRegion)}
							disabled={disabled}
						/>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-1.5 border-t border-[var(--panel-border)] pt-2">
				<p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsPanel.cursor")}
				</p>
				<div className="grid grid-cols-3 gap-1.5">
					{CURSOR_SKINS.map((skin) => (
						<button
							key={skin}
							type="button"
							disabled={disabled}
							onClick={() => onUpdate("cursorAppearance", { ...settings.cursorAppearance, skin })}
							className={`rounded-md px-2 py-1 text-[10px] transition-colors disabled:opacity-50 ${
								settings.cursorAppearance.skin === skin
									? "bg-brand-500/25 text-brand-600 ring-1 ring-brand-400 dark:text-brand-100"
									: "bg-[var(--panel-bg)] text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
							}`}
						>
							{t(CURSOR_SKIN_LABEL_KEYS[skin])}
						</button>
					))}
				</div>
				{settings.cursorAppearance.skin === "custom" && (
					<div className="flex flex-col gap-1.5 rounded-lg bg-[var(--panel-bg)] p-2">
						<div className="grid grid-cols-4 gap-1.5">
							{savedCustomCursors.map((path) => (
								<button
									key={path}
									type="button"
									disabled={disabled}
									onClick={() =>
										onUpdate("cursorAppearance", { ...settings.cursorAppearance, customCursorPath: path })
									}
									className={`relative aspect-square overflow-hidden rounded-md border bg-white/5 ${
										settings.cursorAppearance.customCursorPath === path
											? "border-brand-400 ring-1 ring-brand-400"
											: "border-[var(--panel-border)]"
									}`}
								>
									<img
										src={`file://${path.replace(/\\/g, "/")}`}
										className="h-full w-full object-contain"
										alt=""
									/>
								</button>
							))}
							<button
								type="button"
								disabled={disabled}
								onClick={async () => {
									const chosenPath = await window.recly.chooseBackgroundImage();
									if (!chosenPath) return;
									const next = [...new Set([...savedCustomCursors, chosenPath])];
									setSavedCustomCursors(next);
									saveSavedCustomCursors(next);
									onUpdate("cursorAppearance", {
										...settings.cursorAppearance,
										customCursorPath: chosenPath,
									});
								}}
								className="aspect-square rounded-md border border-dashed border-[var(--panel-border)] text-sm text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
							>
								+
							</button>
						</div>
						{settings.cursorAppearance.customCursorPath && (
							<button
								type="button"
								disabled={disabled}
								onClick={() => {
									const removed = settings.cursorAppearance.customCursorPath;
									const next = savedCustomCursors.filter((path) => path !== removed);
									setSavedCustomCursors(next);
									saveSavedCustomCursors(next);
									onUpdate("cursorAppearance", {
										...settings.cursorAppearance,
										customCursorPath: next[0] ?? null,
									});
								}}
								className="text-left text-[10px] text-red-300 hover:text-red-200"
							>
								{t("cursorSkin.removeCustom")}
							</button>
						)}
					</div>
				)}
				<SliderRow
					label={t("settingsPanel.size")}
					value={settings.cursorAppearance.size}
					min={3}
					max={14}
					step={0.5}
					disabled={disabled}
					onChange={(size) =>
						onUpdate("cursorAppearance", { ...settings.cursorAppearance, size })
					}
				/>
				<SliderRow
					label={t("settingsPanel.smoothing")}
					value={settings.cursorAppearance.smoothing}
					min={0}
					max={1}
					step={0.05}
					disabled={disabled}
					onChange={(smoothing) =>
						onUpdate("cursorAppearance", { ...settings.cursorAppearance, smoothing })
					}
				/>
				<SliderRow
					label={t("settingsPanel.sway")}
					value={settings.cursorAppearance.sway}
					min={0}
					max={1}
					step={0.05}
					disabled={disabled}
					onChange={(sway) => onUpdate("cursorAppearance", { ...settings.cursorAppearance, sway })}
				/>
				<SliderRow
					label={t("settingsPanel.motionBlur")}
					value={settings.cursorAppearance.motionBlur}
					min={0}
					max={1}
					step={0.05}
					disabled={disabled}
					onChange={(motionBlur) =>
						onUpdate("cursorAppearance", { ...settings.cursorAppearance, motionBlur })
					}
				/>
				<div className="flex gap-1.5">
					{CURSOR_MOTION_PRESETS.map((preset) => (
						<button
							key={preset.key}
							type="button"
							disabled={disabled}
							onClick={() =>
								onUpdate("cursorAppearance", { ...settings.cursorAppearance, ...preset.values })
							}
							className="flex-1 rounded-md bg-[var(--panel-bg)] px-2 py-1 text-[10px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--panel-bg-strong)] disabled:opacity-50"
						>
							{t(preset.labelKey)}
						</button>
					))}
				</div>
				<SliderRow
					label={t("settingsPanel.clickBounce")}
					value={settings.cursorAppearance.clickBounce}
					min={0}
					max={5}
					step={0.5}
					disabled={disabled}
					onChange={(clickBounce) =>
						onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickBounce })
					}
				/>
				<SliderRow
					label={t("settingsPanel.clickBounceDuration")}
					value={settings.cursorAppearance.clickBounceDurationMs}
					min={100}
					max={800}
					step={25}
					disabled={disabled}
					onChange={(clickBounceDurationMs) =>
						onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickBounceDurationMs })
					}
				/>

				<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsPanel.clickEffect")}
				</p>
				<div className="grid grid-cols-2 gap-1.5">
					{CLICK_EFFECT_STYLES.map((style) => (
						<button
							key={style}
							type="button"
							disabled={disabled}
							onClick={() =>
								onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickEffectStyle: style })
							}
							className={`rounded-md px-2 py-1 text-[10px] transition-colors disabled:opacity-50 ${
								settings.cursorAppearance.clickEffectStyle === style
									? "bg-brand-500/25 text-brand-600 ring-1 ring-brand-400 dark:text-brand-100"
									: "bg-[var(--panel-bg)] text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
							}`}
						>
							{t(CLICK_EFFECT_LABEL_KEYS[style])}
						</button>
					))}
				</div>

				{settings.cursorAppearance.clickEffectStyle !== "none" && (
					<>
						<label className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
							{t("settingsPanel.clickColor")}
							<input
								type="color"
								disabled={disabled}
								value={settings.cursorAppearance.clickEffectColor}
								onChange={(event) =>
									onUpdate("cursorAppearance", {
										...settings.cursorAppearance,
										clickEffectColor: normalizeCursorClickEffectColor(event.target.value),
									})
								}
								className="h-6 w-10 rounded border border-[var(--panel-border)] bg-transparent"
							/>
						</label>
						<div className="flex flex-wrap gap-1.5">
							{CLICK_EFFECT_COLOR_PRESETS.map((color) => (
								<button
									key={color}
									type="button"
									disabled={disabled}
									title={color}
									aria-label={color}
									onClick={() =>
										onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickEffectColor: color })
									}
									style={{ backgroundColor: color }}
									className={`h-5 w-5 rounded-full transition-transform disabled:opacity-50 ${
										settings.cursorAppearance.clickEffectColor.toLowerCase() === color.toLowerCase()
											? "ring-2 ring-white ring-offset-1 ring-offset-[var(--panel-bg)]"
											: "hover:scale-110"
									}`}
								/>
							))}
						</div>
						<SliderRow
							label={t("settingsPanel.clickScale")}
							value={settings.cursorAppearance.clickEffectScale}
							min={0.5}
							max={2.5}
							step={0.1}
							disabled={disabled}
							onChange={(clickEffectScale) =>
								onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickEffectScale })
							}
						/>
						<SliderRow
							label={t("settingsPanel.clickOpacity")}
							value={settings.cursorAppearance.clickEffectOpacity}
							min={0.2}
							max={1}
							step={0.05}
							disabled={disabled}
							onChange={(clickEffectOpacity) =>
								onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickEffectOpacity })
							}
						/>
						<SliderRow
							label={t("settingsPanel.clickDuration")}
							value={settings.cursorAppearance.clickEffectDurationMs}
							min={200}
							max={1200}
							step={50}
							disabled={disabled}
							onChange={(clickEffectDurationMs) =>
								onUpdate("cursorAppearance", { ...settings.cursorAppearance, clickEffectDurationMs })
							}
						/>
					</>
				)}
			</div>
		</div>
	);
}
