import { useSyncExternalStore } from "react";
import { type AppLocale, getLocale, setLocale, subscribeLocaleChange, t } from "@/lib/i18n";

export function useI18n() {
	const locale = useSyncExternalStore(subscribeLocaleChange, getLocale);
	return { t, locale, setLocale: setLocale as (locale: AppLocale) => void };
}
