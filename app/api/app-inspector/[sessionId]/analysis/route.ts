import { NextResponse } from "next/server";
import { loadSession } from "@/lib/app-inspector-store";
import { analyzeApp } from "@/lib/app-inspector-analysis";
import { analyzWithLLM } from "@/lib/app-inspector-llm-analysis";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const forceLLM = url.searchParams.get("llm") === "true";
  const forceRules = url.searchParams.get("rules") === "true";

  // Prepare screen data
  const screens = session.screens.map((s, i) => ({
    snapshotTree: s.snapshotTree,
    label: s.label,
    index: i,
  }));

  // Try LLM analysis first (unless explicitly requesting rules-only)
  if (!forceRules) {
    const llmAnalysis = await analyzWithLLM(screens, session.appPackage, session.appName);
    if (llmAnalysis) {
      return NextResponse.json({
        ...llmAnalysis,
        analysisMethod: "llm",
      });
    }
  }

  // Fallback to rule-based analysis
  if (forceLLM) {
    return NextResponse.json(
      { error: "LLM analysis failed and rules-only was not requested" },
      { status: 500 }
    );
  }

  const analysis = analyzeApp(session.screens, session.appPackage, session.appName);
  return NextResponse.json({
    ...analysis,
    analysisMethod: "rules",
  });
}
