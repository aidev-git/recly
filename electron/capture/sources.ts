import { desktopCapturer } from "electron";

export interface CaptureSource {
	id: string;
	name: string;
	kind: "screen" | "window";
	thumbnailDataUrl: string;
}

export async function listCaptureSources(): Promise<CaptureSource[]> {
	const sources = await desktopCapturer.getSources({
		types: ["screen", "window"],
		thumbnailSize: { width: 320, height: 180 },
		fetchWindowIcons: false,
	});

	return sources.map((source) => ({
		id: source.id,
		name: source.name,
		kind: source.id.startsWith("screen:") ? "screen" : "window",
		thumbnailDataUrl: source.thumbnail.toDataURL(),
	}));
}
