import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DIAGRAMS_DIR = path.join(process.cwd(), "data", "diagrams");

async function ensureDir() {
  await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
}

export async function GET() {
  await ensureDir();
  const files = await fs.readdir(DIAGRAMS_DIR);
  const diagrams = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const content = await fs.readFile(path.join(DIAGRAMS_DIR, f), "utf-8");
        const data = JSON.parse(content);
        return {
          id: data.id,
          name: data.name,
          updatedAt: data.updatedAt,
        };
      })
  );
  diagrams.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return NextResponse.json(diagrams);
}

export async function POST(request: Request) {
  await ensureDir();
  const body = await request.json();

  const id =
    body.id || `diagram_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const diagram = {
    ...body,
    id,
    updatedAt: now,
  };

  await fs.writeFile(
    path.join(DIAGRAMS_DIR, `${id}.json`),
    JSON.stringify(diagram, null, 2),
    "utf-8"
  );

  return NextResponse.json({ id, updatedAt: now });
}
