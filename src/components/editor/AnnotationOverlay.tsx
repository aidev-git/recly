import { useCallback } from "react";
import type { Annotation } from "../../../electron/project/projectTypes";
import type { Compositor } from "@/lib/compositor";

interface AnnotationOverlayProps {
	compositorRef: React.RefObject<Compositor | null>;
	annotations: Annotation[];
	currentTimeMs: number;
	selectedAnnotationId: string | null;
	editingTextId: string | null;
	onSelect: (id: string | null) => void;
	onMove: (id: string, xNorm: number, yNorm: number) => void;
	onResize: (id: string, wNorm: number, hNorm: number) => void;
	onCommitText: (id: string, text: string) => void;
	onCancelTextEdit: () => void;
}

function isActive(annotation: Annotation, nowMs: number): boolean {
	return Math.abs(nowMs - annotation.timestampMs) <= 1500;
}

export function AnnotationOverlay({
	compositorRef,
	annotations,
	currentTimeMs,
	selectedAnnotationId,
	editingTextId,
	onSelect,
	onMove,
	onResize,
	onCommitText,
	onCancelTextEdit,
}: AnnotationOverlayProps) {
	const getCanvasScale = useCallback(() => {
		const canvas = compositorRef.current?.canvasElement;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return { scaleX: rect.width / canvas.width, scaleY: rect.height / canvas.height, rect };
	}, [compositorRef]);

	const startDragMove = (annotation: Annotation) => (downEvent: React.PointerEvent) => {
		downEvent.stopPropagation();
		onSelect(annotation.id);
		const scale = getCanvasScale();
		const compositor = compositorRef.current;
		if (!scale || !compositor) return;

		const startX = downEvent.clientX;
		const startY = downEvent.clientY;
		const startXNorm = annotation.xNorm;
		const startYNorm = annotation.yNorm;

		const handleMove = (moveEvent: PointerEvent) => {
			const canvasDeltaX = (moveEvent.clientX - startX) / scale.scaleX;
			const canvasDeltaY = (moveEvent.clientY - startY) / scale.scaleY;
			const rectInfo = compositor.mapNormalizedRectToCanvas(0, 0, 1, 1);
			if (!rectInfo) return;
			onMove(
				annotation.id,
				startXNorm + canvasDeltaX / rectInfo.width,
				startYNorm + canvasDeltaY / rectInfo.height,
			);
		};
		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};
		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	const startDragResize = (annotation: Annotation) => (downEvent: React.PointerEvent) => {
		downEvent.stopPropagation();
		const scale = getCanvasScale();
		const compositor = compositorRef.current;
		if (!scale || !compositor) return;

		const startX = downEvent.clientX;
		const startY = downEvent.clientY;
		const startWNorm = annotation.wNorm;
		const startHNorm = annotation.hNorm;

		const handleMove = (moveEvent: PointerEvent) => {
			const canvasDeltaX = (moveEvent.clientX - startX) / scale.scaleX;
			const canvasDeltaY = (moveEvent.clientY - startY) / scale.scaleY;
			const rectInfo = compositor.mapNormalizedRectToCanvas(0, 0, 1, 1);
			if (!rectInfo) return;
			onResize(
				annotation.id,
				Math.max(0.02, startWNorm + canvasDeltaX / rectInfo.width),
				Math.max(0.02, startHNorm + canvasDeltaY / rectInfo.height),
			);
		};
		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};
		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	const scale = getCanvasScale();
	const compositor = compositorRef.current;
	if (!scale || !compositor) return null;

	return (
		<div className="pointer-events-none absolute inset-0">
			{annotations.filter((a) => isActive(a, currentTimeMs)).map((annotation) => {
				const rect = compositor.mapNormalizedRectToCanvas(
					annotation.xNorm,
					annotation.yNorm,
					annotation.wNorm,
					annotation.hNorm,
				);
				if (!rect) return null;

				const style: React.CSSProperties = {
					left: rect.x * scale.scaleX,
					top: rect.y * scale.scaleY,
					width: rect.width * scale.scaleX,
					height: rect.height * scale.scaleY,
				};

				if (editingTextId === annotation.id) {
					return (
						<input
							key={annotation.id}
							autoFocus
							defaultValue={annotation.text ?? ""}
							style={{ ...style, fontSize: Math.max(12, rect.height * scale.scaleY) }}
							className="pointer-events-auto absolute border border-brand-400 bg-black/60 px-1 text-white outline-none"
							onClick={(event) => event.stopPropagation()}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									onCommitText(annotation.id, (event.target as HTMLInputElement).value);
								} else if (event.key === "Escape") {
									onCancelTextEdit();
								}
							}}
							onBlur={(event) => onCommitText(annotation.id, event.target.value)}
						/>
					);
				}

				return (
					<div
						key={annotation.id}
						onPointerDown={startDragMove(annotation)}
						style={style}
						className={`pointer-events-auto absolute cursor-move border ${
							selectedAnnotationId === annotation.id
								? "border-brand-300 bg-brand-500/10"
								: "border-transparent hover:border-white/30"
						}`}
					>
						{selectedAnnotationId === annotation.id && (
							<div
								onPointerDown={startDragResize(annotation)}
								className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-brand-300"
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
