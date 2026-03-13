import { NextResponse } from "next/server";
import { loadSession, saveSession, sessionLogPath } from "@/lib/app-inspector-store";
import { generateFinalReport } from "@/lib/app-inspector-llm-analysis";

// Module-level progress store for report generation
interface ReportProgressEntry {
  event: string;
  data: unknown;
  ts: number;
}

const reportProgressStore = new Map<string, {
  entries: ReportProgressEntry[];
  done: boolean;
}>();

function pushReportProgress(sessionId: string, event: string, data: unknown) {
  let store = reportProgressStore.get(sessionId);
  if (!store) {
    store = { entries: [], done: false };
    reportProgressStore.set(sessionId, store);
  }
  store.entries.push({ event, data, ts: Date.now() });
  if (event === "done") {
    store.done = true;
    setTimeout(() => reportProgressStore.delete(sessionId), 60_000);
  }
}

// GET: Poll report progress or get existing report
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const url = new URL(request.url);
  const pollProgress = url.searchParams.get("progress") === "true";
  const after = parseInt(url.searchParams.get("after") || "0", 10);

  if (pollProgress) {
    const store = reportProgressStore.get(sessionId);
    if (!store) {
      return NextResponse.json({ entries: [], done: false });
    }
    return NextResponse.json({
      entries: store.entries.slice(after),
      total: store.entries.length,
      done: store.done,
    });
  }

  // Return existing report
  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.report) {
    return NextResponse.json({ error: "No report generated yet" }, { status: 404 });
  }
  return NextResponse.json({ report: session.report });
}

// POST: Generate report
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.screens || session.screens.length === 0) {
    return NextResponse.json({ error: "No screens captured" }, { status: 400 });
  }

  reportProgressStore.delete(sessionId);
  pushReportProgress(sessionId, "progress", { phase: "init", message: "レポート生成を開始..." });

  // Run in background
  (async () => {
    try {
      const logFile = sessionLogPath(sessionId);
      const screens = session.screens.map((s, i) => ({
        snapshotTree: s.snapshotTree,
        label: s.label,
        index: i,
        screenshotPath: s.screenshotPath,
      }));

      pushReportProgress(sessionId, "progress", {
        phase: "generating",
        message: `${screens.length}画面のデータからレポートを生成中...`,
      });

      const report = await generateFinalReport(
        screens,
        session.appPackage,
        session.appName,
        (msg) => pushReportProgress(sessionId, "progress", { phase: "llm", message: msg }),
        logFile,
      );

      if (!report) {
        pushReportProgress(sessionId, "error", { message: "レポート生成に失敗しました" });
        pushReportProgress(sessionId, "done", {});
        return;
      }

      session.report = report;
      await saveSession(session);

      pushReportProgress(sessionId, "progress", { phase: "complete", message: "レポート生成完了" });
      pushReportProgress(sessionId, "result", { report });
      pushReportProgress(sessionId, "done", {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      pushReportProgress(sessionId, "error", { message: msg });
      pushReportProgress(sessionId, "done", {});
    }
  })();

  return NextResponse.json({ started: true });
}
