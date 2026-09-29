import type { Announcement } from "@/lib/announcements";

/** Bundled announcements, shipped with the app itself (as opposed to the remote feed). Empty
 * by default — add entries here for anything that should show even fully offline. */
export const BUNDLED_ANNOUNCEMENTS: Announcement[] = [];
