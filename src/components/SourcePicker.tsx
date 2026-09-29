import type { CaptureSource } from "../../electron/capture/sources";

interface SourcePickerProps {
	sources: CaptureSource[];
	selectedSourceId: string | null;
	onSelect: (sourceId: string) => void;
	disabled?: boolean;
}

export function SourcePicker({ sources, selectedSourceId, onSelect, disabled }: SourcePickerProps) {
	if (sources.length === 0) {
		return (
			<div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
				Looking for screens and windows to record…
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
			{sources.map((source) => {
				const isSelected = source.id === selectedSourceId;
				return (
					<button
						key={source.id}
						type="button"
						disabled={disabled}
						onClick={() => onSelect(source.id)}
						className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
							isSelected
								? "border-brand-400 bg-brand-500/15 shadow-brand-glow"
								: "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
						}`}
					>
						<img
							src={source.thumbnailDataUrl}
							alt={source.name}
							className="h-20 w-full object-cover"
						/>
						<span className="truncate px-2 py-1.5 text-xs text-white/80">{source.name}</span>
					</button>
				);
			})}
		</div>
	);
}
