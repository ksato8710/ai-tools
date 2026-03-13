import { NextResponse } from "next/server";
import { WhisperStatus } from "@/lib/meeting-schema";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export async function GET() {
  const status: WhisperStatus = {
    available: false,
    ffmpegAvailable: false,
    message: "",
  };

  // Check ffmpeg
  try {
    await execAsync("which ffmpeg");
    status.ffmpegAvailable = true;
  } catch {
    status.message = "ffmpegがインストールされていません。brew install ffmpeg で導入してください。";
    return NextResponse.json(status);
  }

  // Check whisper-cli
  const homeDir = process.env.HOME || "/Users";
  const candidates = [
    "whisper-cli",
    "/opt/homebrew/bin/whisper-cli",
    "/usr/local/bin/whisper-cli",
    path.join(homeDir, "whisper.cpp/build/bin/whisper-cli"),
    path.join(homeDir, "Dev/whisper.cpp/build/bin/whisper-cli"),
  ];

  for (const cmd of candidates) {
    try {
      await execAsync(`"${cmd}" --help 2>/dev/null`);
      status.path = cmd;
      break;
    } catch {
      // not found
    }
  }

  if (!status.path) {
    try {
      const { stdout } = await execAsync("which whisper-cli");
      status.path = stdout.trim();
    } catch {
      // not found
    }
  }

  if (!status.path) {
    status.message =
      "whisper-cliが見つかりません。セットアップ手順に従ってインストールしてください。";
    return NextResponse.json(status);
  }

  // Check model
  const modelCandidates = [
    path.join(homeDir, "whisper.cpp/models/ggml-medium.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-large-v3.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-small.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-base.bin"),
    path.join(homeDir, "Dev/whisper.cpp/models/ggml-medium.bin"),
  ];

  for (const p of modelCandidates) {
    try {
      await fs.access(p);
      status.modelPath = p;
      break;
    } catch {
      // not found
    }
  }

  if (!status.modelPath) {
    status.message =
      "Whisperモデルが見つかりません。models/download-ggml-model.sh medium でダウンロードしてください。";
    return NextResponse.json(status);
  }

  status.available = true;
  status.message = "準備完了";
  return NextResponse.json(status);
}
