import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";

export interface ProjectLibraryEntry {
	path: string;
	name: string;
	lastOpenedAt: number;
}

function libraryIndexPath(): string {
	return path.join(app.getPath("userData"), "project-library.json");
}

async function readLibrary(): Promise<ProjectLibraryEntry[]> {
	try {
		const raw = await fs.readFile(libraryIndexPath(), "utf8");
		return JSON.parse(raw) as ProjectLibraryEntry[];
	} catch {
		return [];
	}
}

async function writeLibrary(entries: ProjectLibraryEntry[]): Promise<void> {
	await fs.writeFile(libraryIndexPath(), JSON.stringify(entries, null, 2), "utf8");
}

/** Prunes entries whose file has been moved/deleted, then returns the rest, most-recent first. */
export async function listProjectLibrary(): Promise<ProjectLibraryEntry[]> {
	const entries = await readLibrary();
	const existing: ProjectLibraryEntry[] = [];
	for (const entry of entries) {
		try {
			await fs.access(entry.path);
			existing.push(entry);
		} catch {
			// File was moved/deleted — drop it from the library silently.
		}
	}
	if (existing.length !== entries.length) await writeLibrary(existing);
	return existing.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function registerProjectInLibrary(filePath: string): Promise<void> {
	const entries = await readLibrary();
	const name = path.basename(filePath, path.extname(filePath));
	const next = entries.filter((entry) => entry.path !== filePath);
	next.push({ path: filePath, name, lastOpenedAt: Date.now() });
	await writeLibrary(next);
}

export async function removeProjectFromLibrary(filePath: string): Promise<void> {
	const entries = await readLibrary();
	await writeLibrary(entries.filter((entry) => entry.path !== filePath));
}
