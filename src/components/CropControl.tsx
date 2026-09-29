import { useCallback, useRef } from "react";
import type { CropRegion } from "../../electron/project/projectTypes";

interface CropControlProps {
	previewSrc: string | null;
	region: CropRegion;
	onChange: (region: CropRegion) => void;
	disabled?: boolean;
}

type Edge = "top" | "right" | "bottom" | "left";

const MIN_SIZE = 0.1;

function clamp01(t: number): number {
	return Math.min(1, Math.max(0, t));
}

function applyEdge(region: CropRegion, edge: Edge, xNorm: number, yNorm: number): CropRegion {
	switch (edge) {
		case "top": {
			const bottom = region.yNorm + region.hNorm;
			const nextTop = Math.min(clamp01(yNorm), bottom - MIN_SIZE);
			return { ...region, yNorm: nextTop, hNorm: bottom - nextTop };
		}
		case "bottom": {
			const nextHeight = Math.max(MIN_SIZE, clamp01(yNorm) - region.yNorm);
			return { ...region, hNorm: Math.min(nextHeight, 1 - region.yNorm) };
		}
		case "left": {
			const right = region.xNorm + region.wNorm;
			const nextLeft = Math.min(clamp01(xNorm), right - MIN_SIZE);
			return { ...region, xNorm: nextLeft, wNorm: right - nextLeft };
		}
		case "right": {
			const nextWidth = Math.max(MIN_SIZE, clamp01(xNorm) - region.xNorm);
			return { ...region, wNorm: Math.min(nextWidth, 1 - region.xNorm) };
		}
	}
}

const EDGE_HANDLE_CLASS: Record<Edge, string> = {
	top: "absolute inset-x-0 top-0 h-2 -translate-y-1/2 cursor-ns-resize",
	bottom: "absolute inset-x-0 bottom-0 h-2 translate-y-1/2 cursor-ns-resize",
	left: "absolute inset-y-0 left-0 w-2 -translate-x-1/2 cursor-ew-resize",
	right: "absolute inset-y-0 right-0 w-2 translate-x-1/2 cursor-ew-resize",
};

export function CropControl({ previewSrc, region, onChange, disabled }: CropControlProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const regionRef = useRef(region);
	regionRef.current = region;

	const beginDrag = useCallback(
		(edge: Edge) => (event: React.PointerEvent<HTMLDivElement>) => {
			if (disabled) return;
			event.preventDefault();
			event.stopPropagation();
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();

			const handleMove = (moveEvent: PointerEvent) => {
				const xNorm = (moveEvent.clientX - rect.left) / rect.width;
				const yNorm = (moveEvent.clientY - rect.top) / rect.height;
				onChange(applyEdge(regionRef.current, edge, xNorm, yNorm));
			};
			const handleUp = () => {
				window.removeEventListener("pointermove", handleMove);
				window.removeEventListener("pointerup", handleUp);
			};
			window.addEventListener("pointermove", handleMove);
			window.addEventListener("pointerup", handleUp);
		},
		[disabled, onChange],
	);

	return (
		<div
			ref={containerRef}
			className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/40"
		>
			{previewSrc && (
				<img src={previewSrc} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60" />
			)}
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
				{previewSrc && (
					<img
						src={previewSrc}
						alt=""
						className="pointer-events-none absolute h-full w-full max-w-none object-cover"
						style={{
							left: `${-region.xNorm * (100 / region.wNorm)}%`,
							top: `${-region.yNorm * (100 / region.hNorm)}%`,
							width: `${100 / region.wNorm}%`,
							height: `${100 / region.hNorm}%`,
						}}
					/>
				)}
				{(["top", "right", "bottom", "left"] as Edge[]).map((edge) => (
					<div key={edge} onPointerDown={beginDrag(edge)} className={EDGE_HANDLE_CLASS[edge]} />
				))}
			</div>
		</div>
	);
}
