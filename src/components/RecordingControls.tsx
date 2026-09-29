import { useI18n } from "@/hooks/useI18n";
import type { RecordingStatus } from "@/hooks/useRecorder";

interface RecordingControlsProps {
	status: RecordingStatus;
	elapsedMs: number;
	micEnabled: boolean;
	onToggleMic: () => void;
	onStart: () => void;
	onPause: () => void;
	onResume: () => void;
	onStop: () => void;
}

function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60)
		.toString()
		.padStart(2, "0");
	const seconds = (totalSeconds % 60).toString().padStart(2, "0");
	return `${minutes}:${seconds}`;
}

export function RecordingControls({
	status,
	elapsedMs,
	micEnabled,
	onToggleMic,
	onStart,
	onPause,
	onResume,
	onStop,
}: RecordingControlsProps) {
	const { t } = useI18n();
	const isRecording = status === "recording";
	const isPaused = status === "paused";
	const isSaving = status === "saving";
	const isCountingDown = status === "counting-down";

	return (
		<div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 shadow-soft-md">
			<span className="font-mono text-2xl tabular-nums text-[var(--text-primary)]">
				{formatElapsed(elapsedMs)}
			</span>

			<div className="flex items-center gap-3">
				{status === "idle" && (
					<button
						type="button"
						onClick={onStart}
						className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-brand-glow transition-transform hover:scale-105 active:scale-95"
						aria-label="Start recording"
					>
						<span className="h-5 w-5 rounded-full bg-white" />
					</button>
				)}

				{(isRecording || isPaused) && (
					<>
						<button
							type="button"
							onClick={isPaused ? onResume : onPause}
							className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg-strong)] transition-colors hover:brightness-110"
							aria-label={isPaused ? "Resume recording" : "Pause recording"}
						>
							{isPaused ? (
								<span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[var(--text-primary)]" />
							) : (
								<span className="flex gap-1">
									<span className="h-4 w-1.5 rounded-sm bg-[var(--text-primary)]" />
									<span className="h-4 w-1.5 rounded-sm bg-[var(--text-primary)]" />
								</span>
							)}
						</button>

						<button
							type="button"
							onClick={onStop}
							className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-brand-glow transition-transform hover:scale-105 active:scale-95"
							aria-label="Stop recording"
						>
							<span className="h-4 w-4 rounded-sm bg-white" />
						</button>
					</>
				)}

				{isSaving && (
					<span className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t("controls.saving")}</span>
				)}
				{isCountingDown && (
					<span className="px-4 py-3 text-sm text-[var(--text-secondary)]">
						{t("controls.gettingReady")}
					</span>
				)}
			</div>

			<button
				type="button"
				onClick={onToggleMic}
				disabled={isRecording || isPaused || isSaving || isCountingDown}
				className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
					micEnabled
						? "border-brand-400 bg-brand-500/15 text-brand-600 dark:text-brand-100"
						: "border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-tertiary)]"
				}`}
			>
				{micEnabled ? t("recorder.micOn") : t("recorder.micOff")}
			</button>
		</div>
	);
}
