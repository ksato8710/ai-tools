import fs from "fs/promises";
import path from "path";
import type { VariantSession } from "./variant-schema";

const SESSIONS_DIR = path.join(process.cwd(), "data", "variant-sessions");

async function ensureDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function filePath(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export async function listSessions(): Promise<
  Pick<VariantSession, "id" | "name" | "prompt" | "status" | "updatedAt" | "createdAt">[]
> {
  await ensureDir();
  const files = await fs.readdir(SESSIONS_DIR);
  const sessions = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const content = await fs.readFile(path.join(SESSIONS_DIR, f), "utf-8");
        const data = JSON.parse(content) as VariantSession;
        return {
          id: data.id,
          name: data.name,
          prompt: data.prompt,
          status: data.status,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
        };
      })
  );
  sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return sessions;
}

export async function getSession(id: string): Promise<VariantSession | null> {
  await ensureDir();
  try {
    const content = await fs.readFile(filePath(id), "utf-8");
    return JSON.parse(content) as VariantSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: VariantSession): Promise<void> {
  await ensureDir();
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath(session.id), JSON.stringify(session, null, 2), "utf-8");
}

export async function deleteSession(id: string): Promise<boolean> {
  await ensureDir();
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}
