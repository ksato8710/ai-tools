import { NextResponse } from "next/server";
import { join } from "path";
import { appendFile } from "fs/promises";
import { loadSession, saveSession, getScreenshotsDir, sessionLogPath } from "@/lib/app-inspector-store";
import {
  openApp,
  takeScreenshot,
  takeSnapshot,
  parseSnapshotTree,
  scrollDown,
  scrollUp,
  goBack,
  getForegroundPackage,
  pressElement,
  ensureDeviceReady,
  startScreenRecording,
  keepScreenOn,
  restoreScreenTimeout,
  waitForDevice,
} from "@/lib/agent-device";
import { generateId } from "@/lib/app-inspector-schema";
import type { CapturedScreen, ComponentCount, AppInspectorSession } from "@/lib/app-inspector-schema";
import { analyzeForNextCaptures, type UncapturedTarget } from "@/lib/app-inspector-llm-analysis";

// ============================================================
// Module-level progress store
// ============================================================
interface CaptureProgressEntry {
  event: string;
  data: unknown;
  ts: number;
}

const progressStore = new Map<string, {
  entries: CaptureProgressEntry[];
  done: boolean;
}>();

function pushProgress(sessionId: string, event: string, data: unknown) {
  let store = progressStore.get(sessionId);
  if (!store) {
    store = { entries: [], done: false };
    progressStore.set(sessionId, store);
  }
  store.entries.push({ event, data, ts: Date.now() });
  if (event === "done") {
    store.done = true;
    setTimeout(() => progressStore.delete(sessionId), 60_000);
  }
}

// ============================================================
// GET: Poll progress
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const url = new URL(request.url);
  const after = parseInt(url.searchParams.get("after") || "0", 10);

  const store = progressStore.get(sessionId);
  if (!store) {
    return NextResponse.json({ entries: [], done: false });
  }

  return NextResponse.json({
    entries: store.entries.slice(after),
    total: store.entries.length,
    done: store.done,
  });
}

// ============================================================
// POST: Start iterative capture+analysis loop
// ============================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const { mode: rawMode, userFeedback } = body as { mode?: string; userFeedback?: string };
  const mode = (rawMode || "both") as "screenshot" | "analysis" | "both";

  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  progressStore.delete(sessionId);
  const initMsg = userFeedback
    ? `追加キャプチャを開始します（ユーザー指示あり）…`
    : "反復キャプチャを開始します…";
  pushProgress(sessionId, "progress", { phase: "init", message: initMsg });

  const captureScreenshots = mode === "screenshot" || mode === "both";
  const captureSnapshots = mode === "analysis" || mode === "both";

  runIterativeCapture(sessionId, session, captureScreenshots, captureSnapshots, userFeedback).catch((err) => {
    console.error("[Iterative Capture] Unhandled error:", err);
  });

  return NextResponse.json({ started: true, sessionId });
}

// ============================================================
// Constants
// ============================================================
const MAX_ROUNDS = 8;             // 最大ラウンド数
const MAX_TOTAL_SCREENS = 30;     // 最大画面数
const VIDEO_MAX_MS = 180_000;     // 動画最大3分
const MAX_TARGETS_PER_ROUND = 8;  // 1ラウンドあたり最大ターゲット数

// ============================================================
// Iterative capture + analysis loop
// ============================================================
async function runIterativeCapture(
  sessionId: string,
  session: AppInspectorSession,
  captureScreenshots: boolean,
  captureSnapshots: boolean,
  userFeedback?: string,
) {
  const logFile = sessionLogPath(sessionId);
  const captureLog: string[] = [];
  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${msg}`;
    captureLog.push(line);
    appendFile(logFile, line + "\n").catch(() => {});
  };
  const emit = (event: string, data: unknown) => {
    pushProgress(sessionId, event, data);
    // Also write progress events to log
    if (event === "progress") {
      const d = data as { phase?: string; message?: string };
      log(`[${d.phase || event}] ${d.message || ""}`);
    } else if (event === "screen") {
      const d = data as { label?: string; screenId?: string };
      log(`[screen] Captured: "${d.label}" (${d.screenId})`);
    } else if (event === "error") {
      log(`[ERROR] ${JSON.stringify(data)}`);
    }
  };
  // Write log header
  const header = `=== App Inspector Capture Log ===\nSession: ${sessionId}\nApp: ${session.appName} (${session.appPackage})\nStarted: ${new Date().toISOString()}\nLog file: ${logFile}\n${"=".repeat(40)}\n`;
  appendFile(logFile, header).catch(() => {});

  // Emit log path to UI
  pushProgress(sessionId, "log-path", { logPath: logFile });

  const capturedHashes = new Set<string>();
  const captureStartTime = Date.now();

  try {
    // ========== Device check ==========
    emit("progress", { phase: "device-check", message: "端末の準備を確認中…" });
    const readiness = await ensureDeviceReady();
    if (!readiness.ready) {
      emit("error", { message: readiness.message || "Device not ready" });
      return;
    }
    log("Device ready");

    // Keep screen on during capture
    await keepScreenOn();
    log("Screen stay-on enabled");

    // ========== Screen recording (max 3 min) ==========
    emit("progress", { phase: "recording", message: "画面録画を開始…" });
    const videoFileName = `${session.id}_recording.mp4`;
    const videoFullPath = join(getScreenshotsDir(), videoFileName);
    const videoPublicPath = `/app-inspector/${videoFileName}`;
    let recorder: { stop: () => Promise<void> } | null = null;
    try {
      recorder = startScreenRecording(videoFullPath);
      log("Screen recording started");
    } catch {
      log("Screen recording failed to start");
    }

    // ========== Open app ==========
    emit("progress", { phase: "app-open", message: `アプリを起動: ${session.appPackage}` });
    await openApp(session.appPackage);
    await delay(3000);
    log(`Opened app: ${session.appPackage}`);

    // ========== Round 0: Initial exploration ==========
    emit("progress", { phase: "round-0", message: "初回探索: ホーム画面とタブを取得…" });
    log("=== Round 0: Initial exploration ===");

    try {
      await initialExploration(session, captureScreenshots, captureSnapshots, capturedHashes, log, emit);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "unknown error";
      log(`Initial exploration error: ${errMsg}`);
      emit("progress", { phase: "error", message: `初回探索中にエラー: ${errMsg}` });
      // If we have screens, continue to analysis rounds
    }
    await saveSession(session);

    if (session.screens.length === 0) {
      throw new Error("ホーム画面の取得に失敗しました。端末とアプリの状態を確認してください。");
    }

    log(`Initial exploration: ${session.screens.length} screens captured`);
    emit("progress", { phase: "round-0", message: `初回探索完了: ${session.screens.length}画面取得` });

    // ========== Iterative rounds ==========
    let coveredFeatures: string[] = [];

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (session.screens.length >= MAX_TOTAL_SCREENS) {
        log(`Max screens reached (${MAX_TOTAL_SCREENS}), stopping`);
        break;
      }

      // Stop video recording if > 3 min
      if (recorder && Date.now() - captureStartTime > VIDEO_MAX_MS) {
        emit("progress", { phase: "recording", message: "録画3分到達、録画を停止…" });
        try {
          await recorder.stop();
          session.videoPath = videoPublicPath;
          log("Screen recording stopped (3 min limit)");
        } catch { log("Failed to stop recording"); }
        recorder = null;
        await saveSession(session);
      }

      // ---- LLM Analysis ----
      emit("progress", { phase: `round-${round}-analysis`, message: `ラウンド${round}: LLM構造分析中…` });
      log(`=== Round ${round}: LLM Analysis ===`);

      const screens = session.screens.map((s, i) => ({
        snapshotTree: s.snapshotTree,
        label: s.label,
        index: i,
      }));

      const analysisResult = await analyzeForNextCaptures(
        screens,
        session.appPackage,
        session.appName,
        coveredFeatures.length > 0 ? coveredFeatures : undefined,
        (msg) => emit("progress", { phase: `round-${round}-analysis`, message: msg }),
        logFile,
        round === 1 ? userFeedback : undefined, // Pass user feedback only on first round
      );

      if (!analysisResult) {
        log("LLM analysis returned null, stopping");
        emit("progress", { phase: `round-${round}-analysis`, message: "LLM分析失敗、ループを終了" });
        break;
      }

      coveredFeatures = analysisResult.coveredFeatures;
      log(`Covered features: ${coveredFeatures.length}, Uncaptured: ${analysisResult.uncapturedTargets.length}`);
      log(`Summary: ${analysisResult.summary}`);

      if (analysisResult.newDiscoveries.length > 0) {
        log(`New discoveries: ${analysisResult.newDiscoveries.join(", ")}`);
      }

      emit("progress", {
        phase: `round-${round}-analysis`,
        message: `把握済み機能: ${coveredFeatures.length}件 / 未取得: ${analysisResult.uncapturedTargets.length}件`,
      });

      // Emit analysis summary for intermediate output
      pushProgress(sessionId, "analysis-result", {
        round,
        coveredFeatures: analysisResult.coveredFeatures,
        uncapturedCount: analysisResult.uncapturedTargets.length,
        uncapturedTargets: analysisResult.uncapturedTargets.slice(0, 5).map((t) => ({
          featureName: t.featureName,
          priority: t.priority,
        })),
        newDiscoveries: analysisResult.newDiscoveries,
        summary: analysisResult.summary,
        isComplete: analysisResult.isComplete,
      });

      if (analysisResult.isComplete || analysisResult.uncapturedTargets.length === 0) {
        log("All features covered, stopping");
        emit("progress", { phase: `round-${round}-analysis`, message: "すべての主要機能をカバーしました" });
        break;
      }

      // ---- Navigate to uncaptured targets ----
      const targets = analysisResult.uncapturedTargets.slice(0, MAX_TARGETS_PER_ROUND);
      emit("progress", {
        phase: `round-${round}-capture`,
        message: `ラウンド${round}: ${targets.length}件の未取得画面をキャプチャ中…`,
      });
      log(`=== Round ${round}: Capturing ${targets.length} targets ===`);

      let newScreensThisRound = 0;
      let consecutiveFailures = 0;

      for (const target of targets) {
        if (session.screens.length >= MAX_TOTAL_SCREENS) break;

        // Check device
        let midCheck = await ensureDeviceReady();
        if (!midCheck.ready) {
          log("Device not ready, attempting recovery...");
          emit("progress", { phase: "recovery", message: "端末との接続を回復中..." });
          const recovered = await waitForDevice(15000);
          if (recovered) {
            midCheck = await ensureDeviceReady();
          }
          if (!midCheck.ready) {
            log("Device recovery failed");
            emit("error", { message: `端末がロックされました（${session.screens.length}画面取得済み）` });
            break;
          }
          log("Device recovered");
          emit("progress", { phase: "recovery", message: "端末との接続が回復しました" });
        }

        emit("progress", {
          phase: "target",
          message: `探索: "${target.featureName}" (${target.navigationHint})`,
        });
        log(`Target: "${target.featureName}" via "${target.targetLabel}"`);

        const captured = await navigateAndCapture(
          session, target, captureScreenshots, captureSnapshots, capturedHashes, log
        );

        if (captured) {
          consecutiveFailures = 0; // reset on success
          newScreensThisRound++;
          await saveSession(session);
          emit("screen", {
            screenId: captured.id,
            label: captured.label,
            index: captured.index,
            screenshotPath: captured.screenshotPath,
          });
          log(`Captured: "${captured.label}"`);
        } else {
          consecutiveFailures++;
          log(`Failed to capture: "${target.featureName}" (consecutive: ${consecutiveFailures})`);
          if (consecutiveFailures >= 3) {
            log("3 consecutive failures, skipping remaining targets in this round");
            emit("progress", { phase: `round-${round}-capture`, message: "連続3回失敗、このラウンドの残りターゲットをスキップ" });
            break;
          }
        }
      }

      emit("progress", {
        phase: `round-${round}-capture`,
        message: `ラウンド${round}完了: ${newScreensThisRound}画面追加（合計${session.screens.length}画面）`,
      });

      if (newScreensThisRound === 0) {
        log("No new screens captured this round, stopping");
        break;
      }
    }

    // ========== Stop recording ==========
    if (recorder) {
      try {
        await recorder.stop();
        session.videoPath = videoPublicPath;
        log("Screen recording saved");
      } catch {
        log("Failed to save screen recording");
      }
    }

    // ========== Final summary ==========
    emit("progress", { phase: "summary", message: "最終サマリーを生成中…" });
    log("=== Final Summary ===");

    const allElements = session.screens.flatMap((s) => parseSnapshotTree(s.snapshotTree));
    const typeCounts = new Map<string, number>();
    for (const el of allElements) {
      typeCounts.set(el.type.toLowerCase(), (typeCounts.get(el.type.toLowerCase()) || 0) + 1);
    }

    session.summary = {
      totalScreens: session.screens.length,
      uniqueScreens: session.screens.length,
      avgInteractiveElements: Math.round(
        session.screens.reduce((sum, s) => sum + s.interactiveElements, 0) /
          Math.max(session.screens.length, 1)
      ),
      navigationPattern: detectNavPattern(allElements),
      componentInventory: Array.from(typeCounts.entries())
        .map(([type, count]): ComponentCount => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };
    session.status = "completed";
    session.captureLog = captureLog;
    log(`Capture completed: ${session.screens.length} screens`);
    await saveSession(session);

    emit("progress", { phase: "complete", message: `完了: ${session.screens.length}画面取得` });
    emit("result", {
      status: "completed",
      screensCount: session.screens.length,
      sessionId: session.id,
    });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Capture failed";
    session.captureLog = captureLog;

    if (session.screens.length > 0) {
      // Partial success — screens were captured before the error
      session.status = "completed";
      session.error = errMsg;
      log(`Partial completion: ${session.screens.length} screens captured before error: ${errMsg}`);
      emit("progress", { phase: "error", message: `エラー発生: ${errMsg}（${session.screens.length}画面は取得済み）` });
    } else {
      session.status = "error";
      session.error = errMsg;
      log(`Error: ${errMsg}`);
      emit("error", { message: errMsg });
    }
    await saveSession(session);
  } finally {
    // Restore screen timeout to normal
    await restoreScreenTimeout();
    emit("done", {});
  }
}

// ============================================================
// Round 0: Initial exploration (home + tabs + scroll)
// ============================================================
async function initialExploration(
  session: AppInspectorSession,
  captureScreenshots: boolean,
  captureSnapshots: boolean,
  capturedHashes: Set<string>,
  log: (msg: string) => void,
  emit: (event: string, data: unknown) => void,
) {
  // Capture home
  const home = await captureCurrentScreen(session, captureScreenshots, captureSnapshots, capturedHashes);
  if (!home) {
    throw new Error("ホーム画面の取得に失敗しました");
  }
  log(`Home: "${home.label}"`);
  emit("screen", { screenId: home.id, label: home.label, index: home.index, screenshotPath: home.screenshotPath });

  // Scroll down for more content
  await scrollDown();
  await delay(1500);
  const scrolled = await captureCurrentScreen(session, captureScreenshots, captureSnapshots, capturedHashes);
  if (scrolled) {
    log(`Scrolled home: "${scrolled.label}"`);
    emit("screen", { screenId: scrolled.id, label: scrolled.label, index: scrolled.index, screenshotPath: scrolled.screenshotPath });
  }
  await scrollUp();
  await delay(1000);

  // Discover and press tabs from home
  const homeElements = parseSnapshotTree(home.snapshotTree);
  const tabs = homeElements.filter((el) => {
    const label = el.label.toLowerCase();
    const type = el.type.toLowerCase();
    return (label.includes("タブ:") || type === "tab" || type === "tabbar");
  });

  // Also find tab-like groups (e.g., たまポン, 行政P/商品, さいコイン)
  const tabGroups = homeElements.filter((el) => {
    const type = el.type.toLowerCase();
    return type === "group" && el.depth <= 4 && el.label.length > 0 && el.label.length < 15
      && !el.label.toLowerCase().includes("もっと見る") && !el.label.toLowerCase().includes("お知らせ");
  });

  const allTabs = [...tabs, ...tabGroups];
  const seenLabels = new Set<string>();
  const uniqueTabs = allTabs.filter((t) => {
    if (seenLabels.has(t.label)) return false;
    seenLabels.add(t.label);
    return true;
  });

  // External patterns — skip these
  const externalPatterns = [
    "電子申請", "ホームページ", "外部サイト", "ブラウザ",
    "よくある質問", "faq", "問い合わせ", "ヘルプ",
  ];

  for (const tab of uniqueTabs.slice(0, 6)) {
    const tabLabel = tab.label.toLowerCase().replace(/&#10;/g, " ");
    if (externalPatterns.some((p) => tabLabel.includes(p.toLowerCase()))) {
      log(`Skipping external tab: "${tab.label}"`);
      continue;
    }

    // Take fresh snapshot and find current ref
    const ref = await findTargetWithScroll(tab.label);
    if (!ref) {
      log(`Tab not found: "${tab.label}"`);
      continue;
    }

    log(`Pressing tab: "${tab.label}"`);
    try {
      await pressElement(ref);
    } catch {
      log(`Failed to press tab: "${tab.label}"`);
      continue;
    }
    await delay(2500);

    // Check if left the app
    const fg = await getForegroundPackage();
    if (fg && fg !== session.appPackage) {
      log(`External: "${tab.label}" -> ${fg}`);
      await goBack();
      await delay(2000);
      const fgBack = await getForegroundPackage();
      if (fgBack && fgBack !== session.appPackage) {
        await openApp(session.appPackage);
        await delay(3000);
      }
      continue;
    }

    try {
      const captured = await captureCurrentScreen(session, captureScreenshots, captureSnapshots, capturedHashes);
      if (captured) {
        log(`Tab screen: "${captured.label}"`);
        emit("screen", { screenId: captured.id, label: captured.label, index: captured.index, screenshotPath: captured.screenshotPath });
      }
    } catch (err) {
      log(`Tab capture failed: "${tab.label}" — ${err instanceof Error ? err.message : "unknown error"}`);
      // Continue to next tab instead of stopping
    }
    // Don't goBack for tabs — stay in current state
  }

  // Go back to home and capture メニュー tab if present
  await openApp(session.appPackage);
  await delay(2000);
}

// ============================================================
// Navigate to a specific target and capture
// ============================================================
async function navigateAndCapture(
  session: AppInspectorSession,
  target: UncapturedTarget,
  captureScreenshots: boolean,
  captureSnapshots: boolean,
  capturedHashes: Set<string>,
  log: (msg: string) => void,
): Promise<CapturedScreen | null> {
  // Ensure we're in the app
  const fg = await getForegroundPackage();
  if (fg && fg !== session.appPackage) {
    await openApp(session.appPackage);
    await delay(3000);
  }

  // If fromScreen is "home", go home first
  if (target.fromScreen === "home" || target.fromScreen === "ホーム") {
    await openApp(session.appPackage);
    await delay(2000);
  } else if (target.fromScreen === "menu" || target.fromScreen === "メニュー") {
    // Try pressing the menu tab
    await openApp(session.appPackage);
    await delay(2000);
    const menuRef = await findTargetWithScroll("メニュー");
    if (menuRef) {
      try { await pressElement(menuRef); } catch { /* ignore */ }
      await delay(2000);
    }
  }

  // Find and press the target
  let ref = await findTargetWithScroll(target.targetLabel);

  // If not found and we have a navigationHint, try extracting tab name from hint and navigate there first
  if (!ref && target.navigationHint) {
    const hintMatch = target.navigationHint.match(/[「」]?([^「」]+)[」]?(?:タブ|画面|メニュー)/);
    if (hintMatch) {
      const tabRef = await findTargetWithScroll(hintMatch[1]);
      if (tabRef) {
        log(`Navigating via hint: "${hintMatch[1]}"`);
        try {
          await pressElement(tabRef);
          await delay(2500);
          ref = await findTargetWithScroll(target.targetLabel);
        } catch { /* ignore */ }
      }
    }
  }

  // Still not found — try each bottom tab to see if target is there
  if (!ref) {
    const snap = await takeSnapshot(false);
    const els = parseSnapshotTree(snap);
    const bottomTabs = els.filter((e) => {
      const t = e.type.toLowerCase();
      return (t === "tab" || e.label.toLowerCase().includes("タブ:")) && e.label.length > 0;
    });
    for (const bt of bottomTabs.slice(0, 4)) {
      const btRef = findBestMatch(els, bt.label);
      if (!btRef) continue;
      try {
        await pressElement(btRef.ref);
        await delay(2000);
        ref = await findTargetWithScroll(target.targetLabel);
        if (ref) {
          log(`Found target via tab: "${bt.label}"`);
          break;
        }
      } catch { /* ignore */ }
    }
    // If still not found, go back home
    if (!ref) {
      await openApp(session.appPackage);
      await delay(2000);
    }
  }

  if (!ref) {
    log(`Target label not found: "${target.targetLabel}"`);
    return null;
  }

  try {
    await pressElement(ref);
  } catch {
    log(`Failed to press: "${target.targetLabel}"`);
    return null;
  }
  await delay(2500);

  // Check if we left the app
  const fgAfter = await getForegroundPackage();
  if (fgAfter && fgAfter !== session.appPackage) {
    log(`External navigation: "${target.featureName}" -> ${fgAfter}`);
    // Record external link
    if (session.screens.length > 0) {
      try {
        const notes = JSON.parse(session.screens[0].notes || "{}");
        if (!notes.externalLinks) notes.externalLinks = [];
        notes.externalLinks.push({
          label: target.featureName,
          type: "detected-external",
          openedApp: fgAfter,
        });
        session.screens[0].notes = JSON.stringify(notes);
      } catch { /* ignore */ }
    }
    await goBack();
    await delay(2000);
    const fgBack = await getForegroundPackage();
    if (fgBack && fgBack !== session.appPackage) {
      await openApp(session.appPackage);
      await delay(3000);
    }
    return null;
  }

  // Capture the screen
  const captured = await captureCurrentScreen(session, captureScreenshots, captureSnapshots, capturedHashes);

  // Go back
  await goBack();
  await delay(1500);
  const fgBack = await getForegroundPackage();
  if (fgBack && fgBack !== session.appPackage) {
    await openApp(session.appPackage);
    await delay(3000);
  }

  return captured;
}

// ============================================================
// Helper: Find target, scrolling if needed
// ============================================================
/** Normalize label for fuzzy matching: collapse whitespace/newline variants, lowercase */
function normalizeLabel(s: string): string {
  return s
    .replace(/&#10;/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Find best matching element from a parsed snapshot tree */
function findBestMatch(
  els: { ref: string; type: string; label: string }[],
  targetLabel: string,
): { ref: string; label: string } | null {
  const norm = normalizeLabel(targetLabel);
  if (!norm) return null;

  // 1. Exact match (after normalization)
  for (const e of els) {
    if (normalizeLabel(e.label) === norm) return e;
  }

  // 2. Element label contains target (e.g. target="チャージ", label="さいコイン チャージ")
  for (const e of els) {
    const nl = normalizeLabel(e.label);
    if (nl && nl.includes(norm)) return e;
  }

  // 3. Target contains element label (e.g. target="ごみ出しカレンダー", label="ごみ出し")
  //    Only if the element label is at least 2 chars
  for (const e of els) {
    const nl = normalizeLabel(e.label);
    if (nl.length >= 2 && norm.includes(nl)) return e;
  }

  // 4. Word overlap: check if all words in target appear in label or vice versa
  const targetWords = norm.split(/\s+/);
  for (const e of els) {
    const nl = normalizeLabel(e.label);
    const labelWords = nl.split(/\s+/);
    const allTargetInLabel = targetWords.every((w) => nl.includes(w));
    const allLabelInTarget = labelWords.every((w) => norm.includes(w));
    if (allTargetInLabel || (labelWords.length >= 2 && allLabelInTarget)) return e;
  }

  return null;
}

async function findTargetWithScroll(targetLabel: string): Promise<string | null> {
  // Attempt 1: current screen
  let snap1: string;
  try {
    snap1 = await takeSnapshot(false);
  } catch {
    return null; // Device issue, caller should handle
  }
  const els1 = parseSnapshotTree(snap1);
  const m1 = findBestMatch(els1, targetLabel);
  if (m1) return m1.ref;

  // Attempt 2: scroll down once
  try { await scrollDown(); } catch { return null; }
  await delay(1500);
  let snap2: string;
  try { snap2 = await takeSnapshot(false); } catch { return null; }
  const els2 = parseSnapshotTree(snap2);
  const m2 = findBestMatch(els2, targetLabel);
  if (m2) return m2.ref;

  // Attempt 3: scroll down again (deeper content)
  try { await scrollDown(); } catch { return null; }
  await delay(1500);
  let snap3: string;
  try { snap3 = await takeSnapshot(false); } catch { return null; }
  const els3 = parseSnapshotTree(snap3);
  const m3 = findBestMatch(els3, targetLabel);
  if (m3) return m3.ref;

  // Restore: scroll back up
  try { await scrollUp(); } catch { /* ignore */ }
  await delay(800);
  try { await scrollUp(); } catch { /* ignore */ }
  await delay(800);
  return null;
}

// ============================================================
// Helper: Capture current screen (deduplication)
// ============================================================
async function captureCurrentScreen(
  session: AppInspectorSession,
  captureScreenshots: boolean,
  captureSnapshots: boolean,
  capturedHashes: Set<string>,
): Promise<CapturedScreen | null> {
  const screenId = generateId("sc");
  const screenshotFile = `${session.id}_${screenId}.png`;

  let screenshotOk = false;
  if (captureScreenshots) {
    try {
      await takeScreenshot(join(getScreenshotsDir(), screenshotFile));
      screenshotOk = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.warn(`[captureCurrentScreen] Screenshot failed: ${msg}`);
      // Continue without screenshot — snapshot tree is more important
    }
  }

  let snapshotRaw = "";
  if (captureSnapshots) {
    try { snapshotRaw = await takeSnapshot(false); } catch { snapshotRaw = "(snapshot unavailable)"; }
  }

  if (snapshotRaw && isLockOrSystemScreen(snapshotRaw)) return null;

  if (snapshotRaw) {
    const hash = simpleHash(snapshotRaw);
    if (capturedHashes.has(hash)) return null;
    capturedHashes.add(hash);
  }

  const elements = snapshotRaw ? parseSnapshotTree(snapshotRaw) : [];
  const screen: CapturedScreen = {
    id: screenId,
    index: session.screens.length,
    screenshotPath: screenshotOk ? `/app-inspector/${screenshotFile}` : "",
    snapshotTree: snapshotRaw,
    label: detectScreenLabel(elements, session.screens.length),
    interactiveElements: countInteractive(elements),
    totalElements: elements.length,
    timestamp: new Date().toISOString(),
  };

  session.screens.push(screen);
  return screen;
}

// ============================================================
// Utility functions
// ============================================================
function detectScreenLabel(
  elements: { ref: string; type: string; label: string; depth: number }[],
  fallbackIndex: number,
): string {
  const heading = elements.find(
    (e) => e.type.toLowerCase() === "heading" || e.type.toLowerCase() === "statictext"
  );
  if (heading?.label) return heading.label.replace(/&#10;/g, " ").slice(0, 40);
  const shallowLabeled = elements.find((e) => e.depth <= 3 && e.label.length > 1 && e.label.length < 30);
  if (shallowLabeled) return shallowLabeled.label.replace(/&#10;/g, " ");
  return `Screen ${fallbackIndex + 1}`;
}

function countInteractive(elements: { type: string }[]): number {
  const types = new Set(["button", "textfield", "switch", "checkbox", "slider", "link"]);
  return elements.filter((e) => types.has(e.type.toLowerCase())).length;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLockOrSystemScreen(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (lower.includes("keyguard") || lower.includes("lockscreen")) return true;
  if (lower.includes("com.android.systemui") && lower.includes("notification")) return true;
  if (lower.includes("ロック画面") || lower.includes("スワイプしてロック解除")) return true;
  const lines = raw.split("\n").filter((l) => l.match(/@\w+\s+\[/));
  if (lines.length > 0 && lines.length < 10) {
    if (lines.filter((l) => l.includes("[Image]") || l.includes("[image]")).length / lines.length > 0.8) return true;
  }
  return false;
}

function detectNavPattern(elements: { type: string; label: string }[]): string {
  const types = elements.map((e) => e.type.toLowerCase());
  const labels = elements.map((e) => e.label.toLowerCase());
  const hasTabBar = types.some((t) => t === "tab" || t === "tabbar") || labels.some((l) => l.includes("タブ:"));
  const hasNavBar = types.some((t) => t === "navigationbar" || t === "toolbar");
  const hasDrawer = labels.some((l) => l.includes("menu") || l.includes("drawer") || l.includes("メニュー"));
  if (hasTabBar && hasNavBar) return "Tab + Navigation Bar";
  if (hasTabBar) return "Tab Navigation";
  if (hasDrawer) return "Drawer Navigation";
  if (hasNavBar) return "Navigation Bar";
  return "Simple";
}
