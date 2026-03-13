import { NextResponse } from "next/server";
import { getSession, saveSession, getSessionDir } from "@/lib/meeting-store";
import fs from "fs/promises";
import path from "path";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("audio") as File | null;
  const duration = formData.get("duration") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const dir = getSessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });

  const ext = file.name.split(".").pop() || "webm";
  const fileName = `recording.${ext}`;
  const filePath = path.join(dir, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));

  session.audioPath = filePath;
  session.audioFileName = fileName;
  session.status = "recorded";
  session.duration = duration ? parseFloat(duration) : undefined;
  session.updatedAt = new Date().toISOString();

  await saveSession(session);
  return NextResponse.json(session);
}
