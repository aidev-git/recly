import { useEffect, useState } from "react";

export interface UpdateToastPayload {
	version: string;
	detail: string;
	phase: "available" | "downloading" | "ready" | "error";
	progressPercent?: number;
	transferredBytes?: number;
	totalBytes?: number;
	bytesPerSecond?: number;
	primaryAction?: "install-and-restart" | "retry-check";
}

export function useUpdateToast() {
	const [toast, setToast] = useState<UpdateToastPayload | null>(null);

	useEffect(() => {
		void window.recly.getCurrentUpdateToastPayload().then(setToast);
		return window.recly.onUpdateToastState(setToast);
	}, []);

	return toast;
}
