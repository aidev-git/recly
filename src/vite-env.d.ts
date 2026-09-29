/// <reference types="vite/client" />

import type { ReclyBridge } from "../electron/preload";

declare global {
	interface Window {
		recly: ReclyBridge;
	}
}
