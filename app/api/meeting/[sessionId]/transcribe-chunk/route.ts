import { NextResponse } from "next/server";
import { getSessionDir, getDictionary, buildWhisperPrompt } from "@/lib/meeting-store";
import { TranscriptSegment } from "@/lib/meeting-schema";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const MLX_MODEL = "mlx-community/whisper-small-mlx";

function getMlxTranscribeScript(): string {
  return path.join(process.cwd(), "scripts", "mlx-transcribe.py");
}

function getMlxPython(): string {
  return path.join(process.cwd(), ".venv", "bin", "python3");
}

function parseSrtContent(srtContent: string, offsetSec: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timeMatch = lines[1]?.match(
      /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/
    );
    if (!timeMatch) continue;

    const text = lines.slice(2).join(" ").trim();
    if (!text) continue;

    segments.push({
      start: addOffset(timeMatch[1].replace(",", "."), offsetSec),
      end: addOffset(timeMatch[2].replace(",", "."), offsetSec),
      text,
    });
  }
  return segments;
}

function addOffset(timeStr: string, offsetSec: number): string {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseFloat(parts[2]);
  const total = h * 3600 + m * 60 + s + offsetSec;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = (total % 60).toFixed(3);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${ss.padStart(6, "0")}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const formData = await req.formData();
  const audioBlob = formData.get("audio") as File | null;
  const offsetStr = formData.get("offset") as string | null;
  const offset = offsetStr ? parseFloat(offsetStr) : 0;

  if (!audioBlob) {
    return NextResponse.json({ error: "No audio" }, { status: 400 });
  }

  const mlxPython = getMlxPython();
  const mlxScript = getMlxTranscribeScript();
  try {
    await fs.access(mlxPython);
    await fs.access(mlxScript);
  } catch {
    return NextResponse.json({ error: "mlx-whisper not configured" }, { status: 500 });
  }

  const dir = getSessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });

  const chunkWebm = path.join(dir, "chunk_temp.webm");
  const chunkWav = path.join(dir, "chunk_temp.wav");
  const chunkSrt = path.join(dir, "chunk_temp");

  try {
    // Save the audio blob
    const arrayBuffer = await audioBlob.arrayBuffer();
    await fs.writeFile(chunkWebm, Buffer.from(arrayBuffer));

    // Extract only audio from offset onwards, convert to WAV
    const ffmpegArgs = offset > 0
      ? `ffmpeg -y -i "${chunkWebm}" -ss ${offset} -ar 16000 -ac 1 -c:a pcm_s16le "${chunkWav}"`
      : `ffmpeg -y -i "${chunkWebm}" -ar 16000 -ac 1 -c:a pcm_s16le "${chunkWav}"`;
    await execAsync(ffmpegArgs, { timeout: 30000 });

    // Check if extracted audio is too short
    const wavStat = await fs.stat(chunkWav);
    if (wavStat.size < 10000) {
      // Less than ~0.3s of audio, skip
      return NextResponse.json({ segments: [] });
    }

    // Build whisper prompt from dictionary
    const dictionary = await getDictionary();
    const whisperPrompt = buildWhisperPrompt(dictionary);
    const promptArg = whisperPrompt ? ` --prompt "${whisperPrompt.replace(/"/g, '\\"')}"` : "";

    // Run mlx-whisper on the chunk
    const chunkSrtFile = `${chunkSrt}.srt`;
    await execAsync(
      `"${mlxPython}" "${mlxScript}" "${chunkWav}" "${chunkSrtFile}" --language ja --model "${MLX_MODEL}"${promptArg}`,
      { timeout: 120000 }
    );

    const srtContent = await fs.readFile(chunkSrtFile, "utf-8");
    const segments = parseSrtContent(srtContent, offset);

    return NextResponse.json({ segments });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chunk transcription failed" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    await fs.unlink(chunkWebm).catch(() => {});
    await fs.unlink(chunkWav).catch(() => {});
    await fs.unlink(`${chunkSrt}.srt`).catch(() => {});
  }
}
