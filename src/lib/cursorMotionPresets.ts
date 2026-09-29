import type { CursorAppearance } from "@/lib/compositor";

export type CursorMotionPresetKey = "focused" | "smooth";

export interface CursorMotionPreset {
	key: CursorMotionPresetKey;
	labelKey: string;
	values: Pick<CursorAppearance, "smoothing" | "sway" | "motionBlur">;
}

export const CURSOR_MOTION_PRESETS: CursorMotionPreset[] = [
	{
		key: "focused",
		labelKey: "cursorMotion.focused",
		values: { smoothing: 0.15, sway: 0, motionBlur: 0.15 },
	},
	{
		key: "smooth",
		labelKey: "cursorMotion.smooth",
		values: { smoothing: 0.45, sway: 0.35, motionBlur: 0.75 },
	},
];
