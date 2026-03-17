import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/meeting-store";
import { spawn } from "child_process";

function callClaude(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["-p", "--model", "sonnet", "--output-format", "json"],
      {
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 600_000,
      }
    );

    proc.stdin.end(prompt);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.result || "");
      } catch {
        resolve(stdout);
      }
    });

    proc.on("error", (err) => reject(err));
  });
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

  if (!session.rawTranscript) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  try {
    const prompt = `あなたは会議の文字起こしを整文するエディターです。以下の音声認識テキストを、読みやすい文章に整えてください。

## ルール
- 内容は一切削除・省略しないでください。すべての発言を残してください
- 「えー」「あの」「うーん」などのフィラーは除去してください
- 句読点を適切に付与してください
- 明らかな認識ミス（同音異義語の誤り等）は文脈から推測して修正してください
- 話者の交代が推測できる場合は改行で区切ってください
- 敬体・常体は元の発言のまま維持してください
- 追加の要約や注釈は不要です。整文した本文のみを出力してください

## 文字起こし原文
${session.rawTranscript}

整文した本文のみを出力してください。`;

    const refined = await callClaude(prompt);

    session.refinedTranscript = refined;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refine failed" },
      { status: 500 }
    );
  }
}
