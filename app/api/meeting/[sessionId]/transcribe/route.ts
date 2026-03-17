import { NextResponse } from "next/server";
import { getSession, saveSession, getSessionDir, getDictionary, buildWhisperPrompt } from "@/lib/meeting-store";
import { TranscriptSegment } from "@/lib/meeting-schema";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

function generateTitle(transcript: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const preview = transcript.slice(0, 2000);
    const prompt = `以下は会議の文字起こしの冒頭です。この会議の内容を端的に表す短いタイトル（20文字以内）を1つだけ出力してください。タイトルのみ出力し、他は何も出力しないでください。\n\n${preview}`;

    const proc = spawn(
      "claude",
      ["-p", "--model", "haiku", "--output-format", "json"],
      {
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60_000,
      }
    );

    proc.stdin.end(prompt);

    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", () => {});

    proc.on("close", () => {
      try {
        const parsed = JSON.parse(stdout);
        const title = (parsed.result || "").trim().replace(/^[「『"]|[」』"]$/g, "");
        if (title) {
          resolve(title);
          return;
        }
      } catch { /* ignore */ }
      resolve("");
    });

    proc.on("error", () => resolve(""));
  });
}

async function findWhisperCli(): Promise<string | null> {
  const candidates = [
    "whisper-cli",
    "/usr/local/bin/whisper-cli",
    "/opt/homebrew/bin/whisper-cli",
  ];

  // Also check common build locations
  const homeDir = process.env.HOME || "/Users";
  candidates.push(
    path.join(homeDir, "whisper.cpp/build/bin/whisper-cli"),
    path.join(homeDir, "Dev/whisper.cpp/build/bin/whisper-cli"),
  );

  for (const cmd of candidates) {
    try {
      await execAsync(`${cmd} --help 2>/dev/null`);
      return cmd;
    } catch {
      // not found
    }
  }

  // Try which
  try {
    const { stdout } = await execAsync("which whisper-cli");
    return stdout.trim();
  } catch {
    return null;
  }
}

async function findWhisperModel(): Promise<string | null> {
  const homeDir = process.env.HOME || "/Users";
  const candidates = [
    path.join(homeDir, "whisper.cpp/models/ggml-medium.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-large-v3.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-small.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-base.bin"),
    path.join(homeDir, "Dev/whisper.cpp/models/ggml-medium.bin"),
    path.join(homeDir, "Dev/whisper.cpp/models/ggml-large-v3.bin"),
    "/usr/local/share/whisper/models/ggml-medium.bin",
    "/opt/homebrew/share/whisper/models/ggml-medium.bin",
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // not found
    }
  }
  return null;
}

async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  await execAsync(
    `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`
  );
}

function parseSrtOutput(srtContent: string): TranscriptSegment[] {
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
      start: timeMatch[1].replace(",", "."),
      end: timeMatch[2].replace(",", "."),
      text,
    });
  }

  return segments;
}

function timestampToSeconds(value: string): number {
  const [hours, minutes, seconds] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.audioPath) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  // Find whisper-cli
  const whisperCli = await findWhisperCli();
  if (!whisperCli) {
    return NextResponse.json(
      {
        error: "whisper-cli not found",
        setup: [
          "git clone https://github.com/ggml-org/whisper.cpp ~/whisper.cpp",
          "cd ~/whisper.cpp && cmake -B build -DWHISPER_METAL=ON && cmake --build build -j",
          "bash ./models/download-ggml-model.sh medium",
        ],
      },
      { status: 500 }
    );
  }

  const model = await findWhisperModel();
  if (!model) {
    return NextResponse.json(
      {
        error: "Whisper model not found",
        setup: [
          "cd ~/whisper.cpp && bash ./models/download-ggml-model.sh medium",
        ],
      },
      { status: 500 }
    );
  }

  // Update status
  session.status = "transcribing";
  session.updatedAt = new Date().toISOString();
  await saveSession(session);

  try {
    const dir = getSessionDir(sessionId);
    const wavPath = path.join(dir, "recording.wav");

    // Convert to WAV if needed
    if (!session.audioPath.endsWith(".wav")) {
      await convertToWav(session.audioPath, wavPath);
    }

    const audioFile = session.audioPath.endsWith(".wav") ? session.audioPath : wavPath;

    // Build whisper prompt from dictionary
    const dictionary = await getDictionary();
    const whisperPrompt = buildWhisperPrompt(dictionary);
    const promptArg = whisperPrompt ? ` --prompt "${whisperPrompt.replace(/"/g, '\\"')}"` : "";

    // Run whisper-cli
    const srtPath = path.join(dir, "transcript");
    await execAsync(
      `"${whisperCli}" -m "${model}" -f "${audioFile}" -l ja -osrt -of "${srtPath}"${promptArg}`,
      { timeout: 600000 } // 10 min timeout
    );

    // Read SRT output
    const srtContent = await fs.readFile(`${srtPath}.srt`, "utf-8");
    const segments = parseSrtOutput(srtContent);
    const rawTranscript = segments.map((s) => s.text).join("\n");

    session.transcript = segments;
    session.rawTranscript = rawTranscript;
    if ((!session.duration || session.duration <= 0) && segments.length > 0) {
      session.duration = timestampToSeconds(segments[segments.length - 1].end);
    }
    session.status = "recorded";
    delete session.errorMessage;
    session.updatedAt = new Date().toISOString();

    // Generate a meaningful title from the transcript
    const aiTitle = await generateTitle(rawTranscript);
    if (aiTitle) {
      session.title = aiTitle;
    }

    await saveSession(session);

    return NextResponse.json(session);
  } catch (err) {
    session.status = "error";
    session.errorMessage = err instanceof Error ? err.message : "Transcription failed";
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json(
      { error: session.errorMessage },
      { status: 500 }
    );
  }
}
