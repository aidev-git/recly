import { uIOhook, UiohookMouseEvent } from "uiohook-napi";

export interface CursorSample {
	timestampMs: number;
	x: number;
	y: number;
	kind: "move" | "down" | "up";
}

export type CursorSampleListener = (sample: CursorSample) => void;

let listeners = new Set<CursorSampleListener>();
let started = false;

function emit(kind: CursorSample["kind"], event: UiohookMouseEvent) {
	const sample: CursorSample = {
		timestampMs: Date.now(),
		x: event.x,
		y: event.y,
		kind,
	};
	for (const listener of listeners) listener(sample);
}

function onMove(event: UiohookMouseEvent) {
	emit("move", event);
}
function onDown(event: UiohookMouseEvent) {
	emit("down", event);
}
function onUp(event: UiohookMouseEvent) {
	emit("up", event);
}

export function subscribeCursorTracking(listener: CursorSampleListener): () => void {
	listeners.add(listener);

	if (!started) {
		uIOhook.on("mousemove", onMove);
		uIOhook.on("mousedown", onDown);
		uIOhook.on("mouseup", onUp);
		uIOhook.start();
		started = true;
	}

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && started) {
			uIOhook.stop();
			uIOhook.off("mousemove", onMove);
			uIOhook.off("mousedown", onDown);
			uIOhook.off("mouseup", onUp);
			started = false;
		}
	};
}
