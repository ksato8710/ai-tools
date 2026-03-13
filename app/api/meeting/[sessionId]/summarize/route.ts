import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/meeting-store";
import { spawn } from "child_process";

function callClaude(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["-p", "--model", "sonnet", "--output-format", "stream-json"],
      {
        env: { ...process.env, CLAUDECODE: undefined, ANTHROPIC_API_KEY: undefined },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120_000,
      }
    );

    proc.stdin.end(prompt);

    let resultText = "";
    let buffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "result") {
            resultText = event.result || "";
            if (event.is_error) {
              reject(new Error(`Claude error: ${resultText}`));
            }
          }
        } catch { /* skip */ }
      }
    });

    proc.stderr.on("data", () => {});

    proc.on("close", (code) => {
      if (code !== 0 && !resultText) {
        reject(new Error(`Claude exited with code ${code}`));
      } else {
        resolve(resultText);
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
    const prompt = `以下は会議の音声トランスクリプトです。議事録として要約してください。

## 出力フォーマット（JSON）
{
  "overview": "会議の概要（2-3文）",
  "keyPoints": ["要点1", "要点2", ...],
  "actionItems": [{"task": "タスク内容", "assignee": "担当者（わかれば）", "deadline": "期限（わかれば）"}],
  "decisions": ["決定事項1", "決定事項2", ...]
}

## トランスクリプト
${session.rawTranscript}

JSONのみを出力してください。`;

    const text = await callClaude(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse summary" }, { status: 500 });
    }

    const summary = JSON.parse(jsonMatch[0]);
    session.summary = summary;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summary failed" },
      { status: 500 }
    );
  }
}
