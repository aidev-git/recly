import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptionProgress } from "../../../electron/captions/transcribe";
import type {
	Annotation,
	AudioRegion,
	CaptionCue,
	ClipRegion,
	CursorSampleRecord,
} from "../../../electron/project/projectTypes";
import type { ExportAudioRegionInput, ExportFormat, ExportQuality } from "../../../electron/export/exportMedia";
import { loadWhisperModelSize, saveWhisperModelSize } from "@/lib/settings";
import { captionsToSrt } from "@/lib/subtitleExport";
import {
	createDefaultProject,
	getSequenceDurationMs,
	type ReclyProject,
	resolveSequencePosition,
	suggestZoomRegionsFromTelemetry,
} from "../../../electron/project/projectTypes";
import { Compositor } from "@/lib/compositor";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { useI18n } from "@/hooks/useI18n";
import { computeWaveformPeaks } from "@/lib/waveform";
import { createModernVideoEncoder } from "@/lib/modernExport";
import {
	audioBufferToWav,
	computeSequenceFrameTimestamps,
	fetchVideoBlob,
	openFastVideoSource,
	renderSequenceAudioOffline,
} from "@/lib/fastExport";
import {
	type EditorShortcutsConfig,
	eventMatchesShortcut,
	loadEditorShortcuts,
	saveEditorShortcuts,
} from "@/lib/editorShortcuts";
import { AnnotationList } from "./AnnotationList";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { ANNOTATION_TOOLS, AnnotationToolbar } from "./AnnotationToolbar";
import { AudioRegionsPanel } from "./AudioRegionsPanel";
import { CaptionsPanel } from "./CaptionsPanel";
import { EditorAnnouncementBanner } from "../announcements/EditorAnnouncementBanner";
import { ExtensionsPanel } from "./ExtensionsPanel";
import { ClipSequenceEditor } from "./ClipSequenceEditor";
import { EditorShortcutsDialog } from "./EditorShortcutsDialog";
import { ExportPanel } from "./ExportPanel";
import { MultiTrackTimeline } from "./MultiTrackTimeline";
import { ProjectBrowserDialog } from "./ProjectBrowserDialog";
import { ZoomRegionEditor } from "./ZoomRegionEditor";

function toFileUrl(filePath: string): string {
	return `file://${filePath.replace(/\\/g, "/")}`;
}

function loadImage(filePath: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = toFileUrl(filePath);
	});
}

export function EditorWindow() {
	const { t } = useI18n();
	const videoElRef = useRef<HTMLVideoElement | null>(null);
	const backgroundVideoElRef = useRef<HTMLVideoElement | null>(null);
	const previewContainerRef = useRef<HTMLDivElement | null>(null);
	const compositorRef = useRef<Compositor | null>(null);
	const draftAnnotationStartRef = useRef<{ xNorm: number; yNorm: number } | null>(null);
	const pendingImagePathRef = useRef<string | null>(null);
	const annotationImagesRef = useRef<Record<string, HTMLImageElement>>({});
	const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
	const sequencePlayheadMsRef = useRef(0);
	const activeClipIndexRef = useRef(0);

	const [videoPath, setVideoPath] = useState<string | null>(null);
	const { project, setProject, resetProject, resetProjectIfEmpty, undo, redo, canUndo, canRedo } =
		useEditorHistory<ReclyProject>();
	const [cursorSamples, setCursorSamples] = useState<CursorSampleRecord[]>([]);
	const [cropPreviewSrc, setCropPreviewSrc] = useState<string | null>(null);
	const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
	const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
	const [captionProgress, setCaptionProgress] = useState<TranscriptionProgress | null>(null);
	const [whisperModelSize, setWhisperModelSize] = useState(loadWhisperModelSize);
	const [editorShortcuts, setEditorShortcuts] = useState<EditorShortcutsConfig>(loadEditorShortcuts);
	const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
	const [showProjectBrowser, setShowProjectBrowser] = useState(false);
	const [sequencePlayheadMs, setSequencePlayheadMs] = useState(0);
	const [sourcePlayheadMs, setSourcePlayheadMs] = useState(0);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [selectedZoomRegionId, setSelectedZoomRegionId] = useState<string | null>(null);
	const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
	const [placingType, setPlacingType] = useState<Annotation["type"] | null>(null);
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
	const [editingTextId, setEditingTextId] = useState<string | null>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [exportedPath, setExportedPath] = useState<string | null>(null);
	const [exportMetrics, setExportMetrics] = useState<{ durationMs: number; fileSizeBytes: number } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const skipNextDirtyMarkRef = useRef(true);

	sequencePlayheadMsRef.current = sequencePlayheadMs;

	useEffect(() => {
		return window.recly.onEditorOpenVideo((path) => {
			setVideoPath(path);
			resetProject(null);
		});
	}, [resetProject]);

	useEffect(() => {
		return window.recly.onEditorOpenProject(({ project }) => {
			skipNextDirtyMarkRef.current = true;
			setVideoPath(project.videoPath);
			resetProject(project);
			setSelectedClipId(project.clips[0]?.id ?? null);
			setHasUnsavedChanges(false);
		});
	}, [resetProject]);

	useEffect(() => {
		if (!project) return;
		if (skipNextDirtyMarkRef.current) {
			skipNextDirtyMarkRef.current = false;
			return;
		}
		setHasUnsavedChanges(true);
	}, [project]);

	useEffect(() => {
		window.recly.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	const handleSaveProject = useCallback(async () => {
		if (!project) return null;
		const savedPath = await window.recly.saveProject(project);
		if (savedPath) setHasUnsavedChanges(false);
		return savedPath;
	}, [project]);

	useEffect(() => {
		return window.recly.onMenuSaveProject(() => {
			void handleSaveProject();
		});
	}, [handleSaveProject]);

	useEffect(() => {
		return window.recly.onMenuOpenProject(() => {
			setShowProjectBrowser(true);
		});
	}, []);

	useEffect(() => {
		return window.recly.onRequestSaveBeforeClose(() => {
			void handleSaveProject().then((savedPath) => {
				window.recly.saveBeforeCloseDone(savedPath !== null);
			});
		});
	}, [handleSaveProject]);

	useEffect(() => {
		const video = videoElRef.current;
		if (!videoPath || !video) return;

		video.src = toFileUrl(videoPath);
		const handleLoaded = async () => {
			const durationMs = Math.round(video.duration * 1000);
			const micSidecarPath = await window.recly.checkMicSidecar(videoPath);
			skipNextDirtyMarkRef.current = true;
			resetProjectIfEmpty(() => {
				const next = createDefaultProject(videoPath, durationMs);
				if (micSidecarPath) {
					const micRegion: AudioRegion = {
						id: "audio-mic",
						filePath: micSidecarPath,
						startMs: 0,
						durationMs,
						offsetMs: 0,
						volume: 1,
						normalize: false,
					};
					next.audioRegions.push(micRegion);
				}
				setSelectedClipId(next.clips[0].id);
				return next;
			});
		};
		video.addEventListener("loadedmetadata", handleLoaded);

		const captureCropPreviewFrame = () => {
			if (video.videoWidth === 0) return;
			const canvas = document.createElement("canvas");
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const frameCtx = canvas.getContext("2d");
			if (!frameCtx) return;
			frameCtx.drawImage(video, 0, 0);
			setCropPreviewSrc(canvas.toDataURL("image/jpeg", 0.7));
		};
		video.addEventListener("loadeddata", captureCropPreviewFrame);

		void window.recly.loadCursorTelemetry(videoPath).then(setCursorSamples);

		return () => {
			video.removeEventListener("loadedmetadata", handleLoaded);
			video.removeEventListener("loadeddata", captureCropPreviewFrame);
		};
	}, [videoPath, resetProjectIfEmpty]);

	useEffect(() => {
		setWaveformPeaks(null);
		if (!videoPath) return;
		let cancelled = false;
		void computeWaveformPeaks(toFileUrl(videoPath), 240)
			.then((peaks) => {
				if (!cancelled) setWaveformPeaks(peaks);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [videoPath]);

	useEffect(() => {
		const video = videoElRef.current;
		if (!video || !project || compositorRef.current) return;

		const compositor = new Compositor({
			outputWidth: 960,
			outputHeight: 540,
			getSourceElement: () => videoElRef.current,
			background: project.background,
			customBackgroundImage: null,
			customBackgroundColor: project.customBackgroundColor,
			getBackgroundVideoElement: () => backgroundVideoElRef.current,
			backgroundBlur: project.backgroundBlur,
			autoZoomEnabled: false,
			zoomRegions: project.zoomRegions,
			cropAspect: project.cropAspect,
			cropRegion: project.cropRegion,
			frameRadius: project.frameRadius,
			frameShadowEnabled: project.frameShadowEnabled,
			framePadding: project.framePadding,
			cursorRef: null,
			annotations: project.annotations,
			getAnnotationImage: (path) => annotationImagesRef.current[path] ?? null,
			captions: project.captions,
			captionSettings: project.captionSettings,
			getPlaybackTimeMs: () => (videoElRef.current?.currentTime ?? 0) * 1000,
		});
		compositorRef.current = compositor;
		previewContainerRef.current?.appendChild(compositor.canvasElement);
		compositor.canvasElement.className = "h-full w-full rounded-xl";
		compositor.start();

		const firstClip = project.clips[0];
		video.currentTime = firstClip.sourceStartMs / 1000;
		video.playbackRate = firstClip.speed;
		video.muted = firstClip.muted ?? false;
		activeClipIndexRef.current = 0;

		return () => {
			compositor.stop();
			compositor.canvasElement.remove();
			compositorRef.current = null;
		};
	}, [project]);

	useEffect(() => {
		if (!project || project.background !== "custom" || !project.customBackgroundPath) {
			compositorRef.current?.updateConfig({ customBackgroundImage: null });
			return;
		}
		let cancelled = false;
		void loadImage(project.customBackgroundPath).then((image) => {
			if (!cancelled) compositorRef.current?.updateConfig({ customBackgroundImage: image });
		});
		return () => {
			cancelled = true;
		};
	}, [project?.background, project?.customBackgroundPath]);

	useEffect(() => {
		const backgroundVideo = backgroundVideoElRef.current;
		if (!backgroundVideo || !project?.customBackgroundVideoPath) return;
		backgroundVideo.src = toFileUrl(project.customBackgroundVideoPath);
		backgroundVideo.loop = true;
		backgroundVideo.muted = true;
		void backgroundVideo.play();
	}, [project?.customBackgroundVideoPath]);

	useEffect(() => {
		if (!project) return;
		compositorRef.current?.updateConfig({
			background: project.background,
			cropAspect: project.cropAspect,
			cropRegion: project.cropRegion,
			frameRadius: project.frameRadius,
			frameShadowEnabled: project.frameShadowEnabled,
			framePadding: project.framePadding,
			customBackgroundColor: project.customBackgroundColor,
			backgroundBlur: project.backgroundBlur,
			annotations: project.annotations,
			zoomRegions: project.zoomRegions,
			captions: project.captions,
			captionSettings: project.captionSettings,
			textAnnotationFontFamily: project.customFontFamily ?? undefined,
		});
	}, [project]);

	useEffect(() => {
		if (!project?.customFontPath || !project.customFontFamily) return;
		let cancelled = false;
		const fontFace = new FontFace(project.customFontFamily, `url(${toFileUrl(project.customFontPath)})`);
		void fontFace.load().then((loaded) => {
			if (cancelled) return;
			document.fonts.add(loaded);
			compositorRef.current?.updateConfig({ textAnnotationFontFamily: project.customFontFamily ?? undefined });
		});
		return () => {
			cancelled = true;
		};
	}, [project?.customFontPath, project?.customFontFamily]);

	// Advances through the clip sequence: when playback crosses the active
	// clip's out-point, jump to the next clip's in-point (or stop at the end).
	useEffect(() => {
		const video = videoElRef.current;
		if (!video || !project) return;

		const handler = () => {
			const clips = project.clips;
			const activeIndex = activeClipIndexRef.current;
			const activeClip = clips[activeIndex];
			if (!activeClip) return;

			const currentMs = video.currentTime * 1000;
			setSourcePlayheadMs(currentMs);
			if (currentMs >= activeClip.sourceEndMs - 15) {
				const nextClip = clips[activeIndex + 1];
				if (nextClip) {
					activeClipIndexRef.current = activeIndex + 1;
					video.currentTime = nextClip.sourceStartMs / 1000;
					video.playbackRate = nextClip.speed;
					video.muted = nextClip.muted ?? false;
				} else if (!video.paused) {
					video.pause();
				}
			}

			let precedingOutputMs = 0;
			for (let i = 0; i < activeClipIndexRef.current; i += 1) {
				const clip = clips[i];
				precedingOutputMs += (clip.sourceEndMs - clip.sourceStartMs) / clip.speed;
			}
			const withinClipMs = Math.max(0, currentMs - clips[activeClipIndexRef.current].sourceStartMs);
			setSequencePlayheadMs(precedingOutputMs + withinClipMs / clips[activeClipIndexRef.current].speed);
		};

		video.addEventListener("timeupdate", handler);
		return () => video.removeEventListener("timeupdate", handler);
	}, [project]);

	const seekSequence = useCallback(
		(sequenceMs: number) => {
			const video = videoElRef.current;
			if (!video || !project) return;
			const resolved = resolveSequencePosition(project.clips, sequenceMs);
			if (!resolved) return;
			activeClipIndexRef.current = resolved.clipIndex;
			video.currentTime = resolved.sourceTimeMs / 1000;
			video.playbackRate = resolved.clip.speed;
			video.muted = resolved.clip.muted ?? false;
			setSequencePlayheadMs(sequenceMs);
		},
		[project],
	);

	const seekSourceTime = useCallback((sourceMs: number) => {
		const video = videoElRef.current;
		if (!video) return;
		video.currentTime = sourceMs / 1000;
		setSourcePlayheadMs(sourceMs);
	}, []);

	const togglePlayback = useCallback(() => {
		const video = videoElRef.current;
		if (!video) return;
		if (video.paused) void video.play();
		else video.pause();
	}, []);

	const updateClip = useCallback(
		(clipId: string, patch: Partial<ClipRegion>) => {
			if (!project) return;
			setProject({
				...project,
				clips: project.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
			});
		},
		[project],
	);

	const splitAtPlayhead = useCallback(() => {
		const video = videoElRef.current;
		if (!video || !project) return;
		const activeIndex = activeClipIndexRef.current;
		const activeClip = project.clips[activeIndex];
		const splitAtMs = video.currentTime * 1000;
		if (splitAtMs <= activeClip.sourceStartMs + 100 || splitAtMs >= activeClip.sourceEndMs - 100) return;

		const first: ClipRegion = { ...activeClip, sourceEndMs: splitAtMs };
		const second: ClipRegion = { ...activeClip, id: `clip-${Date.now()}`, sourceStartMs: splitAtMs };
		const nextClips = [...project.clips];
		nextClips.splice(activeIndex, 1, first, second);
		setProject({ ...project, clips: nextClips });
	}, [project]);

	const deleteClip = useCallback(
		(clipId: string) => {
			if (!project || project.clips.length <= 1) return;
			const nextClips = project.clips.filter((clip) => clip.id !== clipId);
			setProject({ ...project, clips: nextClips });
			setSelectedClipId(nextClips[0]?.id ?? null);
		},
		[project],
	);

	const moveClip = useCallback(
		(clipId: string, direction: -1 | 1) => {
			if (!project) return;
			const index = project.clips.findIndex((clip) => clip.id === clipId);
			const targetIndex = index + direction;
			if (index === -1 || targetIndex < 0 || targetIndex >= project.clips.length) return;
			const nextClips = [...project.clips];
			[nextClips[index], nextClips[targetIndex]] = [nextClips[targetIndex], nextClips[index]];
			setProject({ ...project, clips: nextClips });
		},
		[project],
	);

	const reorderClips = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (!project) return;
			const nextClips = [...project.clips];
			const [moved] = nextClips.splice(fromIndex, 1);
			if (!moved) return;
			nextClips.splice(toIndex, 0, moved);
			setProject({ ...project, clips: nextClips });
		},
		[project],
	);

	const autoDetectZoomRegions = useCallback(() => {
		if (!project) return;
		const regions = suggestZoomRegionsFromTelemetry(cursorSamples, project.durationMs);
		setProject({ ...project, zoomRegions: regions });
	}, [cursorSamples, project]);

	const addZoomRegionAtPlayhead = useCallback(() => {
		const video = videoElRef.current;
		if (!video || !project) return;
		const centerMs = video.currentTime * 1000;
		setProject({
			...project,
			zoomRegions: [
				...project.zoomRegions,
				{
					id: `zoom-${Date.now()}`,
					startMs: Math.max(0, centerMs - 1000),
					endMs: Math.min(project.durationMs, centerMs + 1000),
					focusXNorm: 0.5,
					focusYNorm: 0.5,
					depth: 2,
					easingIn: "smooth",
					easingOut: "smooth",
					durationInMs: 400,
					durationOutMs: 400,
				},
			],
		});
	}, [project]);

	const createZoomRegion = useCallback(
		(startMs: number, endMs: number) => {
			if (!project) return;
			const id = `zoom-${Date.now()}`;
			setProject({
				...project,
				zoomRegions: [
					...project.zoomRegions,
					{
						id,
						startMs,
						endMs,
						focusXNorm: 0.5,
						focusYNorm: 0.5,
						depth: 2,
						easingIn: "smooth",
						easingOut: "smooth",
						durationInMs: 400,
						durationOutMs: 400,
					},
				],
			});
			setSelectedZoomRegionId(id);
		},
		[project],
	);

	const handleCanvasPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!placingType || !compositorRef.current) return;
			const canvas = compositorRef.current.canvasElement;
			const rect = canvas.getBoundingClientRect();
			const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
			const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
			const point = compositorRef.current.mapCanvasPointToNormalized(x, y);
			if (point) draftAnnotationStartRef.current = point;
		},
		[placingType],
	);

	const handleCanvasPointerUp = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!placingType || !compositorRef.current || !draftAnnotationStartRef.current || !project)
				return;

			const canvas = compositorRef.current.canvasElement;
			const rect = canvas.getBoundingClientRect();
			const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
			const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
			const end = compositorRef.current.mapCanvasPointToNormalized(x, y);
			const start = draftAnnotationStartRef.current;
			draftAnnotationStartRef.current = null;
			if (!end) return;

			const video = videoElRef.current;
			const id = `${Date.now()}`;
			const isText = placingType === "text";
			const annotation: Annotation = {
				id,
				type: placingType,
				timestampMs: video ? video.currentTime * 1000 : 0,
				xNorm: Math.min(start.xNorm, end.xNorm),
				yNorm: Math.min(start.yNorm, end.yNorm),
				wNorm: isText ? 0.16 : Math.abs(end.xNorm - start.xNorm) || 0.08,
				hNorm: isText ? 0.05 : Math.abs(end.yNorm - start.yNorm) || 0.08,
				color: placingType === "blur" ? "#000000" : "#b99fc2",
				...(isText ? { text: "" } : {}),
				...(placingType === "image" && pendingImagePathRef.current
					? { imagePath: pendingImagePathRef.current }
					: {}),
			};

			pendingImagePathRef.current = null;
			setProject({ ...project, annotations: [...project.annotations, annotation] });
			setPlacingType(null);
			if (isText) setEditingTextId(id);
		},
		[placingType, project],
	);

	const handleSelectTool = useCallback((type: Annotation["type"] | null) => {
		if (type === "image") {
			void window.recly.chooseAnnotationImage().then((chosen) => {
				if (!chosen) return;
				pendingImagePathRef.current = chosen;
				setPlacingType("image");
			});
			return;
		}
		setPlacingType(type);
	}, []);

	const deleteAnnotation = useCallback(
		(id: string) => {
			if (!project) return;
			setProject({ ...project, annotations: project.annotations.filter((a) => a.id !== id) });
			setSelectedAnnotationId((current) => (current === id ? null : current));
		},
		[project],
	);

	const updateAnnotation = useCallback(
		(id: string, patch: Partial<Annotation>) => {
			if (!project) return;
			setProject({
				...project,
				annotations: project.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
			});
		},
		[project],
	);

	const handleChooseAnnotationImage = useCallback(
		(id: string) => {
			void window.recly.chooseAnnotationImage().then((chosen) => {
				if (!chosen) return;
				updateAnnotation(id, { imagePath: chosen });
			});
		},
		[updateAnnotation],
	);

	useEffect(() => {
		if (!project) return;
		for (const annotation of project.annotations) {
			if (
				annotation.type === "image" &&
				annotation.imagePath &&
				!annotationImagesRef.current[annotation.imagePath]
			) {
				const path = annotation.imagePath;
				void loadImage(path)
					.then((image) => {
						annotationImagesRef.current[path] = image;
					})
					.catch(() => undefined);
			}
		}
	}, [project?.annotations]);

	const addAudioRegion = useCallback(async () => {
		const chosen = await window.recly.chooseAudioFile();
		if (!chosen || !project) return;

		const durationMs = await new Promise<number>((resolve) => {
			const probe = new Audio(toFileUrl(chosen));
			probe.addEventListener("loadedmetadata", () => resolve(probe.duration * 1000 || 10000));
			probe.addEventListener("error", () => resolve(10000));
		});

		const region: AudioRegion = {
			id: `audio-${Date.now()}`,
			filePath: chosen,
			startMs: Math.round(sequencePlayheadMsRef.current),
			durationMs: Math.round(durationMs),
			offsetMs: 0,
			volume: 1,
			normalize: false,
		};
		setProject({ ...project, audioRegions: [...project.audioRegions, region] });
	}, [project]);

	const updateAudioRegion = useCallback(
		(id: string, patch: Partial<AudioRegion>) => {
			if (!project) return;
			setProject({
				...project,
				audioRegions: project.audioRegions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
			});
		},
		[project],
	);

	const deleteAudioRegion = useCallback(
		(id: string) => {
			if (!project) return;
			audioElementsRef.current[id]?.pause();
			delete audioElementsRef.current[id];
			setProject({ ...project, audioRegions: project.audioRegions.filter((r) => r.id !== id) });
		},
		[project],
	);

	useEffect(() => {
		return window.recly.onCaptionProgress(setCaptionProgress);
	}, []);

	const generateCaptions = useCallback(async () => {
		if (!videoPath || !project || isGeneratingCaptions) return;
		setIsGeneratingCaptions(true);
		setCaptionProgress(null);
		try {
			const captions = await window.recly.transcribeCaptions(
				videoPath,
				whisperModelSize,
				project.captionSettings.language,
			);
			setProject({ ...project, captions });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Caption generation failed.");
		} finally {
			setIsGeneratingCaptions(false);
			setCaptionProgress(null);
		}
	}, [videoPath, project, isGeneratingCaptions, whisperModelSize]);

	const updateWhisperModelSize = useCallback((size: "tiny" | "base" | "small") => {
		setWhisperModelSize(size);
		saveWhisperModelSize(size);
	}, []);

	const updateCaption = useCallback(
		(id: string, patch: Partial<CaptionCue>) => {
			if (!project) return;
			setProject({
				...project,
				captions: project.captions.map((cue) => (cue.id === id ? { ...cue, ...patch } : cue)),
			});
		},
		[project],
	);

	const deleteCaption = useCallback(
		(id: string) => {
			if (!project) return;
			setProject({ ...project, captions: project.captions.filter((cue) => cue.id !== id) });
		},
		[project],
	);

	// Keeps each standalone audio region's <audio> element in sync with the
	// main video's playback: playing/pausing and seeking it to match the
	// sequence playhead whenever it falls within the region's window.
	useEffect(() => {
		const video = videoElRef.current;
		if (!video || !project) return;

		const audioEls = audioElementsRef.current;
		const currentIds = new Set(project.audioRegions.map((r) => r.id));
		for (const id of Object.keys(audioEls)) {
			if (!currentIds.has(id)) {
				audioEls[id].pause();
				delete audioEls[id];
			}
		}
		for (const region of project.audioRegions) {
			if (!audioEls[region.id]) {
				audioEls[region.id] = new Audio(toFileUrl(region.filePath));
			}
			audioEls[region.id].volume = Math.min(1, Math.max(0, region.volume));
		}

		const sync = () => {
			const sequenceMs = sequencePlayheadMsRef.current;
			for (const region of project.audioRegions) {
				const audio = audioEls[region.id];
				if (!audio) continue;
				const withinMs = sequenceMs - region.startMs;
				const active = withinMs >= 0 && withinMs < region.durationMs;
				if (active && !video.paused) {
					const targetSec = (region.offsetMs + withinMs) / 1000;
					if (Math.abs(audio.currentTime - targetSec) > 0.15) audio.currentTime = targetSec;
					if (audio.paused) void audio.play().catch(() => undefined);
				} else if (!audio.paused) {
					audio.pause();
				}
			}
		};
		video.addEventListener("timeupdate", sync);
		video.addEventListener("pause", sync);
		return () => {
			video.removeEventListener("timeupdate", sync);
			video.removeEventListener("pause", sync);
		};
	}, [project]);

	useEffect(() => {
		return () => {
			for (const audio of Object.values(audioElementsRef.current)) audio.pause();
		};
	}, []);

	const moveAnnotation = useCallback(
		(id: string, xNorm: number, yNorm: number) => {
			if (!project) return;
			setProject({
				...project,
				annotations: project.annotations.map((a) => (a.id === id ? { ...a, xNorm, yNorm } : a)),
			});
		},
		[project],
	);

	const resizeAnnotation = useCallback(
		(id: string, wNorm: number, hNorm: number) => {
			if (!project) return;
			setProject({
				...project,
				annotations: project.annotations.map((a) => (a.id === id ? { ...a, wNorm, hNorm } : a)),
			});
		},
		[project],
	);

	const commitAnnotationText = useCallback(
		(id: string, text: string) => {
			if (!project) return;
			if (text.trim() === "") {
				setProject({ ...project, annotations: project.annotations.filter((a) => a.id !== id) });
			} else {
				setProject({
					...project,
					annotations: project.annotations.map((a) => (a.id === id ? { ...a, text } : a)),
				});
			}
			setEditingTextId(null);
		},
		[project],
	);

	const runFastModernExport = useCallback(
		async (
			compositor: Compositor,
			currentProject: ReclyProject,
			currentVideoPath: string,
			captureFps: number,
			audioRegionsPayload: ExportAudioRegionInput[],
			directory: string,
			fileName: string,
		) => {
			const fileUrl = toFileUrl(currentVideoPath);
			const videoBlob = await fetchVideoBlob(fileUrl);
			const fastSource = await openFastVideoSource(videoBlob);
			if (!fastSource) throw new Error("Could not open the recording for fast export.");

			const currentCanvasRef: { current: HTMLCanvasElement | OffscreenCanvas | null } = { current: null };
			const currentPlaybackMsRef: { current: number } = { current: 0 };
			compositor.updateConfig({
				getSourceElement: () => currentCanvasRef.current,
				getPlaybackTimeMs: () => currentPlaybackMsRef.current,
			});

			const videoEncoder = createModernVideoEncoder(
				compositor.canvasElement,
				captureFps,
				currentProject.exportQuality,
			);

			try {
				const timestampsSeconds = computeSequenceFrameTimestamps(currentProject.clips, captureFps);
				let frameIndex = 0;
				for await (const wrapped of fastSource.canvasesForTimestamps(timestampsSeconds)) {
					if (wrapped) {
						currentCanvasRef.current = wrapped.canvas;
						currentPlaybackMsRef.current = wrapped.timestamp * 1000;
					} else {
						currentPlaybackMsRef.current = timestampsSeconds[frameIndex] * 1000;
					}
					compositor.renderOnce();
					await videoEncoder.addFrame(frameIndex / captureFps, 1 / captureFps);
					frameIndex += 1;
				}

				const videoBuffer = await videoEncoder.finish();
				const audioBuffer = await renderSequenceAudioOffline(videoBlob, currentProject.clips);
				const audioData = audioBuffer ? audioBufferToWav(audioBuffer) : null;

				return window.recly.exportPrecodedMp4({
					videoData: videoBuffer,
					audioData,
					audioDataFormat: "wav",
					audioRegions: audioRegionsPayload,
					directory,
					fileName,
				});
			} finally {
				fastSource.dispose();
				compositor.updateConfig({
					getSourceElement: () => videoElRef.current,
					getPlaybackTimeMs: () => (videoElRef.current?.currentTime ?? 0) * 1000,
				});
			}
		},
		[],
	);

	const runLegacyExport = useCallback(
		async (
			video: HTMLVideoElement,
			compositor: Compositor,
			currentProject: ReclyProject,
			captureFps: number,
			audioRegionsPayload: ExportAudioRegionInput[],
			directory: string,
			fileName: string,
		) => {
			const audioStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
			const canvasStream = compositor.captureStream(captureFps);
			const combinedStream = new MediaStream([
				...canvasStream.getVideoTracks(),
				...(audioStream?.getAudioTracks() ?? []),
			]);
			const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
				? "video/webm;codecs=vp9,opus"
				: "video/webm";

			const recorder = new MediaRecorder(combinedStream, { mimeType });
			const chunks: BlobPart[] = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};

			const finished = new Promise<void>((resolve) => {
				recorder.onstop = () => resolve();
			});

			recorder.start(500);

			for (let index = 0; index < currentProject.clips.length; index += 1) {
				const clip = currentProject.clips[index];
				activeClipIndexRef.current = index;
				video.currentTime = clip.sourceStartMs / 1000;
				video.playbackRate = clip.speed;
				video.muted = clip.muted ?? false;
				await new Promise((resolve) => setTimeout(resolve, 80));
				await video.play();

				await new Promise<void>((resolve) => {
					const checkEnd = () => {
						if (video.currentTime * 1000 >= clip.sourceEndMs - 15) {
							video.pause();
							video.removeEventListener("timeupdate", checkEnd);
							resolve();
						}
					};
					video.addEventListener("timeupdate", checkEnd);
				});
			}

			recorder.stop();
			await finished;

			return window.recly.exportMedia({
				data: await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
				directory,
				fileName,
				options:
					currentProject.exportFormat === "gif"
						? {
								format: "gif",
								frameRate: currentProject.exportGifFrameRate,
								sizePreset: currentProject.exportGifSizePreset,
								loop: currentProject.exportGifLoop,
							}
						: {
								format: "mp4",
								quality: currentProject.exportQuality,
								frameRate: currentProject.exportMp4FrameRate,
								audioRegions: audioRegionsPayload,
							},
			});
		},
		[],
	);

	const runExport = useCallback(async () => {
		const video = videoElRef.current;
		const compositor = compositorRef.current;
		if (!video || !compositor || !project || !videoPath) return;

		setIsExporting(true);
		setError(null);
		setExportedPath(null);
		setExportMetrics(null);
		const startedAt = performance.now();

		try {
			const useModernBackend = project.exportFormat === "mp4" && project.exportEncoderBackend === "modern";
			const captureFps = project.exportFormat === "gif" ? project.exportGifFrameRate : project.exportMp4FrameRate;
			const directory = videoPath.slice(
				0,
				Math.max(videoPath.lastIndexOf("\\"), videoPath.lastIndexOf("/")),
			);
			const fileName = `${videoPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "")}-export`;
			const audioRegionsPayload = project.audioRegions.map((region) => ({
				filePath: region.filePath,
				startMs: region.startMs,
				offsetMs: region.offsetMs,
				durationMs: region.durationMs,
				volume: region.volume,
				normalize: region.normalize,
			}));

			const result = useModernBackend
				? await runFastModernExport(
						compositor,
						project,
						videoPath,
						captureFps,
						audioRegionsPayload,
						directory,
						fileName,
					)
				: await runLegacyExport(video, compositor, project, captureFps, audioRegionsPayload, directory, fileName);

			if (project.includeCaptionSidecar && project.captions.length > 0) {
				const srtContents = captionsToSrt(project.captions, project.clips);
				if (srtContents.length > 0) {
					await window.recly.writeSubtitleSidecar(result.filePath, srtContents);
				}
			}

			setExportedPath(result.filePath);
			setExportMetrics({ durationMs: performance.now() - startedAt, fileSizeBytes: result.fileSizeBytes });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Export failed.");
		} finally {
			setIsExporting(false);
		}
	}, [project, videoPath, runFastModernExport, runLegacyExport]);

	const cycleAnnotationTool = useCallback(() => {
		setPlacingType((current) => {
			if (current === null) return ANNOTATION_TOOLS[0];
			const nextIndex = ANNOTATION_TOOLS.indexOf(current) + 1;
			return ANNOTATION_TOOLS[nextIndex] ?? null;
		});
	}, []);

	const updateEditorShortcuts = useCallback((next: EditorShortcutsConfig) => {
		setEditorShortcuts(next);
		saveEditorShortcuts(next);
	}, []);

	// User-remappable editor keybindings (see EditorShortcutsDialog); defaults
	// match the original fixed set (Space/S/Delete) plus two new actions.
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
			if (editingTextId || showShortcutsDialog) return;

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
				event.preventDefault();
				redo();
				return;
			}

			if (eventMatchesShortcut(event, editorShortcuts.playPause)) {
				event.preventDefault();
				togglePlayback();
			} else if (eventMatchesShortcut(event, editorShortcuts.splitClip)) {
				event.preventDefault();
				splitAtPlayhead();
			} else if (eventMatchesShortcut(event, editorShortcuts.deleteSelected)) {
				event.preventDefault();
				if (selectedAnnotationId) deleteAnnotation(selectedAnnotationId);
				else if (selectedClipId) deleteClip(selectedClipId);
			} else if (eventMatchesShortcut(event, editorShortcuts.addZoomAtPlayhead)) {
				event.preventDefault();
				addZoomRegionAtPlayhead();
			} else if (eventMatchesShortcut(event, editorShortcuts.cycleAnnotationTool)) {
				event.preventDefault();
				cycleAnnotationTool();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [
		editorShortcuts,
		togglePlayback,
		splitAtPlayhead,
		deleteAnnotation,
		deleteClip,
		selectedAnnotationId,
		selectedClipId,
		editingTextId,
		showShortcutsDialog,
		addZoomRegionAtPlayhead,
		cycleAnnotationTool,
		undo,
		redo,
	]);

	if (!videoPath || !project) {
		return (
			<div className="flex h-full items-center justify-center bg-brand-950 text-white/60">
				{t("editor.waiting")}
				<video ref={videoElRef} className="hidden" />
			</div>
		);
	}

	const totalDuration = getSequenceDurationMs(project.clips);

	return (
		<div className="flex h-full gap-4 bg-brand-950 p-4">
			<div className="flex flex-1 flex-col gap-3">
				<div
					ref={previewContainerRef}
					onPointerDown={(event) => {
						if (placingType) handleCanvasPointerDown(event);
						else setSelectedAnnotationId(null);
					}}
					onPointerUp={handleCanvasPointerUp}
					className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black ${
						placingType ? "cursor-crosshair" : ""
					}`}
				>
					<video ref={videoElRef} className="hidden" />
					<video ref={backgroundVideoElRef} className="hidden" />
					<AnnotationOverlay
						compositorRef={compositorRef}
						annotations={project.annotations}
						currentTimeMs={sourcePlayheadMs}
						selectedAnnotationId={selectedAnnotationId}
						editingTextId={editingTextId}
						onSelect={setSelectedAnnotationId}
						onMove={moveAnnotation}
						onResize={resizeAnnotation}
						onCommitText={commitAnnotationText}
						onCancelTextEdit={() => setEditingTextId(null)}
					/>
				</div>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={togglePlayback}
						className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/15"
					>
						{t("editor.playPause")}
					</button>
					<span className="text-[11px] text-white/50">
						{(sequencePlayheadMs / 1000).toFixed(1)}s / {(totalDuration / 1000).toFixed(1)}s
					</span>
				</div>

				<MultiTrackTimeline
					totalDurationMs={totalDuration}
					playheadMs={sequencePlayheadMs}
					onSeek={seekSequence}
					clips={project.clips}
					selectedClipId={selectedClipId}
					onSelectClip={setSelectedClipId}
					onReorderClips={reorderClips}
					zoomRegions={project.zoomRegions}
					selectedZoomRegionId={selectedZoomRegionId}
					onSelectZoomRegion={setSelectedZoomRegionId}
					onChangeZoomRegion={(id, patch) =>
						setProject({
							...project,
							zoomRegions: project.zoomRegions.map((region) =>
								region.id === id ? { ...region, ...patch } : region,
							),
						})
					}
					onCreateZoomRegion={createZoomRegion}
					waveformPeaks={waveformPeaks}
					audioRegions={project.audioRegions}
					onChangeAudioRegion={updateAudioRegion}
					captions={project.captions}
					selectedCaptionId={selectedCaptionId}
					onSelectCaption={setSelectedCaptionId}
					onChangeCaption={updateCaption}
				/>

				<ClipSequenceEditor
					clips={project.clips}
					selectedClipId={selectedClipId}
					onChangeClip={updateClip}
					onSplitAtPlayhead={splitAtPlayhead}
					onDeleteClip={deleteClip}
					onMoveClip={moveClip}
				/>

				<ZoomRegionEditor
					regions={project.zoomRegions}
					selectedRegionId={selectedZoomRegionId}
					onSelectRegion={setSelectedZoomRegionId}
					hasCursorTelemetry={cursorSamples.length > 0}
					onAutoDetect={autoDetectZoomRegions}
					onAddAtPlayhead={addZoomRegionAtPlayhead}
					onChangeRegion={(id, patch) =>
						setProject({
							...project,
							zoomRegions: project.zoomRegions.map((region) =>
								region.id === id ? { ...region, ...patch } : region,
							),
						})
					}
					onDeleteRegion={(id) =>
						setProject({
							...project,
							zoomRegions: project.zoomRegions.filter((region) => region.id !== id),
						})
					}
					onSeekTo={seekSourceTime}
				/>

				<AnnotationList
					annotations={project.annotations}
					selectedAnnotationId={selectedAnnotationId}
					onSelect={setSelectedAnnotationId}
					onSeekTo={seekSourceTime}
					onDelete={deleteAnnotation}
					onChange={updateAnnotation}
					onChooseImage={handleChooseAnnotationImage}
				/>

				<AudioRegionsPanel
					regions={project.audioRegions}
					onAdd={() => void addAudioRegion()}
					onChange={updateAudioRegion}
					onDelete={deleteAudioRegion}
				/>

				<CaptionsPanel
					captions={project.captions}
					isGenerating={isGeneratingCaptions}
					progress={captionProgress}
					modelSize={whisperModelSize}
					onChangeModelSize={updateWhisperModelSize}
					captionSettings={project.captionSettings}
					onChangeCaptionSettings={(patch) =>
						setProject({ ...project, captionSettings: { ...project.captionSettings, ...patch } })
					}
					onGenerate={() => void generateCaptions()}
					onChange={updateCaption}
					onDelete={deleteCaption}
					onSeekTo={seekSourceTime}
				/>

				{error && (
					<p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
						{error}
					</p>
				)}
			</div>

			<div className="flex w-72 flex-col gap-4 overflow-y-auto">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-white">{t("editor.title")}</span>
					<button
						type="button"
						onClick={undo}
						disabled={!canUndo}
						title={t("editorHistory.undo")}
						className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
					>
						↺
					</button>
					<button
						type="button"
						onClick={redo}
						disabled={!canRedo}
						title={t("editorHistory.redo")}
						className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
					>
						↻
					</button>
					<button
						type="button"
						onClick={() => setShowShortcutsDialog(true)}
						className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
					>
						{t("editorShortcut.title")}
					</button>
				</div>

				{showShortcutsDialog && (
					<EditorShortcutsDialog
						config={editorShortcuts}
						onChange={updateEditorShortcuts}
						onClose={() => setShowShortcutsDialog(false)}
					/>
				)}

				<AnnotationToolbar
					placingType={placingType}
					onSelectTool={handleSelectTool}
					background={project.background}
					onChangeBackground={(background) => setProject({ ...project, background })}
					onChooseCustomBackground={async () => {
						const chosenPath = await window.recly.chooseBackgroundImage();
						if (!chosenPath) return;
						setProject({ ...project, background: "custom", customBackgroundPath: chosenPath });
					}}
					onChooseCustomBackgroundVideo={async () => {
						const chosenPath = await window.recly.chooseBackgroundVideo();
						if (!chosenPath) return;
						setProject({ ...project, background: "video", customBackgroundVideoPath: chosenPath });
					}}
					customBackgroundColor={project.customBackgroundColor}
					onChangeBackgroundColor={(customBackgroundColor) =>
						setProject({ ...project, background: "color", customBackgroundColor })
					}
					backgroundBlur={project.backgroundBlur}
					onChangeBackgroundBlur={(backgroundBlur) => setProject({ ...project, backgroundBlur })}
					cropAspect={project.cropAspect}
					onChangeCropAspect={(cropAspect) => setProject({ ...project, cropAspect })}
					cropRegion={project.cropRegion}
					onChangeCropRegion={(cropRegion) => setProject({ ...project, cropRegion })}
					cropPreviewSrc={cropPreviewSrc}
					frameShadowEnabled={project.frameShadowEnabled}
					onToggleFrameShadow={() =>
						setProject({ ...project, frameShadowEnabled: !project.frameShadowEnabled })
					}
					frameRadius={project.frameRadius}
					onChangeFrameRadius={(frameRadius) => setProject({ ...project, frameRadius })}
					framePadding={project.framePadding}
					onChangeFramePadding={(framePadding) => setProject({ ...project, framePadding })}
					customFontFamily={project.customFontFamily}
					onChooseCustomFont={async () => {
						const chosenPath = await window.recly.chooseFontFile();
						if (!chosenPath) return;
						const baseName = chosenPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "CustomFont";
						const familyName = `recly-custom-${baseName.replace(/[^a-zA-Z0-9]/g, "")}`;
						setProject({ ...project, customFontPath: chosenPath, customFontFamily: familyName });
					}}
				/>

				<ExportPanel
					format={project.exportFormat}
					quality={project.exportQuality}
					mp4FrameRate={project.exportMp4FrameRate}
					gifFrameRate={project.exportGifFrameRate}
					gifSizePreset={project.exportGifSizePreset}
					gifLoop={project.exportGifLoop}
					encoderBackend={project.exportEncoderBackend}
					onChangeEncoderBackend={(exportEncoderBackend) => setProject({ ...project, exportEncoderBackend })}
					onChangeFormat={(format: ExportFormat) => setProject({ ...project, exportFormat: format })}
					onChangeQuality={(quality: ExportQuality) => setProject({ ...project, exportQuality: quality })}
					onChangeMp4FrameRate={(exportMp4FrameRate) => setProject({ ...project, exportMp4FrameRate })}
					onChangeGifFrameRate={(exportGifFrameRate) => setProject({ ...project, exportGifFrameRate })}
					onChangeGifSizePreset={(exportGifSizePreset) => setProject({ ...project, exportGifSizePreset })}
					onChangeGifLoop={(exportGifLoop) => setProject({ ...project, exportGifLoop })}
					hasCaptions={project.captions.length > 0}
					includeCaptionSidecar={project.includeCaptionSidecar}
					onChangeIncludeCaptionSidecar={(includeCaptionSidecar) =>
						setProject({ ...project, includeCaptionSidecar })
					}
					isExporting={isExporting}
					exportedPath={exportedPath}
					metrics={exportMetrics}
					onExport={() => void runExport()}
					onReveal={() => exportedPath && void window.recly.revealInFolder(exportedPath)}
				/>

				<EditorAnnouncementBanner />

				<ExtensionsPanel />

				<button
					type="button"
					onClick={() => void handleSaveProject().then(() => setShowProjectBrowser(false))}
					className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
				>
					{t("editor.saveProject")}
				</button>
				<button
					type="button"
					onClick={() => setShowProjectBrowser(true)}
					className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
				>
					{t("editor.openProject")}
				</button>
				{showProjectBrowser && (
					<ProjectBrowserDialog
						onOpen={(filePath) => {
							void window.recly.openProjectAt(filePath).then((opened) => {
								if (!opened) return;
								skipNextDirtyMarkRef.current = true;
								setVideoPath(opened.project.videoPath);
								resetProject(opened.project);
								setSelectedClipId(opened.project.clips[0]?.id ?? null);
								setHasUnsavedChanges(false);
								setShowProjectBrowser(false);
							});
						}}
						onBrowseFile={() => {
							void window.recly.openProject().then((opened) => {
								if (!opened) return;
								skipNextDirtyMarkRef.current = true;
								setVideoPath(opened.project.videoPath);
								resetProject(opened.project);
								setSelectedClipId(opened.project.clips[0]?.id ?? null);
								setHasUnsavedChanges(false);
								setShowProjectBrowser(false);
							});
						}}
						onClose={() => setShowProjectBrowser(false)}
					/>
				)}
			</div>
		</div>
	);
}
