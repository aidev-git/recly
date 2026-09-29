import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useI18n } from "@/hooks/useI18n";

export function AnnouncementDialog() {
	const { t } = useI18n();
	const { current, dismiss, runAction } = useAnnouncements("all");
	if (!current) return null;

	const showClose = current.controls?.close !== false;
	const showAction = current.controls?.action !== false && !!current.action;
	const isCover = current.mediaMode === "cover" && !!current.media;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
			<div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#190f1d] shadow-soft-lg">
				{current.media && (
					<div className={isCover ? "aspect-video w-full bg-black" : "aspect-[2/1] w-full bg-black"}>
						{current.media.type === "video" ? (
							<video
								src={current.media.url}
								poster={current.media.posterUrl}
								className="h-full w-full object-cover"
								autoPlay
								loop
								muted
								playsInline
							/>
						) : (
							<img src={current.media.url} alt={current.media.alt ?? ""} className="h-full w-full object-cover" />
						)}
					</div>
				)}
				<div className="flex flex-col gap-2 p-5">
					<h2 className="text-sm font-semibold text-white">{current.title}</h2>
					<p className="text-xs leading-relaxed text-white/60">{current.body}</p>
					<div className="mt-2 flex justify-end gap-2">
						{showClose && (
							<button
								type="button"
								onClick={dismiss}
								className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
							>
								{t("announcements.dismiss")}
							</button>
						)}
						{showAction && (
							<button
								type="button"
								onClick={runAction}
								className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
							>
								{current.action?.label}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
