import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AppInspectorSession } from "./app-inspector-schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, "..", "data", "app-inspector-sessions");
const SCREENSHOTS_DIR = join(__dirname, "..", "public", "app-inspector");

export async function ensureDirs() {
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
}

function sessionPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

export async function loadSession(
  id: string
): Promise<AppInspectorSession | null> {
  try {
    const content = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(content) as AppInspectorSession;
  } catch {
    return null;
  }
}

export async function saveSession(
  session: AppInspectorSession
): Promise<void> {
  await ensureDirs();
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export async function listSessions(): Promise<AppInspectorSession[]> {
  await ensureDirs();
  try {
    const files = await readdir(SESSIONS_DIR);
    const sessions: AppInspectorSession[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const content = await readFile(join(SESSIONS_DIR, f), "utf-8");
      sessions.push(JSON.parse(content));
    }
    return sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getScreenshotsDir() {
  return SCREENSHOTS_DIR;
}
