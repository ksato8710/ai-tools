import { readdir, readFile, writeFile, mkdir, unlink } from "fs/promises";
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

/** Log file path for a session (alongside the .json) */
export function sessionLogPath(id: string) {
  return join(SESSIONS_DIR, `${id}.log`);
}

export function getSessionsDir() {
  return SESSIONS_DIR;
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

export async function deleteSession(id: string): Promise<boolean> {
  try {
    const session = await loadSession(id);
    if (!session) return false;

    // Delete screenshot files
    for (const screen of session.screens) {
      const filename = screen.screenshotPath.replace("/app-inspector/", "");
      try { await unlink(join(SCREENSHOTS_DIR, filename)); } catch { /* ignore */ }
    }

    // Delete session JSON
    await unlink(sessionPath(id));
    return true;
  } catch {
    return false;
  }
}

export function getScreenshotsDir() {
  return SCREENSHOTS_DIR;
}
