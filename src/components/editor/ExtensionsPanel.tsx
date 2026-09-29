import { useI18n } from "@/hooks/useI18n";

/** Extensions aren't a working feature yet — this keeps the nav slot present (and the
 * expectation set correctly) rather than a dead menu item or a silent 404. */
export function ExtensionsPanel() {
	const { t } = useI18n();

	return (
		<div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
			<h3 className="text-[11px] font-medium uppercase tracking-wide text-white/50">
				{t("extensions.title")}
			</h3>
			<p className="text-[11px] text-white/40">{t("extensions.unavailable")}</p>
		</div>
	);
}
