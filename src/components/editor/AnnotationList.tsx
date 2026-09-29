import type { Annotation, FigureDirection, TextAlign } from "../../../electron/project/projectTypes";
import { useI18n } from "@/hooks/useI18n";

interface AnnotationListProps {
	annotations: Annotation[];
	selectedAnnotationId: string | null;
	onSelect: (id: string) => void;
	onSeekTo: (timestampMs: number) => void;
	onDelete: (id: string) => void;
	onChange: (id: string, patch: Partial<Annotation>) => void;
	onChooseImage: (id: string) => void;
}

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2);
}

const FIGURE_DIRECTIONS: FigureDirection[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];

export function AnnotationList({
	annotations,
	selectedAnnotationId,
	onSelect,
	onSeekTo,
	onDelete,
	onChange,
	onChooseImage,
}: AnnotationListProps) {
	const { t } = useI18n();
	if (annotations.length === 0) return null;

	const bringToFront = (annotation: Annotation) => {
		const maxZ = Math.max(0, ...annotations.map((a) => a.zIndex ?? 0));
		onChange(annotation.id, { zIndex: maxZ + 1 });
	};
	const sendToBack = (annotation: Annotation) => {
		const minZ = Math.min(0, ...annotations.map((a) => a.zIndex ?? 0));
		onChange(annotation.id, { zIndex: minZ - 1 });
	};

	return (
		<div className="flex flex-col gap-1.5">
			{annotations.map((annotation) => {
				const isSelected = annotation.id === selectedAnnotationId;
				return (
					<div
						key={annotation.id}
						className={`flex flex-col gap-1.5 rounded-lg px-2 py-1.5 text-[10px] ${
							isSelected ? "bg-brand-500/15 ring-1 ring-brand-400" : "bg-white/5"
						}`}
					>
						<div className="flex items-center justify-between gap-2">
							<button
								type="button"
								onClick={() => {
									onSelect(annotation.id);
									onSeekTo(annotation.timestampMs);
								}}
								className="flex items-center gap-1.5 text-white/70 hover:text-white"
							>
								<span className="h-2 w-2 rounded-full" style={{ backgroundColor: annotation.color }} />
								<span className="capitalize">{annotation.type}</span>
								<span className="text-white/40">@ {formatSeconds(annotation.timestampMs)}s</span>
							</button>
							<button
								type="button"
								onClick={() => onDelete(annotation.id)}
								className="text-red-300 hover:text-red-200"
							>
								✕
							</button>
						</div>

						{isSelected && (
							<div className="flex flex-col gap-1.5 border-t border-white/10 pt-1.5">
								<div className="flex items-center gap-1.5">
									<label className="flex items-center gap-1 text-white/50">
										{t("annotationProps.color")}
										<input
											type="color"
											value={annotation.color}
											onChange={(event) => onChange(annotation.id, { color: event.target.value })}
											className="h-5 w-8 rounded border border-white/15 bg-transparent"
										/>
									</label>
									<button
										type="button"
										onClick={() => bringToFront(annotation)}
										className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-white/60 hover:bg-white/20"
									>
										{t("annotationProps.bringToFront")}
									</button>
									<button
										type="button"
										onClick={() => sendToBack(annotation)}
										className="rounded bg-white/10 px-1.5 py-0.5 text-white/60 hover:bg-white/20"
									>
										{t("annotationProps.sendToBack")}
									</button>
								</div>

								{annotation.type === "text" && (
									<>
										<div className="flex items-center gap-1">
											<button
												type="button"
												onClick={() =>
													onChange(annotation.id, {
														fontWeight: annotation.fontWeight === "bold" ? "normal" : "bold",
													})
												}
												className={`rounded px-1.5 py-0.5 font-bold ${annotation.fontWeight === "bold" ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
											>
												B
											</button>
											<button
												type="button"
												onClick={() =>
													onChange(annotation.id, {
														fontStyle: annotation.fontStyle === "italic" ? "normal" : "italic",
													})
												}
												className={`rounded px-1.5 py-0.5 italic ${annotation.fontStyle === "italic" ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
											>
												I
											</button>
											<button
												type="button"
												onClick={() =>
													onChange(annotation.id, {
														textDecoration:
															annotation.textDecoration === "underline" ? "none" : "underline",
													})
												}
												className={`rounded px-1.5 py-0.5 underline ${annotation.textDecoration === "underline" ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
											>
												U
											</button>
											<label className="ml-1 flex items-center gap-1 text-white/50">
												{t("annotationProps.background")}
												<input
													type="color"
													value={annotation.backgroundColor ?? "#000000"}
													onChange={(event) =>
														onChange(annotation.id, { backgroundColor: event.target.value })
													}
													className="h-5 w-8 rounded border border-white/15 bg-transparent"
												/>
											</label>
											{annotation.backgroundColor && (
												<button
													type="button"
													onClick={() => onChange(annotation.id, { backgroundColor: null })}
													className="text-white/40 hover:text-white/70"
												>
													✕
												</button>
											)}
										</div>
										<div className="flex items-center gap-1">
											{TEXT_ALIGNS.map((align) => (
												<button
													key={align}
													type="button"
													onClick={() => onChange(annotation.id, { textAlign: align })}
													className={`rounded px-1.5 py-0.5 capitalize ${(annotation.textAlign ?? "left") === align ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
												>
													{align}
												</button>
											))}
											<label className="ml-1 flex flex-1 items-center gap-1 text-white/50">
												{t("annotationProps.borderRadius")}
												<input
													type="range"
													min={0}
													max={24}
													step={1}
													value={annotation.borderRadius ?? 4}
													onChange={(event) =>
														onChange(annotation.id, { borderRadius: Number(event.target.value) })
													}
													className="flex-1 accent-brand-500"
												/>
											</label>
										</div>
									</>
								)}

								{annotation.type === "figure" && (
									<div className="grid grid-cols-3 gap-1">
										{FIGURE_DIRECTIONS.map((direction) => (
											<button
												key={direction}
												type="button"
												onClick={() => onChange(annotation.id, { figureDirection: direction })}
												className={`rounded px-1.5 py-0.5 uppercase ${(annotation.figureDirection ?? "e") === direction ? "bg-brand-500 text-white" : "bg-white/10 text-white/60"}`}
											>
												{direction}
											</button>
										))}
									</div>
								)}

								{annotation.type === "image" && (
									<button
										type="button"
										onClick={() => onChooseImage(annotation.id)}
										className="rounded bg-white/10 px-1.5 py-1 text-white/60 hover:bg-white/20"
									>
										{t("annotationProps.changeImage")}
									</button>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
