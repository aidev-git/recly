import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import ko from "./locales/ko.json";
import nl from "./locales/nl.json";
import ptBR from "./locales/pt-BR.json";
import ru from "./locales/ru.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

export type AppLocale = "en" | "de" | "es" | "fr" | "it" | "ko" | "nl" | "pt-BR" | "ru" | "zh-CN" | "zh-TW";

export const SUPPORTED_LOCALES: { code: AppLocale; label: string }[] = [
	{ code: "en", label: "English" },
	{ code: "de", label: "Deutsch" },
	{ code: "es", label: "Español" },
	{ code: "fr", label: "Français" },
	{ code: "it", label: "Italiano" },
	{ code: "ko", label: "한국어" },
	{ code: "nl", label: "Nederlands" },
	{ code: "pt-BR", label: "Português (BR)" },
	{ code: "ru", label: "Русский" },
	{ code: "zh-CN", label: "简体中文" },
	{ code: "zh-TW", label: "繁體中文" },
];

const catalogs: Record<AppLocale, Record<string, string>> = {
	en,
	de,
	es,
	fr,
	it,
	ko,
	nl,
	"pt-BR": ptBR,
	ru,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
};

const LOCALE_STORAGE_KEY = "recly.settings.locale";

let listeners = new Set<() => void>();
let activeLocale: AppLocale = (localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale) || "en";

export function getLocale(): AppLocale {
	return activeLocale;
}

export function setLocale(locale: AppLocale): void {
	activeLocale = locale;
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	listeners.forEach((listener) => listener());
}

export function subscribeLocaleChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function t(key: string, params?: Record<string, string | number>): string {
	const template = catalogs[activeLocale]?.[key] ?? catalogs.en[key] ?? key;
	if (!params) return template;
	return Object.entries(params).reduce(
		(result, [paramKey, value]) => result.replaceAll(`{${paramKey}}`, String(value)),
		template,
	);
}
