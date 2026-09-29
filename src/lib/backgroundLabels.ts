import type { CSSProperties } from "react";
import type { BackgroundChoice } from "../../electron/project/projectTypes";
import { BACKGROUND_PRESETS } from "@/lib/compositor";

export const BACKGROUND_LABEL_KEYS: Record<BackgroundChoice, string> = {
	none: "background.none",
	violet: "background.violet",
	midnight: "background.midnight",
	sunset: "background.sunset",
	aurora: "background.aurora",
	coral: "background.coral",
	forest: "background.forest",
	ocean: "background.ocean",
	ember: "background.ember",
	lavender: "background.lavender",
	steel: "background.steel",
	rose: "background.rose",
	citrus: "background.citrus",
	mint: "background.mint",
	plum: "background.plum",
	slate: "background.slate",
	gold: "background.gold",
	arctic: "background.arctic",
	berry: "background.berry",
	indigo: "background.indigo",
	teal: "background.teal",
	crimson: "background.crimson",
	amber: "background.amber",
	jade: "background.jade",
	sapphire: "background.sapphire",
	copper: "background.copper",
	orchid: "background.orchid",
	fern: "background.fern",
	dusk: "background.dusk",
	flame: "background.flame",
	glacier: "background.glacier",
	custom: "background.custom",
	color: "background.color",
	video: "background.video",
};

export function backgroundSwatchStyle(choice: BackgroundChoice, customColor?: string): CSSProperties {
	if (choice === "none") return { backgroundColor: "#0b070c" };
	if (choice === "custom") return { backgroundColor: "#2a2230" };
	if (choice === "color") return { backgroundColor: customColor ?? "#2a2230" };
	if (choice === "video") {
		return {
			backgroundColor: "#1a1420",
			backgroundImage: "linear-gradient(135deg, #4b3f8a 25%, transparent 25%)",
		};
	}
	const preset = BACKGROUND_PRESETS[choice];
	return {
		backgroundImage:
			preset.style === "radial"
				? `radial-gradient(circle, ${preset.from}, ${preset.to})`
				: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
	};
}
