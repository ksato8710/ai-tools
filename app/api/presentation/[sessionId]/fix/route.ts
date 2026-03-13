import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { getSession, saveSession } from "@/lib/presentation-store";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "data", "presentation-sessions");

/**
 * POST /api/presentation/:sessionId/fix
 *
 * Streams fix progress via SSE while running `claude -p --output-format stream-json --verbose`.
 * Prompt is passed via stdin to avoid argument-length limits.
 * Logs all output to data/presentation-sessions/{sessionId}/fix-{timestamp}.log
 *
 * Body: { prompt: string, slideId?: string }
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

  const { prompt, slideId } = await request.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const isSingleSlide = !!slideId;

  const systemInstruction = isSingleSlide
    ? [
        "You are a presentation slide editor.",
        "Fix the issue described below and return ONLY the fixed slide as a JSON object.",
        "Output ONLY valid JSON — no markdown, no explanation, no code fences.",
        "Keep the slide id, sectionId unchanged.",
        "Maintain the original language (Japanese) and intent.",
      ].join(" ")
    : [
        "You are a presentation slide editor.",
        "Fix ALL the issues described below and return ONLY the fixed slides as a JSON array.",
        "Output ONLY valid JSON — no markdown, no explanation, no code fences.",
        "Keep slide IDs, section IDs unchanged.",
        "Maintain the original language (Japanese) and intent.",
      ].join(" ");

  const fullPrompt = `${systemInstruction}\n\n${prompt}`;

  // Setup log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(SESSIONS_DIR, sessionId);
  const logFileName = `fix-${timestamp}.log`;
  const logPath = path.join(logDir, logFileName);
  const logLines: string[] = [];

  const appendLog = (line: string) => {
    const ts = new Date().toISOString();
    logLines.push(`[${ts}] ${line}`);
  };

  appendLog(`=== Fix session started ===`);
  appendLog(`Session: ${sessionId}`);
  appendLog(`SlideId: ${slideId || "(bulk)"}`);
  appendLog(`Prompt length: ${fullPrompt.length} chars`);
  appendLog(`Log file: ${logPath}`);
  appendLog(`---`);
  appendLog(`Prompt:\n${fullPrompt}`);
  appendLog(`---`);

  const relativeLogPath = `data/presentation-sessions/${sessionId}/${logFileName}`;

  // Use TransformStream for SSE — this ensures proper flushing in Next.js
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (event: string, data: unknown) => {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(chunk));
  };

  // Run the fix process in background
  (async () => {
    try {
      await send("status", {
        phase: "starting",
        message: "Claude Code を起動中...",
        logPath: relativeLogPath,
      });

      // Spawn claude with stdin for prompt, flags as separate args
      const child = spawn(
        "claude",
        ["-p", "--model", "opus", "--output-format", "stream-json", "--verbose"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 180_000,
          env: { ...process.env, CLAUDECODE: undefined },
        }
      );

      // Write prompt to stdin and close it
      child.stdin.write(fullPrompt);
      child.stdin.end();

      appendLog(`[spawn] claude process started (pid=${child.pid})`);
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
            appendLog(`[stdout-raw] ${line.slice(0, 200)}`);
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) appendLog(`[stderr] ${msg}`);
      });

      // Wait for process to complete
      const exitCode = await new Promise<number | null>((resolve) => {
        child.on("close", resolve);
        child.on("error", (err) => {
          appendLog(`[spawn-error] ${err.message}`);
          resolve(null);
        });
      });

      appendLog(`--- claude exited with code ${exitCode} ---`);

      if (exitCode === null || exitCode !== 0) {
        await send("error", {
          message: `claude exited with code ${exitCode}`,
        });
        await writeLogFile(logPath, logDir, logLines);
        await writer.close();
        return;
      }

      // Parse result
      await send("status", {
        phase: "parsing",
        message: "レスポンスを解析中...",
        logPath: relativeLogPath,
      });

      const resultText = extractResultText(stdout);
      appendLog(`[result-text] ${resultText.slice(0, 500)}`);

      const jsonMatch = extractJson(resultText);
      if (!jsonMatch) {
        const errMsg = "Claude Code が有効なJSONを返しませんでした";
        await send("error", {
          message: errMsg,
          raw: resultText.slice(0, 300),
        });
        appendLog(`[error] ${errMsg}`);
        await writeLogFile(logPath, logDir, logLines);
        await writer.close();
        return;
      }

      const fixed = JSON.parse(jsonMatch);

      if (isSingleSlide) {
        if (!fixed.id || !fixed.layout) {
          await send("error", {
            message: "Response is not a valid Slide object",
          });
          await writeLogFile(logPath, logDir, logLines);
          await writer.close();
          return;
        }
        session.presentation.slides = session.presentation.slides.map(
          (s: { id: string }) => (s.id === fixed.id ? fixed : s)
        );
        appendLog(`[success] Slide ${fixed.id} updated`);
      } else {
        if (!Array.isArray(fixed)) {
          await send("error", {
            message: "Response is not a valid slides array",
          });
          await writeLogFile(logPath, logDir, logLines);
          await writer.close();
          return;
        }
        session.presentation.slides = fixed;
        appendLog(`[success] ${fixed.length} slides updated`);
      }

      await saveSession(session);
      await send("done", {
        slidesCount: session.presentation.slides.length,
        message: "修正が適用されました",
      });
      appendLog(`[saved] Session saved successfully`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      appendLog(`[fatal] ${errMsg}`);
      try {
        await send("error", { message: errMsg });
      } catch {
        // writer may be closed
      }
    } finally {
      await writeLogFile(logPath, logDir, logLines);
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

async function handleStreamEvent(
  evt: Record<string, unknown>,
  send: (event: string, data: unknown) => Promise<void>,
  appendLog: (line: string) => void
) {
  switch (evt.type) {
    case "system": {
      const model = (evt.model as string) || "unknown";
      await send("status", {
        phase: "initialized",
        message: `モデル: ${model}`,
      });
      appendLog(
        `[system] init - model=${model}, session=${evt.session_id}`
      );
      break;
    }
    case "assistant": {
      const msg = evt.message as Record<string, unknown> | undefined;
      if (msg) {
        const model = (msg.model as string) || "";
        const content = msg.content as
          | Array<Record<string, unknown>>
          | undefined;
        if (content) {
          for (const block of content) {
            if (block.type === "thinking") {
              const thinking = (block.thinking as string) || "";
              if (thinking.length > 0) {
                const preview =
                  thinking.slice(0, 200) +
                  (thinking.length > 200 ? "..." : "");
                await send("thinking", { text: preview });
                appendLog(`[thinking] ${thinking.slice(0, 500)}`);
              }
            } else if (block.type === "text") {
              const text = (block.text as string) || "";
              await send("text", { text: text.slice(0, 100) });
              appendLog(`[text] ${text.slice(0, 300)}`);
            }
          }
        }
        if (model) {
          await send("status", {
            phase: "generating",
            message: `${model} が生成中...`,
          });
        }
      }
      break;
    }
    case "result": {
      const cost = (evt.total_cost_usd as number) || 0;
      const duration = (evt.duration_ms as number) || 0;
      appendLog(
        `[result] cost=$${cost.toFixed(4)}, duration=${duration}ms, stop=${evt.stop_reason}`
      );
      await send("status", {
        phase: "completed",
        message: `完了 ($${cost.toFixed(4)}, ${(duration / 1000).toFixed(1)}s)`,
      });
      break;
    }
    default:
      appendLog(
        `[event:${evt.type}] ${JSON.stringify(evt).slice(0, 200)}`
      );
  }
}

function extractResultText(stdout: string): string {
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === "result" && evt.result) {
        return evt.result as string;
      }
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

  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      JSON.parse(fenceMatch[1].trim());
      return fenceMatch[1].trim();
    } catch {
      // continue
    }
  }

  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");
  const start =
    startObj === -1
      ? startArr
      : startArr === -1
      ? startObj
      : Math.min(startObj, startArr);
  const closer = start === startArr ? "]" : "}";
  const end = trimmed.lastIndexOf(closer);
  if (start !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // give up
    }
  }

  return null;
}

async function writeLogFile(
  logPath: string,
  logDir: string,
  logLines: string[]
) {
  try {
    await mkdir(logDir, { recursive: true });
    await writeFile(logPath, logLines.join("\n") + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to write log file:", err);
  }
}
