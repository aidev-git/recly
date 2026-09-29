import { useEffect, useState } from "react";
import type { ShortcutsConfig } from "../../electron/shortcuts";
import { useI18n } from "@/hooks/useI18n";
import { type ThemePreference, useTheme } from "@/hooks/useTheme";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { loadSavedDirectory, saveDirectoryPreference } from "@/lib/settings";

function formatAccelerator(event: React.KeyboardEvent): string | null {
	const parts: string[] = [];
	if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
	if (event.shiftKey) parts.push("Shift");
	if (event.altKey) parts.push("Alt");

	const key = event.key;
	if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;

	const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
	parts.push(normalizedKey);
	return parts.join("+");
}

interface ShortcutRowProps {
	label: string;
	value: string;
	onCapture: (accelerator: string) => void;
}

function ShortcutRow({ label, value, onCapture }: ShortcutRowProps) {
	const { t } = useI18n();
	const [isCapturing, setIsCapturing] = useState(false);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		event.preventDefault();
		const accelerator = formatAccelerator(event);
		if (!accelerator) return;
		setIsCapturing(false);
		onCapture(accelerator);
	};

	return (
		<div className="flex flex-col gap-1">
			<span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
			<button
				type="button"
				onClick={() => setIsCapturing(true)}
				onBlur={() => setIsCapturing(false)}
				onKeyDown={isCapturing ? handleKeyDown : undefined}
				className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
					isCapturing
						? "border-brand-400 bg-brand-500/15 text-brand-600 dark:text-brand-100"
						: "border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-secondary)] hover:bg-[var(--panel-bg-strong)]"
				}`}
			>
				{isCapturing ? t("settingsWindow.pressKeys") : value || t("settingsWindow.clickToSet")}
			</button>
		</div>
	);
}

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export function SettingsWindow() {
	const { t, locale, setLocale } = useI18n();
	const { preference: themePreference, setPreference: setThemePreference } = useTheme();
	const [saveDirectory, setSaveDirectory] = useState<string | null>(loadSavedDirectory);
	const [shortcuts, setShortcuts] = useState<ShortcutsConfig | null>(null);

	useEffect(() => {
		void window.recly.getShortcuts().then(setShortcuts);
	}, []);

	const handleChooseDirectory = async () => {
		const chosen = await window.recly.chooseSaveDirectory();
		if (chosen) {
			setSaveDirectory(chosen);
			saveDirectoryPreference(chosen);
		}
	};

	const updateShortcut = (key: keyof ShortcutsConfig, accelerator: string) => {
		if (!shortcuts) return;
		const next = { ...shortcuts, [key]: accelerator };
		setShortcuts(next);
		void window.recly.setShortcuts(next);
	};

	return (
		<div className="flex h-full flex-col gap-5 overflow-y-auto bg-[var(--app-bg-to)] p-5 text-[var(--text-primary)]">
			<h1 className="text-lg font-semibold">{t("settingsWindow.title")}</h1>

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsWindow.saveLocation")}
				</h2>
				<button
					type="button"
					onClick={handleChooseDirectory}
					className="truncate rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--panel-bg-strong)]"
				>
					{saveDirectory ?? t("settingsWindow.defaultLocation")}
				</button>
			</section>

			<section className="flex flex-col gap-3">
				<div>
					<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
						{t("settingsWindow.shortcutTitle")}
					</h2>
					<p className="text-[11px] text-[var(--text-tertiary)]">{t("settingsWindow.shortcutDescription")}</p>
				</div>
				{shortcuts && (
					<>
						<ShortcutRow
							label={t("settingsWindow.shortcutToggle")}
							value={shortcuts.toggleRecording}
							onCapture={(accelerator) => updateShortcut("toggleRecording", accelerator)}
						/>
						<ShortcutRow
							label={t("settingsWindow.shortcutPauseResume")}
							value={shortcuts.pauseResumeRecording}
							onCapture={(accelerator) => updateShortcut("pauseResumeRecording", accelerator)}
						/>
					</>
				)}
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsWindow.appearance")}
				</h2>
				<div className="flex gap-1.5">
					{THEME_OPTIONS.map((option) => (
						<button
							key={option}
							type="button"
							onClick={() => setThemePreference(option)}
							className={`flex-1 rounded-md px-2 py-1.5 text-[11px] capitalize transition-colors ${
								themePreference === option
									? "bg-brand-500/25 text-brand-600 ring-1 ring-brand-400 dark:text-brand-100"
									: "bg-[var(--panel-bg)] text-[var(--text-tertiary)] hover:bg-[var(--panel-bg-strong)]"
							}`}
						>
							{t(`settingsWindow.theme.${option}`)}
						</button>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
					{t("settingsWindow.language")}
				</h2>
				<select
					value={locale}
					onChange={(event) => setLocale(event.target.value as typeof locale)}
					className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs text-[var(--text-secondary)]"
				>
					{SUPPORTED_LOCALES.map((option) => (
						<option key={option.code} value={option.code} className="bg-brand-950">
							{option.label}
						</option>
					))}
				</select>
			</section>

			<p className="mt-auto text-[11px] text-[var(--text-tertiary)] opacity-70">
				{t("settingsWindow.footerNote")}
			</p>
		</div>
	);
}
