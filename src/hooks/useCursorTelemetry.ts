import { useCallback, useRef } from "react";
import type { CursorSampleRecord } from "../../electron/project/projectTypes";
import type { CursorTelemetryState } from "@/lib/compositor";

export function useCursorTelemetry() {
	const cursorRef = useRef<CursorTelemetryState>({
		xNorm: 0.5,
		yNorm: 0.5,
		lastMoveAt: 0,
		lastClickAt: 0,
	});
	const bufferRef = useRef<CursorSampleRecord[]>([]);
	const recordingStartedAtRef = useRef(0);
	const unsubscribeRef = useRef<(() => void) | null>(null);

	const start = useCallback(async () => {
		const display = await window.recly.getDisplayInfo();
		bufferRef.current = [];
		recordingStartedAtRef.current = Date.now();

		unsubscribeRef.current = window.recly.onCursorSample((sample) => {
			const xNorm = sample.x / display.widthPx;
			const yNorm = sample.y / display.heightPx;
			const now = Date.now();

			if (sample.kind === "move") {
				cursorRef.current = { ...cursorRef.current, xNorm, yNorm, lastMoveAt: now };
			} else if (sample.kind === "down") {
				cursorRef.current = { ...cursorRef.current, xNorm, yNorm, lastMoveAt: now, lastClickAt: now };
			}

			bufferRef.current.push({
				timestampMs: now - recordingStartedAtRef.current,
				xNorm,
				yNorm,
				kind: sample.kind,
			});
		});

		await window.recly.startCursorTracking();
	}, []);

	const stop = useCallback(async () => {
		unsubscribeRef.current?.();
		unsubscribeRef.current = null;
		await window.recly.stopCursorTracking();
	}, []);

	const takeBufferedSamples = useCallback((): CursorSampleRecord[] => {
		const samples = bufferRef.current;
		bufferRef.current = [];
		return samples;
	}, []);

	return { cursorRef, start, stop, takeBufferedSamples };
}
