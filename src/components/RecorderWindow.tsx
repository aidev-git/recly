import { AnnouncementDialog } from "./announcements/AnnouncementDialog";
import { UpdateToast } from "./UpdateToast";
import { RecorderSettingsPanel } from "./RecorderSettingsPanel";
import { RecordingControls } from "./RecordingControls";
import { SourcePicker } from "./SourcePicker";
import { useI18n } from "@/hooks/useI18n";
import { useRecorder } from "@/hooks/useRecorder";

export function RecorderWindow() {
	const recorder = useRecorder();
	const { t } = useI18n();
	const isBusy =
		recorder.status === "recording" ||
		recorder.status === "paused" ||
		recorder.status === "counting-down";

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto bg-gradient-to-b from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-5">
			<AnnouncementDialog />
			<UpdateToast />
			<header className="flex items-center gap-2">
				<span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-950 shadow-soft-sm">
					<span className="h-3 w-3 rounded-full bg-white" />
				</span>
				<h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Recly</h1>
				<button
					type="button"
					onClick={() => void window.recly.openSettings()}
					className="ml-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
					aria-label={t("recorder.settingsAria")}
				>
					⚙
				</button>
			</header>

			{recorder.screenRecordingPermissionDenied && (
				<button
					type="button"
					onClick={recorder.openScreenRecordingPreferences}
					className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/15"
				>
					{t("recorder.screenRecordingPermissionDenied")}
				</button>
			)}

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("recorder.record")}
				</h2>
				<SourcePicker
					sources={recorder.sources}
					selectedSourceId={recorder.selectedSourceId}
					onSelect={recorder.setSelectedSourceId}
					disabled={isBusy}
				/>
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("recorder.settings")}
				</h2>
				<RecorderSettingsPanel
					settings={recorder.settings}
					onUpdate={recorder.updateSetting}
					previewSrc={
						recorder.sources.find((source) => source.id === recorder.selectedSourceId)?.thumbnailDataUrl ??
						null
					}
					disabled={isBusy}
					nativeCaptureAvailable={recorder.nativeCaptureAvailable}
				/>
			</section>

			<RecordingControls
				status={recorder.status}
				elapsedMs={recorder.elapsedMs}
				micEnabled={recorder.micEnabled}
				onToggleMic={recorder.toggleMic}
				onStart={recorder.start}
				onPause={recorder.pause}
				onResume={recorder.resume}
				onStop={recorder.stop}
			/>

			{recorder.error && (
				<p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
					{recorder.error}
				</p>
			)}

			{recorder.lastSavedPath && recorder.status === "idle" && (
				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => window.recly.revealInFolder(recorder.lastSavedPath as string)}
						className="truncate rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--panel-bg-strong)]"
					>
						{t("recorder.savedTo", { path: recorder.lastSavedPath })}
					</button>
					<button
						type="button"
						onClick={() => window.recly.openEditor(recorder.lastSavedPath as string)}
						className="rounded-lg bg-brand-500/20 px-3 py-2 text-xs font-medium text-brand-600 ring-1 ring-brand-400 transition-colors hover:bg-brand-500/30 dark:text-brand-100"
					>
						{t("recorder.editRecording")}
					</button>
				</div>
			)}
		</div>
	);
}
