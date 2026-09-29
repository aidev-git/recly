import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useI18n } from "@/hooks/useI18n";

export function EditorAnnouncementBanner() {
	const { t } = useI18n();
	const { current, dismiss, runAction } = useAnnouncements("editor");
	if (!current) return null;

	const showClose = current.controls?.close !== false;
	const showAction = current.controls?.action !== false && !!current.action;

	return (
		<div className="flex items-center gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 px-3 py-2">
			<div className="min-w-0 flex-1">
				<p className="truncate text-xs font-medium text-white">{current.title}</p>
				<p className="truncate text-[11px] text-white/60">{current.body}</p>
			</div>
			{showAction && (
				<button
					type="button"
					onClick={runAction}
					className="shrink-0 rounded-md bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white hover:brightness-110"
				>
					{current.action?.label}
				</button>
			)}
			{showClose && (
				<button
					type="button"
					onClick={dismiss}
					aria-label={t("announcements.dismiss")}
					className="shrink-0 text-white/40 hover:text-white/70"
				>
					✕
				</button>
			)}
		</div>
	);
}
