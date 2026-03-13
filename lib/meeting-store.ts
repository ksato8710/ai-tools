import fs from "fs/promises";
import path from "path";
import { MeetingSession } from "./meeting-schema";

const SESSIONS_DIR = path.join(process.cwd(), "data", "meeting-sessions");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function listSessions(): Promise<MeetingSession[]> {
  await ensureDir(SESSIONS_DIR);
  const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
  const sessions: MeetingSession[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const data = await fs.readFile(
        path.join(SESSIONS_DIR, entry.name, "session.json"),
        "utf-8"
      );
      sessions.push(JSON.parse(data));
    } catch {
      // skip invalid sessions
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getSession(id: string): Promise<MeetingSession | null> {
  try {
    const data = await fs.readFile(
      path.join(SESSIONS_DIR, id, "session.json"),
      "utf-8"
    );
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSession(session: MeetingSession): Promise<void> {
  const dir = path.join(SESSIONS_DIR, session.id);
  await ensureDir(dir);
  await fs.writeFile(
    path.join(dir, "session.json"),
    JSON.stringify(session, null, 2)
  );
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    await fs.rm(path.join(SESSIONS_DIR, id), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export function getSessionDir(id: string): string {
  return path.join(SESSIONS_DIR, id);
}

export function getAudioPath(id: string, fileName: string): string {
  return path.join(SESSIONS_DIR, id, fileName);
}
