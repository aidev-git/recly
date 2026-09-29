const DEFAULT_FEED_URL = "https://raw.githubusercontent.com/syedships/Recly/main/announcements.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

interface AnnouncementRecord {
	id: string;
	title: string;
	body: string;
	presentation?: string;
	audience?: string;
	priority?: number;
	mediaMode?: string;
	maxImpressions?: number;
	controls?: unknown;
	media?: unknown;
	action?: unknown;
	startsAt?: string;
	endsAt?: string;
	minVersion?: string;
	maxVersion?: string;
}

let cachedAt = 0;
let cachedAnnouncements: AnnouncementRecord[] = [];

function getFeedUrl(): string | null {
	const configured = process.env.RECLY_ANNOUNCEMENTS_URL;
	if (configured === "off") return null;
	return configured ?? DEFAULT_FEED_URL;
}

/** Fetches the remote announcements feed with a short timeout, a size cap, and an HTTPS-only
 * requirement, caching the result for a few hours. Any failure (offline, timeout, no feed
 * published yet, bad JSON) resolves to an empty list rather than throwing — announcements are
 * a nice-to-have, never something that should block or error out the rest of the app. */
export async function getRemoteAnnouncements(): Promise<AnnouncementRecord[]> {
	const feedUrl = getFeedUrl();
	if (!feedUrl) return [];
	if (!feedUrl.startsWith("https://")) return [];

	if (Date.now() - cachedAt < CACHE_TTL_MS) {
		return cachedAnnouncements;
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		const response = await fetch(feedUrl, { signal: controller.signal });
		clearTimeout(timeout);

		if (!response.ok) return cachedAnnouncements;

		const contentLength = response.headers.get("content-length");
		if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) return cachedAnnouncements;

		const text = await response.text();
		if (text.length > MAX_RESPONSE_BYTES) return cachedAnnouncements;

		const parsed = JSON.parse(text) as { announcements?: AnnouncementRecord[] };
		cachedAnnouncements = Array.isArray(parsed.announcements) ? parsed.announcements : [];
		cachedAt = Date.now();
		return cachedAnnouncements;
	} catch {
		return cachedAnnouncements;
	}
}
