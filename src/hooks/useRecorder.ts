import { useCallback, useEffect, useRef, useState } from "react";
import type { BackgroundChoice } from "../../electron/project/projectTypes";
import type { CaptureSource } from "../../electron/capture/sources";
import {
	Compositor,
	type CropAspect,
	type CropRegion,
	type CursorClickEffectStyle,
	type CursorSkin,
	type WebcamOverlaySettings,
	type WebcamPosition,
} from "@/lib/compositor";
import { useCursorTelemetry } from "./useCursorTelemetry";
import {
	loadMicEnabled,
	loadRecorderSettings,
	loadSavedDirectory,
	type RecorderSettings,
	saveMicEnabled,
	saveRecorderSettings,
} from "@/lib/settings";

export type RecordingStatus = "idle" | "counting-down" | "recording" | "paused" | "saving";

interface DesktopMediaConstraints extends MediaTrackConstraints {
	mandatory: {
		chromeMediaSource: "desktop";
		chromeMediaSourceId?: string;
	};
}

function createHiddenVideoElement(stream: MediaStream): HTMLVideoElement {
	const video = document.createElement("video");
	video.srcObject = stream;
	video.muted = true;
	video.playsInline = true;
	void video.play();
	return video;
}

function createHiddenFileVideoElement(filePath: string): HTMLVideoElement {
	const video = document.createElement("video");
	video.src = `file://${filePath.replace(/\\/g, "/")}`;
	video.loop = true;
	video.muted = true;
	video.playsInline = true;
	void video.play();
	return video;
}

function loadImage(filePath: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = `file://${filePath.replace(/\\/g, "/")}`;
	});
}

export function useRecorder() {
	const [sources, setSources] = useState<CaptureSource[]>([]);
	const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
	const [micEnabled, setMicEnabled] = useState(loadMicEnabled);
	const [settings, setSettings] = useState(loadRecorderSettings);
	const [status, setStatus] = useState<RecordingStatus>("idle");
	const [elapsedMs, setElapsedMs] = useState(0);
	const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const cursorTelemetry = useCursorTelemetry();

	const [nativeCaptureAvailable, setNativeCaptureAvailable] = useState(false);
	const [screenRecordingPermissionDenied, setScreenRecordingPermissionDenied] = useState(false);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioTracksRef = useRef<MediaStreamTrack[]>([]);
	const sourceStreamRef = useRef<MediaStream | null>(null);
	const webcamStreamRef = useRef<MediaStream | null>(null);
	const sourceVideoElRef = useRef<HTMLVideoElement | null>(null);
	const webcamVideoElRef = useRef<HTMLVideoElement | null>(null);
	const backgroundVideoElRef = useRef<HTMLVideoElement | null>(null);
	const compositorRef = useRef<Compositor | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const startedAtRef = useRef<number>(0);
	const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const nativeModeActiveRef = useRef(false);
	const micRecorderRef = useRef<MediaRecorder | null>(null);
	const micChunksRef = useRef<BlobPart[]>([]);
	const micStreamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		void window.recly.isNativeCaptureAvailable().then(setNativeCaptureAvailable);
	}, []);

	useEffect(() => {
		void window.recly
			.getScreenRecordingPermissionStatus()
			.then((result) => setScreenRecordingPermissionDenied(result.status === "denied"));
	}, []);

	const openScreenRecordingPreferences = useCallback(() => {
		void window.recly.openScreenRecordingPreferences();
	}, []);

	const refreshSources = useCallback(async () => {
		const nextSources = await window.recly.getSources();
		setSources(nextSources);
		setSelectedSourceId((current) => current ?? nextSources[0]?.id ?? null);
	}, []);

	useEffect(() => {
		void refreshSources();
	}, [refreshSources]);

	const toggleMic = useCallback(() => {
		setMicEnabled((current) => {
			const next = !current;
			saveMicEnabled(next);
			return next;
		});
	}, []);

	const updateSetting = useCallback(
		<K extends keyof RecorderSettings>(key: K, value: RecorderSettings[K]) => {
			setSettings((current) => {
				const next = { ...current, [key]: value };
				saveRecorderSettings(next);
				return next;
			});
		},
		[],
	);

	const stopTicking = useCallback(() => {
		if (tickIntervalRef.current) {
			clearInterval(tickIntervalRef.current);
			tickIntervalRef.current = null;
		}
	}, []);

	const startTicking = useCallback(() => {
		stopTicking();
		tickIntervalRef.current = setInterval(() => {
			setElapsedMs(Date.now() - startedAtRef.current);
		}, 250);
	}, [stopTicking]);

	const cleanupMedia = useCallback(() => {
		compositorRef.current?.stop();
		compositorRef.current = null;
		sourceStreamRef.current?.getTracks().forEach((track) => track.stop());
		sourceStreamRef.current = null;
		webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
		webcamStreamRef.current = null;
		audioTracksRef.current.forEach((track) => track.stop());
		audioTracksRef.current = [];
		sourceVideoElRef.current = null;
		webcamVideoElRef.current = null;
		backgroundVideoElRef.current?.pause();
		backgroundVideoElRef.current = null;
	}, []);

	const finalizeRecording = useCallback(async () => {
		stopTicking();
		void cursorTelemetry.stop();
		setStatus("saving");
		cleanupMedia();

		const blob = new Blob(chunksRef.current, { type: "video/webm" });
		chunksRef.current = [];
		const arrayBuffer = await blob.arrayBuffer();
		const telemetrySamples = cursorTelemetry.takeBufferedSamples();

		try {
			const directory = loadSavedDirectory() ?? (await window.recly.getDefaultSaveDirectory());
			const fileName = `recly-${new Date().toISOString().replace(/[:.]/g, "-")}`;
			const result = await window.recly.saveRecording({ data: arrayBuffer, directory, fileName });
			setLastSavedPath(result.filePath);

			if (telemetrySamples.length > 0) {
				await window.recly.saveCursorTelemetry(result.filePath, telemetrySamples);
			}
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not save recording.");
		} finally {
			setStatus("idle");
			setElapsedMs(0);
			await window.recly.recordingFinished();
		}
	}, [cleanupMedia, cursorTelemetry, stopTicking]);

	const finalizeNativeRecording = useCallback(async () => {
		stopTicking();
		void cursorTelemetry.stop();
		setStatus("saving");

		try {
			const micRecorder = micRecorderRef.current;
			let micBuffer: ArrayBuffer | null = null;
			if (micRecorder && micRecorder.state !== "inactive") {
				micBuffer = await new Promise<ArrayBuffer>((resolve) => {
					micRecorder.onstop = () => {
						const blob = new Blob(micChunksRef.current, { type: "audio/webm" });
						micChunksRef.current = [];
						void blob.arrayBuffer().then(resolve);
					};
					micRecorder.stop();
				});
			}
			micStreamRef.current?.getTracks().forEach((track) => track.stop());
			micStreamRef.current = null;
			micRecorderRef.current = null;

			const result = await window.recly.stopNativeCapture();
			setLastSavedPath(result.filePath);

			if (micBuffer) {
				await window.recly.saveMicSidecar(result.filePath, micBuffer);
			}

			const telemetrySamples = cursorTelemetry.takeBufferedSamples();
			if (telemetrySamples.length > 0) {
				await window.recly.saveCursorTelemetry(result.filePath, telemetrySamples);
			}
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not save recording.");
		} finally {
			nativeModeActiveRef.current = false;
			setStatus("idle");
			setElapsedMs(0);
			await window.recly.recordingFinished();
		}
	}, [cursorTelemetry, stopTicking]);

	const beginNativeCapture = useCallback(
		async (sourceId: string) => {
			try {
				const monitorMatch = /^screen:(\d+)/.exec(sourceId);
				const monitorIndex = monitorMatch ? Number(monitorMatch[1]) : 0;

				const directory = loadSavedDirectory() ?? (await window.recly.getDefaultSaveDirectory());
				const fileName = `recly-${new Date().toISOString().replace(/[:.]/g, "-")}`;

				if (micEnabled) {
					try {
						const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
						micStreamRef.current = micStream;
						micChunksRef.current = [];
						const micRecorder = new MediaRecorder(micStream);
						micRecorder.ondataavailable = (event) => {
							if (event.data.size > 0) micChunksRef.current.push(event.data);
						};
						micRecorderRef.current = micRecorder;
						micRecorder.start(1000);
					} catch {
						// Microphone unavailable — continue without it.
					}
				}

				if (settings.autoZoomEnabled) {
					await cursorTelemetry.start();
				}

				await window.recly.startNativeCapture({
					directory,
					fileName,
					monitorIndex,
					fps: 30,
					bitrate: 8_000_000,
				});

				nativeModeActiveRef.current = true;
				startedAtRef.current = Date.now();
				setElapsedMs(0);
				startTicking();
				setStatus("recording");
			} catch (caughtError) {
				nativeModeActiveRef.current = false;
				setStatus("idle");
				setError(caughtError instanceof Error ? caughtError.message : "Could not start native recording.");
			}
		},
		[cursorTelemetry, micEnabled, settings.autoZoomEnabled, startTicking],
	);

	const beginCapture = useCallback(async () => {
		if (!selectedSourceId) return;

		try {
			const selectedSource = sources.find((source) => source.id === selectedSourceId);

			if (settings.nativeCaptureEnabled && nativeCaptureAvailable && selectedSource?.kind === "screen") {
				await beginNativeCapture(selectedSourceId);
				return;
			}

			const videoConstraints: DesktopMediaConstraints = {
				mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: selectedSourceId },
			};

			const sourceStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: videoConstraints as unknown as MediaTrackConstraints,
			});
			sourceStreamRef.current = sourceStream;
			sourceVideoElRef.current = createHiddenVideoElement(sourceStream);

			const audioTracks: MediaStreamTrack[] = [];

			if (micEnabled) {
				try {
					const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
					audioTracks.push(...micStream.getAudioTracks());
				} catch {
					// Microphone unavailable — continue without it.
				}
			}

			if (settings.systemAudioEnabled && selectedSource?.kind === "screen") {
				try {
					const systemAudioConstraints = {
						mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: selectedSourceId },
					};
					const systemStream = await navigator.mediaDevices.getUserMedia({
						video: videoConstraints as unknown as MediaTrackConstraints,
						audio: systemAudioConstraints as unknown as MediaTrackConstraints,
					});
					audioTracks.push(...systemStream.getAudioTracks());
					systemStream.getVideoTracks().forEach((track) => track.stop());
				} catch {
					// System audio loopback unsupported on this platform/source — continue silently.
				}
			}

			if (settings.webcamEnabled) {
				try {
					const webcamConstraints: MediaTrackConstraints | boolean = settings.webcamOverlay.deviceId
						? { deviceId: { exact: settings.webcamOverlay.deviceId } }
						: true;
					const webcamStream = await navigator.mediaDevices.getUserMedia({ video: webcamConstraints });
					webcamStreamRef.current = webcamStream;

					// A fixed start delay approximates sync correction for a webcam feed that
					// otherwise leads the screen capture by a roughly constant USB/driver latency
					// — not a true rolling buffer, but enough to fix the common "webcam is ahead" case.
					const startDelayMs = Math.max(0, settings.webcamOverlay.timeOffsetMs);
					if (startDelayMs > 0) {
						setTimeout(() => {
							if (webcamStreamRef.current === webcamStream) {
								webcamVideoElRef.current = createHiddenVideoElement(webcamStream);
							}
						}, startDelayMs);
					} else {
						webcamVideoElRef.current = createHiddenVideoElement(webcamStream);
					}
				} catch {
					// Webcam unavailable — continue without it.
				}
			}

			audioTracksRef.current = audioTracks;

			const shouldTrackCursor = settings.autoZoomEnabled && selectedSource?.kind === "screen";
			if (shouldTrackCursor) {
				await cursorTelemetry.start();
			}

			const display = await window.recly.getDisplayInfo();
			const outputWidth = settings.cropAspect === "1:1" ? display.widthPx * 0.7 : display.widthPx;
			const outputHeight =
				settings.cropAspect === "1:1" ? display.widthPx * 0.7 : display.heightPx;

			let customBackgroundImage: HTMLImageElement | null = null;
			if (settings.background === "custom" && settings.customBackgroundPath) {
				try {
					customBackgroundImage = await loadImage(settings.customBackgroundPath);
				} catch {
					// Custom background image failed to load — fall back to solid.
				}
			}

			if (settings.background === "video" && settings.customBackgroundVideoPath) {
				backgroundVideoElRef.current = createHiddenFileVideoElement(settings.customBackgroundVideoPath);
			}

			let customCursorImage: HTMLImageElement | null = null;
			if (settings.cursorAppearance.skin === "custom" && settings.cursorAppearance.customCursorPath) {
				try {
					customCursorImage = await loadImage(settings.cursorAppearance.customCursorPath);
				} catch {
					// Custom cursor image failed to load — fall back to the plain dot.
				}
			}

			// Zoom is applied non-destructively in the editor from saved cursor
			// telemetry, not baked live — the raw recording always captures at
			// scale 1 so zoom regions stay reviewable/editable afterward.
			const compositor = new Compositor({
				outputWidth: Math.round(outputWidth),
				outputHeight: Math.round(outputHeight),
				getSourceElement: () => sourceVideoElRef.current,
				getWebcamElement: () => webcamVideoElRef.current,
				background: settings.background,
				customBackgroundImage,
				customBackgroundColor: settings.customBackgroundColor,
				getBackgroundVideoElement: () => backgroundVideoElRef.current,
				backgroundBlur: settings.backgroundBlur,
				autoZoomEnabled: false,
				cropAspect: settings.cropAspect,
				cropRegion: settings.cropRegion,
				webcamOverlay: settings.webcamOverlay,
				frameRadius: settings.background === "none" ? 0 : 24,
				frameShadowEnabled: settings.background !== "none",
				cursorRef: shouldTrackCursor ? cursorTelemetry.cursorRef : null,
				cursorAppearance: settings.cursorAppearance,
				customCursorImage,
				getPlaybackTimeMs: () => Date.now(),
			});
			compositorRef.current = compositor;
			compositor.start();

			const canvasStream = compositor.captureStream(30);
			const combinedStream = new MediaStream([
				...canvasStream.getVideoTracks(),
				...audioTracks,
			]);

			chunksRef.current = [];
			const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
				? "video/webm;codecs=vp9,opus"
				: "video/webm";
			const recorder = new MediaRecorder(combinedStream, { mimeType });
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.onstop = () => {
				void finalizeRecording();
			};
			mediaRecorderRef.current = recorder;
			recorder.start(1000);

			startedAtRef.current = Date.now();
			setElapsedMs(0);
			startTicking();
			setStatus("recording");
		} catch (caughtError) {
			setStatus("idle");
			setError(caughtError instanceof Error ? caughtError.message : "Could not start recording.");
		}
	}, [
		beginNativeCapture,
		cursorTelemetry,
		finalizeRecording,
		micEnabled,
		nativeCaptureAvailable,
		selectedSourceId,
		settings,
		sources,
		startTicking,
	]);

	const requestStart = useCallback(async () => {
		if (!selectedSourceId) {
			setError("Choose a screen or window to record first.");
			return;
		}
		setError(null);
		setStatus("counting-down");
		await window.recly.beginCountdown();
	}, [selectedSourceId]);

	const pause = useCallback(() => {
		if (nativeModeActiveRef.current) return; // Native capture doesn't support pause/resume yet.
		mediaRecorderRef.current?.pause();
		stopTicking();
		setStatus("paused");
	}, [stopTicking]);

	const resume = useCallback(() => {
		if (nativeModeActiveRef.current) return;
		mediaRecorderRef.current?.resume();
		startedAtRef.current = Date.now() - elapsedMs;
		startTicking();
		setStatus("recording");
	}, [elapsedMs, startTicking]);

	const stop = useCallback(() => {
		if (nativeModeActiveRef.current) {
			void finalizeNativeRecording();
			return;
		}
		mediaRecorderRef.current?.stop();
	}, [finalizeNativeRecording]);

	const statusRef = useRef<RecordingStatus>(status);
	statusRef.current = status;

	useEffect(() => {
		const offBeginCapture = window.recly.onBeginCapture(() => {
			void beginCapture();
		});
		const offHudCommand = window.recly.onHudCommand((command) => {
			if (command === "pause") pause();
			else if (command === "resume") resume();
			else if (command === "stop") stop();
		});
		const offGlobalShortcut = window.recly.onGlobalShortcut((action) => {
			if (action === "toggle-recording") {
				if (statusRef.current === "idle") void requestStart();
				else if (statusRef.current === "recording" || statusRef.current === "paused") stop();
			} else if (action === "pause-resume-recording") {
				if (statusRef.current === "recording") pause();
				else if (statusRef.current === "paused") resume();
			}
		});
		return () => {
			offBeginCapture();
			offHudCommand();
			offGlobalShortcut();
		};
	}, [beginCapture, pause, requestStart, resume, stop]);

	useEffect(() => stopTicking, [stopTicking]);

	return {
		sources,
		selectedSourceId,
		setSelectedSourceId,
		refreshSources,
		micEnabled,
		toggleMic,
		settings,
		updateSetting,
		nativeCaptureAvailable,
		screenRecordingPermissionDenied,
		openScreenRecordingPreferences,
		status,
		elapsedMs,
		lastSavedPath,
		error,
		start: requestStart,
		pause,
		resume,
		stop,
	};
}

export type {
	BackgroundChoice,
	CropAspect,
	CropRegion,
	CursorClickEffectStyle,
	CursorSkin,
	WebcamOverlaySettings,
	WebcamPosition,
};
