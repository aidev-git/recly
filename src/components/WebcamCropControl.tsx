import { useEffect, useRef } from "react";
import type { CropRegion } from "../../electron/project/projectTypes";

interface WebcamCropControlProps {
	region: CropRegion;
	onChange: (region: CropRegion) => void;
	disabled?: boolean;
}

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const MIN_SIZE = 0.15;

function clamp01(t: number): number {
	return Math.min(1, Math.max(0, t));
}

function applyCorner(region: CropRegion, corner: Corner, xNorm: number, yNorm: number): CropRegion {
	const x = clamp01(xNorm);
	const y = clamp01(yNorm);
	const left = region.xNorm;
	const top = region.yNorm;
	const right = region.xNorm + region.wNorm;
	const bottom = region.yNorm + region.hNorm;

	switch (corner) {
		case "top-left": {
			const nextX = Math.min(x, right - MIN_SIZE);
			const nextY = Math.min(y, bottom - MIN_SIZE);
			return { xNorm: nextX, yNorm: nextY, wNorm: right - nextX, hNorm: bottom - nextY };
		}
		case "top-right": {
			const nextY = Math.min(y, bottom - MIN_SIZE);
			const nextW = Math.min(Math.max(MIN_SIZE, x - left), 1 - left);
			return { xNorm: left, yNorm: nextY, wNorm: nextW, hNorm: bottom - nextY };
		}
		case "bottom-left": {
			const nextX = Math.min(x, right - MIN_SIZE);
			const nextH = Math.min(Math.max(MIN_SIZE, y - top), 1 - top);
			return { xNorm: nextX, yNorm: top, wNorm: right - nextX, hNorm: nextH };
		}
		case "bottom-right": {
			const nextW = Math.min(Math.max(MIN_SIZE, x - left), 1 - left);
			const nextH = Math.min(Math.max(MIN_SIZE, y - top), 1 - top);
			return { xNorm: left, yNorm: top, wNorm: nextW, hNorm: nextH };
		}
	}
}

const CORNER_HANDLE_CLASS: Record<Corner, string> = {
	"top-left": "absolute -left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize",
	"top-right": "absolute -right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize",
	"bottom-left": "absolute -left-1.5 -bottom-1.5 h-3 w-3 cursor-nesw-resize",
	"bottom-right": "absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize",
};

export function WebcamCropControl({ region, onChange, disabled }: WebcamCropControlProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const regionRef = useRef(region);
	regionRef.current = region;

	useEffect(() => {
		if (disabled) return;
		let stream: MediaStream | null = null;
		let cancelled = false;
		navigator.mediaDevices
			.getUserMedia({ video: true })
			.then((mediaStream) => {
				if (cancelled) {
					mediaStream.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = mediaStream;
				if (videoRef.current) {
					videoRef.current.srcObject = mediaStream;
					void videoRef.current.play();
				}
			})
			.catch(() => undefined);

		return () => {
			cancelled = true;
			stream?.getTracks().forEach((track) => track.stop());
		};
	}, [disabled]);

	const beginDrag = (corner: Corner) => (event: React.PointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		event.preventDefault();
		event.stopPropagation();
		const container = containerRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();

		const handleMove = (moveEvent: PointerEvent) => {
			const xNorm = (moveEvent.clientX - rect.left) / rect.width;
			const yNorm = (moveEvent.clientY - rect.top) / rect.height;
			onChange(applyCorner(regionRef.current, corner, xNorm, yNorm));
		};
		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};
		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	return (
		<div
			ref={containerRef}
			className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/60"
		>
			<video
				ref={videoRef}
				muted
				playsInline
				className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-70"
			/>
			<div className="pointer-events-none absolute inset-0 bg-black/40" />
			<div
				className="absolute border-2 border-brand-400 bg-brand-500/10"
				style={{
					left: `${region.xNorm * 100}%`,
					top: `${region.yNorm * 100}%`,
					width: `${region.wNorm * 100}%`,
					height: `${region.hNorm * 100}%`,
				}}
			>
				{(["top-left", "top-right", "bottom-left", "bottom-right"] as Corner[]).map((corner) => (
					<div
						key={corner}
						onPointerDown={beginDrag(corner)}
						className={`${CORNER_HANDLE_CLASS[corner]} rounded-full bg-brand-400 ring-2 ring-white/80`}
					/>
				))}
			</div>
		</div>
	);
}
