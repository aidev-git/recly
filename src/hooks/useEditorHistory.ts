import { useCallback, useRef, useState } from "react";

/**
 * A present/past/future undo-redo stack for a single piece of editor state.
 * `setProject` records an undo step; `resetProject` (loading a fresh project,
 * opening a different one) replaces the present without touching history.
 */
export function useEditorHistory<T>(maxEntries = 50) {
	const [present, setPresent] = useState<T | null>(null);
	const pastRef = useRef<T[]>([]);
	const futureRef = useRef<T[]>([]);

	const setProject = useCallback(
		(next: T) => {
			setPresent((current) => {
				if (current !== null) {
					pastRef.current = [...pastRef.current, current].slice(-maxEntries);
				}
				futureRef.current = [];
				return next;
			});
		},
		[maxEntries],
	);

	const resetProject = useCallback((next: T | null) => {
		pastRef.current = [];
		futureRef.current = [];
		setPresent(next);
	}, []);

	/** Only resets (no history push) if there is no present project yet — safe to call from a stale-closure-prone effect. */
	const resetProjectIfEmpty = useCallback((factory: () => T) => {
		setPresent((current) => {
			if (current !== null) return current;
			pastRef.current = [];
			futureRef.current = [];
			return factory();
		});
	}, []);

	const undo = useCallback(() => {
		setPresent((current) => {
			if (current === null || pastRef.current.length === 0) return current;
			const previous = pastRef.current[pastRef.current.length - 1];
			pastRef.current = pastRef.current.slice(0, -1);
			futureRef.current = [current, ...futureRef.current];
			return previous;
		});
	}, []);

	const redo = useCallback(() => {
		setPresent((current) => {
			if (current === null || futureRef.current.length === 0) return current;
			const next = futureRef.current[0];
			futureRef.current = futureRef.current.slice(1);
			pastRef.current = [...pastRef.current, current];
			return next;
		});
	}, []);

	return {
		project: present,
		setProject,
		resetProject,
		resetProjectIfEmpty,
		undo,
		redo,
		canUndo: pastRef.current.length > 0,
		canRedo: futureRef.current.length > 0,
	};
}
