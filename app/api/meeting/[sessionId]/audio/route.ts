import { NextResponse } from "next/server";
import { getSession } from "@/lib/meeting-store";
import fs from "fs/promises";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session || !session.audioPath) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  try {
    const stat = await fs.stat(session.audioPath);
    const fileSize = stat.size;
    const ext = session.audioFileName?.split(".").pop() || "webm";

    const mimeMap: Record<string, string> = {
      webm: "audio/webm",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
    };
    const contentType = mimeMap[ext] || "audio/webm";

    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const fileHandle = await fs.open(session.audioPath, "r");
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
    }

    // No range requested — return full file
    const buffer = await fs.readFile(session.audioPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read audio" }, { status: 500 });
  }
}
