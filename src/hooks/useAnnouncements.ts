import { useCallback, useEffect, useState } from "react";
import { BUNDLED_ANNOUNCEMENTS } from "@/content/announcements";
import {
	type Announcement,
	type AnnouncementAudience,
	dismissAnnouncement,
	recordAnnouncementImpression,
	selectAnnouncements,
} from "@/lib/announcements";

export function useAnnouncements(audience: AnnouncementAudience) {
	const [queue, setQueue] = useState<Announcement[]>([]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const [remote, version] = await Promise.all([window.recly.getAnnouncements(), window.recly.getAppVersion()]);
			if (cancelled) return;
			setQueue(selectAnnouncements(BUNDLED_ANNOUNCEMENTS, remote as Announcement[], audience, version));
		})();
		return () => {
			cancelled = true;
		};
	}, [audience]);

	const current = queue[0] ?? null;

	useEffect(() => {
		if (current) recordAnnouncementImpression(current.id);
	}, [current]);

	const dismiss = useCallback(() => {
		setQueue((list) => list.slice(1));
	}, []);

	const dismissPermanently = useCallback(() => {
		if (!current) return;
		dismissAnnouncement(current.id);
		dismiss();
	}, [current, dismiss]);

	const runAction = useCallback(() => {
		if (current?.action?.url) {
			void window.recly.openExternalUrl(current.action.url);
		}
		dismissPermanently();
	}, [current, dismissPermanently]);

	return { current, dismiss: dismissPermanently, runAction };
}
