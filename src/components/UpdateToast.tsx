import { useI18n } from "@/hooks/useI18n";
import { useUpdateToast } from "@/hooks/useUpdateToast";

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateToast() {
	const { t } = useI18n();
	const toast = useUpdateToast();
	if (!toast) return null;

	const handlePrimaryAction = () => {
		if (toast.primaryAction === "install-and-restart") {
			void window.recly.installDownloadedUpdate();
		} else if (toast.primaryAction === "retry-check") {
			void window.recly.checkForAppUpdates();
		}
	};

	return (
		<div className="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2 rounded-xl border border-white/10 bg-[#190f1d] p-3 shadow-soft-lg">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-xs font-medium text-white">
						{toast.version ? `Recly ${toast.version}` : t("update.title")}
					</p>
					<p className="text-[11px] text-white/50">{toast.detail}</p>
				</div>
				<button
					type="button"
					onClick={() => void window.recly.dismissUpdateToast()}
					className="shrink-0 text-white/30 hover:text-white/60"
				>
					✕
				</button>
			</div>

			{toast.phase === "downloading" && toast.progressPercent !== undefined && (
				<div className="flex flex-col gap-1">
					<div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
						<div
							className="h-full bg-brand-500 transition-all"
							style={{ width: `${Math.round(toast.progressPercent)}%` }}
						/>
					</div>
					{toast.totalBytes !== undefined && (
						<p className="text-[10px] text-white/40">
							{formatBytes(toast.transferredBytes ?? 0)} / {formatBytes(toast.totalBytes)}
						</p>
					)}
				</div>
			)}

			<div className="flex justify-end gap-2">
				{toast.phase === "available" && (
					<button
						type="button"
						onClick={() => void window.recly.downloadAvailableUpdate()}
						className="rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white hover:brightness-110"
					>
						{t("update.download")}
					</button>
				)}
				{toast.primaryAction && (
					<button
						type="button"
						onClick={handlePrimaryAction}
						className="rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white hover:brightness-110"
					>
						{toast.primaryAction === "install-and-restart" ? t("update.installAndRestart") : t("update.retry")}
					</button>
				)}
			</div>
		</div>
	);
}
