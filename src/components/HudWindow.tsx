import { useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

export function HudWindow() {
	const { t } = useI18n();
	const [isPaused, setIsPaused] = useState(false);
	const isDraggingRef = useRef(false);

	const handlePauseToggle = () => {
		setIsPaused((current) => {
			void window.recly.hudCommand(current ? "resume" : "pause");
			return !current;
		});
	};

	const handleStop = () => {
		void window.recly.hudCommand("stop");
	};

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		isDraggingRef.current = true;
		event.currentTarget.setPointerCapture(event.pointerId);
		window.recly.hudOverlayDrag({ phase: "start", screenX: event.screenX, screenY: event.screenY });
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isDraggingRef.current) return;
		window.recly.hudOverlayDrag({ phase: "move", screenX: event.screenX, screenY: event.screenY });
	};

	const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		event.currentTarget.releasePointerCapture(event.pointerId);
		window.recly.hudOverlayDrag({ phase: "end", screenX: event.screenX, screenY: event.screenY });
	};

	return (
		<div
			// The HUD window defaults to click-through (no content behind it to interact with,
			// so passthrough only matters as a safety net); disable it while the cursor is over
			// the bar itself so the buttons and drag handle stay clickable.
			onMouseEnter={() => window.recly.setHudOverlayMousePassthrough(false)}
			onMouseLeave={() => window.recly.setHudOverlayMousePassthrough(true)}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			className="flex h-full w-full cursor-move items-center justify-between gap-3 rounded-full border border-white/10 bg-[#190f1d]/95 px-4 shadow-soft-lg backdrop-blur"
		>
			<div className="flex items-center gap-2">
				<span
					className={`h-2.5 w-2.5 rounded-full ${isPaused ? "bg-white/40" : "bg-red-500 animate-pulse"}`}
				/>
				<span className="text-xs font-medium text-white/80">
					{isPaused ? t("hud.paused") : t("hud.recording")}
				</span>
			</div>

			<div className="flex items-center gap-2">
				<button
					type="button"
					onPointerDown={(event) => event.stopPropagation()}
					onClick={handlePauseToggle}
					className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white transition-colors hover:bg-white/15"
				>
					{isPaused ? t("hud.resume") : t("hud.pause")}
				</button>
				<button
					type="button"
					onPointerDown={(event) => event.stopPropagation()}
					onClick={handleStop}
					className="cursor-pointer rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-brand-glow transition-transform hover:scale-105"
				>
					{t("hud.stop")}
				</button>
			</div>
		</div>
	);
}
