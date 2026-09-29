export type AnnouncementPresentation = "popup" | "banner";
export type AnnouncementAudience = "all" | "editor";
export type AnnouncementMediaMode = "banner" | "cover";
export type AnnouncementActionSection = "scene" | "cursor" | "webcam" | "captions" | "settings" | "extensions";

export interface AnnouncementMedia {
	type: "image" | "video";
	url: string;
	alt?: string;
	posterUrl?: string;
}

export interface AnnouncementAction {
	label: string;
	url?: string;
	section?: AnnouncementActionSection;
}

export interface AnnouncementControls {
	close?: boolean;
	dismiss?: boolean;
	action?: boolean;
}

export interface Announcement {
	id: string;
	title: string;
	body: string;
	presentation?: AnnouncementPresentation;
	audience: AnnouncementAudience;
	priority: number;
	mediaMode?: AnnouncementMediaMode;
	maxImpressions?: number;
	controls?: AnnouncementControls;
	media?: AnnouncementMedia;
	action?: AnnouncementAction;
	startsAt?: string;
	endsAt?: string;
	minVersion?: string;
	maxVersion?: string;
}

export interface AnnouncementFeed {
	announcements: Announcement[];
}

const DISMISSED_KEY = "recly.announcements.dismissedIds";
const IMPRESSIONS_KEY = "recly.announcements.impressions";

function loadDismissedIds(): Set<string> {
	try {
		const raw = localStorage.getItem(DISMISSED_KEY);
		return new Set(raw ? (JSON.parse(raw) as string[]) : []);
	} catch {
		return new Set();
	}
}

export function dismissAnnouncement(id: string): void {
	const dismissed = loadDismissedIds();
	dismissed.add(id);
	localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

function loadImpressions(): Record<string, number> {
	try {
		const raw = localStorage.getItem(IMPRESSIONS_KEY);
		return raw ? (JSON.parse(raw) as Record<string, number>) : {};
	} catch {
		return {};
	}
}

export function recordAnnouncementImpression(id: string): void {
	const impressions = loadImpressions();
	impressions[id] = (impressions[id] ?? 0) + 1;
	localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(impressions));
}

/** Compares two "x.y.z" version strings numerically per segment. Returns <0, 0, or >0. */
function compareVersions(a: string, b: string): number {
	const partsA = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
	const partsB = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
	const length = Math.max(partsA.length, partsB.length);
	for (let i = 0; i < length; i += 1) {
		const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** Merges bundled + remote announcements (remote wins on id collision), then drops anything
 * dismissed, impression-capped, audience-mismatched, out of date range, or out of version
 * range, and sorts survivors by priority (descending). */
export function selectAnnouncements(
	bundled: Announcement[],
	remote: Announcement[],
	audience: AnnouncementAudience,
	currentVersion: string,
	now: Date = new Date(),
): Announcement[] {
	const merged = new Map<string, Announcement>();
	for (const announcement of bundled) merged.set(announcement.id, announcement);
	for (const announcement of remote) merged.set(announcement.id, announcement);

	const dismissed = loadDismissedIds();
	const impressions = loadImpressions();

	return [...merged.values()]
		.filter((announcement) => !dismissed.has(announcement.id))
		.filter((announcement) => {
			const seen = impressions[announcement.id] ?? 0;
			return announcement.maxImpressions === undefined || seen < announcement.maxImpressions;
		})
		.filter((announcement) => announcement.audience === "all" || announcement.audience === audience)
		.filter((announcement) => {
			if (announcement.startsAt && now < new Date(announcement.startsAt)) return false;
			if (announcement.endsAt && now > new Date(announcement.endsAt)) return false;
			return true;
		})
		.filter((announcement) => {
			if (announcement.minVersion && compareVersions(currentVersion, announcement.minVersion) < 0) return false;
			if (announcement.maxVersion && compareVersions(currentVersion, announcement.maxVersion) > 0) return false;
			return true;
		})
		.sort((a, b) => b.priority - a.priority);
}
