import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "recly.settings.theme";
let listeners = new Set<() => void>();
let preference: ThemePreference = (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference) || "system";

function resolveTheme(pref: ThemePreference): "light" | "dark" {
	if (pref === "system") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	return pref;
}

function applyTheme(pref: ThemePreference): void {
	document.documentElement.classList.toggle("dark", resolveTheme(pref) === "dark");
}

applyTheme(preference);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
	if (preference === "system") applyTheme(preference);
});

export function getThemePreference(): ThemePreference {
	return preference;
}

export function setThemePreference(next: ThemePreference): void {
	preference = next;
	localStorage.setItem(THEME_STORAGE_KEY, next);
	applyTheme(next);
	listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useTheme() {
	const currentPreference = useSyncExternalStore(subscribe, getThemePreference);

	useEffect(() => {
		applyTheme(currentPreference);
	}, [currentPreference]);

	const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);

	return { preference: currentPreference, resolved: resolveTheme(currentPreference), setPreference };
}
