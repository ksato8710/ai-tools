import { NextResponse } from "next/server";
import { getSession } from "@/lib/meeting-store";
import fs from "fs/promises";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session || !session.audioPath) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(session.audioPath);
    const ext = session.audioFileName?.split(".").pop() || "webm";

    const mimeMap: Record<string, string> = {
      webm: "audio/webm",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
    };

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeMap[ext] || "audio/webm",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read audio" }, { status: 500 });
  }
}
