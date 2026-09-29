import { useEffect, useState } from "react";

const COUNTDOWN_START = 3;

export function CountdownOverlay() {
	const [count, setCount] = useState(COUNTDOWN_START);

	useEffect(() => {
		if (count <= 0) {
			void window.recly.countdownComplete();
			return;
		}

		const timer = setTimeout(() => setCount((current) => current - 1), 800);
		return () => clearTimeout(timer);
	}, [count]);

	return (
		<div className="flex h-full w-full items-center justify-center bg-black/30">
			<span
				key={count}
				className="animate-in zoom-in fade-in text-[140px] font-bold text-white drop-shadow-[0_0_40px_rgba(138,95,153,0.8)]"
			>
				{count > 0 ? count : ""}
			</span>
		</div>
	);
}
