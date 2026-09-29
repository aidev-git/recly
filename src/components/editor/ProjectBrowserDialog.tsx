import { useEffect, useState } from "react";
import type { ProjectLibraryEntry } from "../../../electron/project/projectLibrary";
import { useI18n } from "@/hooks/useI18n";

interface ProjectBrowserDialogProps {
	onOpen: (filePath: string) => void;
	onBrowseFile: () => void;
	onClose: () => void;
}

export function ProjectBrowserDialog({ onOpen, onBrowseFile, onClose }: ProjectBrowserDialogProps) {
	const { t } = useI18n();
	const [entries, setEntries] = useState<ProjectLibraryEntry[] | null>(null);

	useEffect(() => {
		void window.recly.listProjectLibrary().then(setEntries);
	}, []);

	const handleRemove = async (filePath: string) => {
		await window.recly.removeProjectFromLibrary(filePath);
		setEntries((current) => current?.filter((entry) => entry.path !== filePath) ?? current);
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
			onClick={onClose}
			role="presentation"
		>
			<div
				className="flex max-h-[70vh] w-96 flex-col gap-2 rounded-2xl border border-white/10 bg-brand-950 p-4"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-white">{t("projectBrowser.title")}</h3>
					<button type="button" onClick={onClose} className="text-white/50 hover:text-white">
						✕
					</button>
				</div>

				<div className="flex flex-col gap-1 overflow-y-auto">
					{entries === null && <p className="text-xs text-white/40">{t("projectBrowser.loading")}</p>}
					{entries?.length === 0 && <p className="text-xs text-white/40">{t("projectBrowser.empty")}</p>}
					{entries?.map((entry) => (
						<div
							key={entry.path}
							className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs"
						>
							<button
								type="button"
								onClick={() => onOpen(entry.path)}
								className="flex-1 truncate text-left text-white/70 hover:text-white"
							>
								{entry.name}
								<span className="block text-[10px] text-white/40">
									{new Date(entry.lastOpenedAt).toLocaleString()}
								</span>
							</button>
							<button
								type="button"
								onClick={() => void handleRemove(entry.path)}
								className="text-red-300 hover:text-red-200"
							>
								✕
							</button>
						</div>
					))}
				</div>

				<button
					type="button"
					onClick={onBrowseFile}
					className="mt-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/15"
				>
					{t("projectBrowser.browse")}
				</button>
			</div>
		</div>
	);
}
