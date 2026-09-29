import { lazy, Suspense, useState } from "react";
import { RecorderWindow } from "@/components/RecorderWindow";
import { HudWindow } from "@/components/HudWindow";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { SettingsWindow } from "@/components/SettingsWindow";

const EditorWindow = lazy(() =>
	import("@/components/editor/EditorWindow").then((module) => ({ default: module.EditorWindow })),
);

export default function App() {
	const [windowType] = useState(
		() => new URLSearchParams(window.location.search).get("windowType") || "main",
	);

	switch (windowType) {
		case "hud":
			return <HudWindow />;
		case "countdown":
			return <CountdownOverlay />;
		case "settings":
			return <SettingsWindow />;
		case "editor":
			return (
				<Suspense fallback={null}>
					<EditorWindow />
				</Suspense>
			);
		default:
			return <RecorderWindow />;
	}
}
