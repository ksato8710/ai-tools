import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { getSession, saveSession } from "@/lib/presentation-store";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "data", "presentation-sessions");

/**
 * POST /api/presentation/:sessionId/refine
 *
 * AI-assisted refinement of planning fields (metadata & outline).
 * Streams progress via SSE while running `claude -p`.
 *
 * Body: {
 *   field: "targetAudience" | "purpose" | "keyMessages" | "outline"
 *   instruction: string   // user's prompt
 *   context: object       // current value + surrounding context
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { field, instruction, context } = await request.json();
  if (!field || !instruction) {
    return NextResponse.json(
      { error: "field and instruction are required" },
      { status: 400 }
    );
  }

  const { metadata, outline } = session.presentation;

  // Build a focused prompt based on the field
  const systemPrompt = buildSystemPrompt(field);
  const contextBlock = buildContextBlock(field, metadata, outline, context);
  const fullPrompt = `${systemPrompt}\n\n${contextBlock}\n\n## ユーザー指示\n${instruction}`;

  // Setup log
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(SESSIONS_DIR, sessionId);
  const logFileName = `refine-${field}-${timestamp}.log`;
  const logPath = path.join(logDir, logFileName);
  const logLines: string[] = [];
  const appendLog = (line: string) => {
    logLines.push(`[${new Date().toISOString()}] ${line}`);
  };

  appendLog(`=== Refine session: ${field} ===`);
  appendLog(`Instruction: ${instruction}`);
  appendLog(`Prompt length: ${fullPrompt.length}`);
  appendLog(`---`);

  const relativeLogPath = `data/presentation-sessions/${sessionId}/${logFileName}`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (event: string, data: unknown) => {
    await writer.write(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  };

  (async () => {
    try {
      await send("status", {
        phase: "starting",
        message: "Claude Code を起動中...",
        logPath: relativeLogPath,
      });

      const child = spawn(
        "claude",
        ["-p", "--model", "opus", "--output-format", "stream-json", "--verbose"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 120_000,
          env: { ...process.env, CLAUDECODE: undefined },
        }
      );

      child.stdin.write(fullPrompt);
      child.stdin.end();

      appendLog(`[spawn] pid=${child.pid}`);
      await send("status", {
        phase: "spawned",
        message: `Claude Code 起動完了 (pid: ${child.pid})`,
        logPath: relativeLogPath,
      });

      let stdout = "";

      child.stdout.on("data", async (chunk: Buffer) => {
        const raw = chunk.toString();
        stdout += raw;

        for (const line of raw.split("\n").filter(Boolean)) {
          try {
            const evt = JSON.parse(line);
            await handleStreamEvent(evt, send, appendLog);
          } catch {
            appendLog(`[raw] ${line.slice(0, 200)}`);
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) appendLog(`[stderr] ${msg}`);
      });

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on("close", resolve);
        child.on("error", (err) => {
          appendLog(`[error] ${err.message}`);
          resolve(null);
        });
      });

      appendLog(`--- exited with code ${exitCode} ---`);

      if (exitCode === null || exitCode !== 0) {
        await send("error", { message: `claude exited with code ${exitCode}` });
        await flushLog(logPath, logDir, logLines);
        await writer.close();
        return;
      }

      await send("status", {
        phase: "parsing",
        message: "レスポンスを解析中...",
        logPath: relativeLogPath,
      });

      const resultText = extractResultText(stdout);
      appendLog(`[result] ${resultText.slice(0, 500)}`);

      // Parse and apply the result
      const parsed = parseFieldResult(field, resultText);
      if (!parsed.ok) {
        await send("error", { message: parsed.error });
        appendLog(`[parse-error] ${parsed.error}`);
        await flushLog(logPath, logDir, logLines);
        await writer.close();
        return;
      }

      // Apply to session
      applyFieldResult(session, field, parsed.value);
      await saveSession(session);

      appendLog(`[saved] Field "${field}" updated`);
      await send("done", {
        field,
        value: parsed.value,
        message: `「${fieldLabel(field)}」を更新しました`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      appendLog(`[fatal] ${msg}`);
      try {
        await send("error", { message: msg });
      } catch {
        // writer closed
      }
    } finally {
      await flushLog(logPath, logDir, logLines);
      try {
        await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    targetAudience: "想定読者",
    purpose: "目的",
    keyMessages: "キーメッセージ",
    outline: "アウトライン",
  };
  return labels[field] || field;
}

function buildSystemPrompt(field: string): string {
  const base =
    "You are a presentation planning assistant. You help refine presentation design elements. Maintain Japanese language. Be concise and actionable.";

  switch (field) {
    case "targetAudience":
      return `${base}\nYour task is to refine the target audience description. Return ONLY the updated target audience text (plain text, no JSON, no markdown).`;
    case "purpose":
      return `${base}\nYour task is to refine the presentation purpose. Return ONLY the updated purpose text (plain text, no JSON, no markdown).`;
    case "keyMessages":
      return `${base}\nYour task is to refine the key messages. Return ONLY a JSON array of strings. Example: ["msg1","msg2","msg3"]. No markdown, no explanation.`;
    case "outline":
      return `${base}\nYour task is to refine the outline sections. Return ONLY a JSON array of objects with {id, title, points, slideIds}. Keep existing IDs where possible. No markdown, no explanation.`;
    default:
      return base;
  }
}

function buildContextBlock(
  field: string,
  metadata: { title: string; targetAudience: string; purpose: string; keyMessages: string[] },
  outline: unknown[],
  _context: unknown
): string {
  const parts: string[] = [];
  parts.push("## 現在のプレゼンテーション設計");
  parts.push(`- タイトル: ${metadata.title}`);
  parts.push(`- 想定読者: ${metadata.targetAudience}`);
  parts.push(`- 目的: ${metadata.purpose}`);
  parts.push(
    `- キーメッセージ: ${JSON.stringify(metadata.keyMessages)}`
  );
  parts.push("");

  if (field === "outline") {
    parts.push("## 現在のアウトライン");
    parts.push(JSON.stringify(outline, null, 2));
  }

  return parts.join("\n");
}

function parseFieldResult(
  field: string,
  text: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();

  if (field === "targetAudience" || field === "purpose") {
    // Plain text — strip any accidental quotes or markdown
    const clean = trimmed
      .replace(/^```[\s\S]*?\n/, "")
      .replace(/\n```$/, "")
      .replace(/^["']|["']$/g, "")
      .trim();
    if (!clean) return { ok: false, error: "Empty response" };
    return { ok: true, value: clean };
  }

  if (field === "keyMessages") {
    const json = extractJson(trimmed);
    if (!json) return { ok: false, error: "JSONの解析に失敗しました" };
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed))
      return { ok: false, error: "配列ではありません" };
    return { ok: true, value: parsed };
  }

  if (field === "outline") {
    const json = extractJson(trimmed);
    if (!json) return { ok: false, error: "JSONの解析に失敗しました" };
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed))
      return { ok: false, error: "配列ではありません" };
    return { ok: true, value: parsed };
  }

  return { ok: false, error: `Unknown field: ${field}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFieldResult(
  session: any,
  field: string,
  value: unknown
) {
  const meta = session.presentation.metadata;

  switch (field) {
    case "targetAudience":
    case "purpose":
      meta[field] = value as string;
      break;
    case "keyMessages":
      meta.keyMessages = value as string[];
      break;
    case "outline":
      session.presentation.outline = value;
      break;
  }
}

// --- Stream helpers (shared with fix route) ---

async function handleStreamEvent(
  evt: Record<string, unknown>,
  send: (event: string, data: unknown) => Promise<void>,
  appendLog: (line: string) => void
) {
  switch (evt.type) {
    case "system": {
      const model = (evt.model as string) || "unknown";
      await send("status", { phase: "initialized", message: `モデル: ${model}` });
      appendLog(`[system] model=${model}`);
      break;
    }
    case "assistant": {
      const msg = evt.message as Record<string, unknown> | undefined;
      if (msg?.content) {
        for (const block of msg.content as Array<Record<string, unknown>>) {
          if (block.type === "thinking") {
            const t = (block.thinking as string) || "";
            if (t) {
              await send("thinking", {
                text: t.slice(0, 200) + (t.length > 200 ? "..." : ""),
              });
              appendLog(`[thinking] ${t.slice(0, 300)}`);
            }
          } else if (block.type === "text") {
            const t = (block.text as string) || "";
            await send("text", { text: t.slice(0, 100) });
            appendLog(`[text] ${t.slice(0, 300)}`);
          }
        }
        const model = (msg.model as string) || "";
        if (model) {
          await send("status", { phase: "generating", message: `${model} が生成中...` });
        }
      }
      break;
    }
    case "result": {
      const cost = (evt.total_cost_usd as number) || 0;
      const duration = (evt.duration_ms as number) || 0;
      appendLog(`[result] $${cost.toFixed(4)}, ${duration}ms`);
      await send("status", {
        phase: "completed",
        message: `完了 ($${cost.toFixed(4)}, ${(duration / 1000).toFixed(1)}s)`,
      });
      break;
    }
  }
}

function extractResultText(stdout: string): string {
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === "result" && evt.result) return evt.result as string;
    } catch {
      continue;
    }
  }
  let text = "";
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === "assistant") {
        const msg = evt.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          for (const b of msg.content as Array<Record<string, unknown>>) {
            if (b.type === "text") text += (b.text as string) || "";
          }
        }
      }
    } catch {
      continue;
    }
  }
  return text;
}

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) {
    try {
      JSON.parse(fence[1].trim());
      return fence[1].trim();
    } catch {
      // continue
    }
  }
  const startArr = trimmed.indexOf("[");
  const startObj = trimmed.indexOf("{");
  const start =
    startArr === -1 ? startObj : startObj === -1 ? startArr : Math.min(startArr, startObj);
  const closer = start === startArr ? "]" : "}";
  const end = trimmed.lastIndexOf(closer);
  if (start !== -1 && end > start) {
    try {
      const c = trimmed.slice(start, end + 1);
      JSON.parse(c);
      return c;
    } catch {
      // give up
    }
  }
  return null;
}

async function flushLog(logPath: string, logDir: string, logLines: string[]) {
  try {
    await mkdir(logDir, { recursive: true });
    await writeFile(logPath, logLines.join("\n") + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to write log:", err);
  }
}
