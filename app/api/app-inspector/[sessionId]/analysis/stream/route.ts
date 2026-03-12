import { loadSession, sessionLogPath } from "@/lib/app-inspector-store";
import { analyzeApp } from "@/lib/app-inspector-analysis";
import { analyzeWithLLMStreaming } from "@/lib/app-inspector-llm-analysis";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await loadSession(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const forceRules = url.searchParams.get("rules") === "true";

  const screens = session.screens.map((s, i) => ({
    snapshotTree: s.snapshotTree,
    label: s.label,
    index: i,
  }));

  // If rules-only, return non-streaming
  if (forceRules) {
    const analysis = analyzeApp(session.screens, session.appPackage, session.appName);
    const body = JSON.stringify({ ...analysis, analysisMethod: "rules" });
    return new Response(body, {
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE streaming for LLM analysis
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("progress", { phase: "init", message: "分析を開始しています..." });

        const logFile = sessionLogPath(sessionId);
        const result = await analyzeWithLLMStreaming(
          screens,
          session.appPackage,
          session.appName,
          (phase, message) => send("progress", { phase, message }),
          logFile,
        );

        if (result) {
          send("result", { ...result, analysisMethod: "llm" });
        } else {
          // Fallback to rules
          send("progress", { phase: "fallback", message: "LLM分析に失敗。ルールベース分析にフォールバック..." });
          const analysis = analyzeApp(session.screens, session.appPackage, session.appName);
          send("result", { ...analysis, analysisMethod: "rules" });
        }
      } catch (err) {
        send("progress", { phase: "fallback", message: "エラー発生。ルールベース分析にフォールバック..." });
        const analysis = analyzeApp(session.screens, session.appPackage, session.appName);
        send("result", { ...analysis, analysisMethod: "rules" });
        console.error("[Analysis Stream]", err);
      } finally {
        send("done", {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
