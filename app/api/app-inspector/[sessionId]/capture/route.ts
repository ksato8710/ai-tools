import { NextResponse } from "next/server";
import { join } from "path";
import { loadSession, saveSession, getScreenshotsDir } from "@/lib/app-inspector-store";
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
} from "@/lib/agent-device";
import { generateId } from "@/lib/app-inspector-schema";
import type { CapturedScreen, ComponentCount } from "@/lib/app-inspector-schema";

interface TappableTarget {
  label: string;
  type: string;
  priority: number;
  isTab: boolean;
  isExternalLink: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const maxScreens = (body as { maxScreens?: number }).maxScreens || 5;
  const mode = ((body as { mode?: string }).mode || "both") as "screenshot" | "analysis" | "both";
  const captureScreenshots = mode === "screenshot" || mode === "both";
  const captureSnapshots = mode === "analysis" || mode === "both";

  // Initialize capture log
  const captureLog: string[] = [];
  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    captureLog.push(`[${ts}] ${msg}`);
  };

  try {
    // Pre-flight: Check device readiness
    const readiness = await ensureDeviceReady();
    if (!readiness.ready) {
      return NextResponse.json(
        { error: readiness.message, deviceStatus: readiness },
        { status: 400 }
      );
    }

    log("Device ready");

    // Start screen recording
    const videoFileName = `${session.id}_recording.mp4`;
    const videoFullPath = join(getScreenshotsDir(), videoFileName);
    const videoPublicPath = `/app-inspector/${videoFileName}`;
    let recorder: { stop: () => Promise<void> } | null = null;
    try {
      recorder = startScreenRecording(videoFullPath);
      log("Screen recording started");
    } catch {
      log("Screen recording failed to start (continuing without video)");
    }

    // Open the app
    await openApp(session.appPackage);
    await delay(3000);
    log(`Opened app: ${session.appPackage}`);

    const startIndex = session.screens.length;
    const capturedHashes = new Set<string>();

    // ========================================
    // Phase 1: Capture the home screen
    // ========================================
    log("Phase 1: Capturing home screen");
    const homeSnapshot = await captureCurrentScreen(
      session, captureScreenshots, captureSnapshots, startIndex, capturedHashes
    );

    if (!homeSnapshot) {
      session.status = "error";
      session.error = "ホーム画面の取得に失敗しました";
      session.captureLog = captureLog;
      await saveSession(session);
      if (recorder) await recorder.stop().catch(() => {});
      return NextResponse.json({ error: session.error }, { status: 500 });
    }

    log(`Home screen captured: ${homeSnapshot.label}`);
    await saveSession(session);

    // ========================================
    // Phase 2: Discover all tappable targets from home screen (labels only)
    // ========================================
    log("Phase 2: Discovering tappable targets");
    const homeElements = parseSnapshotTree(homeSnapshot.snapshotTree);
    const targets = discoverAllTargets(homeElements);

    // Also check if scrolling reveals more content
    await scrollDown();
    await delay(1500);
    let scrolledSnapshot: string | null = null;
    try {
      scrolledSnapshot = await takeSnapshot(false);
    } catch { /* ignore */ }

    if (scrolledSnapshot) {
      const scrolledElements = parseSnapshotTree(scrolledSnapshot);
      const moreTargets = discoverAllTargets(scrolledElements);
      // Add targets not already found (deduplicate by label)
      const existingLabels = new Set(targets.map((t) => t.label));
      for (const t of moreTargets) {
        if (!existingLabels.has(t.label)) {
          targets.push(t);
          existingLabels.add(t.label);
        }
      }

      // Capture scrolled home if it's different
      const scrollHash = simpleHash(scrolledSnapshot);
      if (!capturedHashes.has(scrollHash)) {
        capturedHashes.add(scrollHash);
        const screenId = generateId("sc");
        const screenshotFile = `${session.id}_${screenId}.png`;
        if (captureScreenshots) {
          await takeScreenshot(join(getScreenshotsDir(), screenshotFile));
        }
        const elements = parseSnapshotTree(scrolledSnapshot);
        session.screens.push({
          id: screenId,
          index: session.screens.length,
          screenshotPath: captureScreenshots ? `/app-inspector/${screenshotFile}` : "",
          snapshotTree: scrolledSnapshot,
          label: detectScreenLabel(elements, session.screens.length),
          interactiveElements: countInteractive(elements),
          totalElements: elements.length,
          timestamp: new Date().toISOString(),
        });
        log("Scrolled home screen captured");
        await saveSession(session);
      }
    }

    // Go back to top of home screen
    await scrollUp();
    await delay(1000);

    // Sort: tabs first, then features, then others
    targets.sort((a, b) => b.priority - a.priority);

    log(`Discovered ${targets.length} tappable targets`);

    // ========================================
    // Phase 3: Systematically explore each target (fresh ref lookup)
    // ========================================
    log("Phase 3: Exploring targets");
    // Separate internal targets from likely-external ones
    const internalTargets = targets.filter((t) => !t.isExternalLink);
    const externalTargets = targets.filter((t) => t.isExternalLink);

    // Store external links in session metadata
    if (externalTargets.length > 0) {
      const externalLinks = externalTargets.map((t) => ({
        label: t.label.replace(/&#10;/g, " "),
        type: t.type,
      }));
      // Store as notes on the home screen
      if (session.screens.length > 0) {
        session.screens[0].notes = JSON.stringify({
          externalLinks,
          message: `${externalLinks.length}件の外部リンクを検出`,
        });
        await saveSession(session);
      }
    }

    let screensRemaining = maxScreens - session.screens.length + startIndex;

    for (const target of internalTargets) {
      if (screensRemaining <= 0) break;

      // Check device readiness
      const midCheck = await ensureDeviceReady();
      if (!midCheck.ready) {
        session.status = "error";
        session.error = `端末がロックされました（${session.screens.length}画面取得済み）`;
        session.captureLog = captureLog;
        await saveSession(session);
        if (recorder) await recorder.stop().catch(() => {});
        return NextResponse.json({ error: session.error }, { status: 400 });
      }

      // Ensure we're on the home screen of the target app
      const fg = await getForegroundPackage();
      if (fg && fg !== session.appPackage) {
        await openApp(session.appPackage);
        await delay(3000);
      }

      // Take a fresh snapshot and find the element by label match
      let freshRef: string | null = null;
      try {
        const freshSnapshot = await takeSnapshot(false);
        const freshElements = parseSnapshotTree(freshSnapshot);
        const match = freshElements.find((e) => e.label === target.label);
        if (!match) {
          log(`Target not found on screen: "${target.label}" — skipping`);
          continue; // Element not on current screen
        }
        freshRef = match.ref;
      } catch {
        log(`Failed to take fresh snapshot for target: "${target.label}" — skipping`);
        continue;
      }

      // Press the target element using the fresh ref
      log(`Pressing: "${target.label}" (ref: ${freshRef})`);
      try {
        await pressElement(freshRef);
      } catch {
        log(`Failed to press: "${target.label}"`);
        continue;
      }
      await delay(2500);

      // Check if we left the app (external link)
      const fgAfter = await getForegroundPackage();
      if (fgAfter && fgAfter !== session.appPackage) {
        log(`External navigation detected: "${target.label}" -> ${fgAfter}`);
        // This was an external link — record it and go back
        if (session.screens.length > 0 && !session.screens[0].notes?.includes(target.label)) {
          try {
            const notes = JSON.parse(session.screens[0].notes || "{}");
            if (!notes.externalLinks) notes.externalLinks = [];
            notes.externalLinks.push({
              label: target.label.replace(/&#10;/g, " "),
              type: "detected-external",
              openedApp: fgAfter,
            });
            notes.message = `${notes.externalLinks.length}件の外部リンクを検出`;
            session.screens[0].notes = JSON.stringify(notes);
            await saveSession(session);
          } catch { /* ignore */ }
        }

        // Return to our app
        await goBack();
        await delay(2000);
        const fgCheck = await getForegroundPackage();
        if (fgCheck && fgCheck !== session.appPackage) {
          await openApp(session.appPackage);
          await delay(3000);
        }
        continue;
      }

      // Capture the new screen
      const captured = await captureCurrentScreen(
        session, captureScreenshots, captureSnapshots,
        session.screens.length, capturedHashes
      );

      if (captured) {
        log(`Captured screen: "${captured.label}"`);
        await saveSession(session);
        screensRemaining--;

        // If this is a tab, also scroll down to capture more content
        if (target.isTab && screensRemaining > 0) {
          await scrollDown();
          await delay(1500);
          const scrollCapture = await captureCurrentScreen(
            session, captureScreenshots, captureSnapshots,
            session.screens.length, capturedHashes
          );
          if (scrollCapture) {
            log(`Captured scrolled tab screen: "${scrollCapture.label}"`);
            await saveSession(session);
            screensRemaining--;
          }
        }
      } else {
        log(`Screen after pressing "${target.label}" was duplicate or invalid`);
      }

      // Go back to home screen
      await goBack();
      await delay(1500);

      // Verify we're back in the app
      const fgBack = await getForegroundPackage();
      if (fgBack && fgBack !== session.appPackage) {
        await openApp(session.appPackage);
        await delay(3000);
      }
    }

    // Stop screen recording
    if (recorder) {
      try {
        await recorder.stop();
        session.videoPath = videoPublicPath;
        log("Screen recording saved");
      } catch {
        log("Failed to save screen recording");
      }
    }

    // ========================================
    // Phase 4: Generate summary
    // ========================================
    log("Phase 4: Generating summary");
    const allElements = session.screens.flatMap((s) =>
      parseSnapshotTree(s.snapshotTree)
    );
    const typeCounts = new Map<string, number>();
    for (const el of allElements) {
      const t = el.type.toLowerCase();
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    const componentInventory: ComponentCount[] = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    session.summary = {
      totalScreens: session.screens.length,
      uniqueScreens: session.screens.length,
      avgInteractiveElements: Math.round(
        session.screens.reduce((sum, s) => sum + s.interactiveElements, 0) /
          Math.max(session.screens.length, 1)
      ),
      navigationPattern: detectNavPattern(allElements),
      componentInventory,
    };
    session.status = "completed";
    session.captureLog = captureLog;
    log(`Capture completed: ${session.screens.length} screens`);
    await saveSession(session);

    return NextResponse.json({
      status: "completed",
      screensCount: session.screens.length,
      sessionId: session.id,
      externalLinks: externalTargets.map((t) => t.label.replace(/&#10;/g, " ")),
    });
  } catch (err: unknown) {
    session.status = "error";
    session.error = err instanceof Error ? err.message : "Capture failed";
    session.captureLog = captureLog;
    await saveSession(session);
    return NextResponse.json(
      { error: session.error, sessionId: session.id },
      { status: 500 }
    );
  }
}

// ============================================================
// Helper functions
// ============================================================

/** Capture the current screen and add to session if unique */
async function captureCurrentScreen(
  session: { id: string; screens: CapturedScreen[] },
  captureScreenshots: boolean,
  captureSnapshots: boolean,
  index: number,
  capturedHashes: Set<string>,
): Promise<CapturedScreen | null> {
  const screenId = generateId("sc");
  const screenshotFile = `${session.id}_${screenId}.png`;
  const screenshotFullPath = join(getScreenshotsDir(), screenshotFile);
  const screenshotPublicPath = `/app-inspector/${screenshotFile}`;

  if (captureScreenshots) {
    await takeScreenshot(screenshotFullPath);
  }

  let snapshotRaw = "";
  if (captureSnapshots) {
    try {
      snapshotRaw = await takeSnapshot(false);
    } catch {
      snapshotRaw = "(snapshot unavailable)";
    }
  }

  // Check for lock/system screen
  if (snapshotRaw && isLockOrSystemScreen(snapshotRaw)) {
    return null;
  }

  // Check for duplicates
  if (snapshotRaw) {
    const hash = simpleHash(snapshotRaw);
    if (capturedHashes.has(hash)) {
      return null; // Duplicate
    }
    capturedHashes.add(hash);
  }

  const elements = snapshotRaw ? parseSnapshotTree(snapshotRaw) : [];

  const screen: CapturedScreen = {
    id: screenId,
    index,
    screenshotPath: captureScreenshots ? screenshotPublicPath : "",
    snapshotTree: snapshotRaw,
    label: detectScreenLabel(elements, index),
    interactiveElements: countInteractive(elements),
    totalElements: elements.length,
    timestamp: new Date().toISOString(),
  };

  session.screens.push(screen);
  return screen;
}

/** Discover all tappable elements from a snapshot tree (labels only, no refs) */
function discoverAllTargets(
  elements: { ref: string; type: string; label: string; depth: number }[],
): TappableTarget[] {
  const targets: TappableTarget[] = [];

  // Known external link patterns
  const externalPatterns = [
    "電子申請", "ホームページ", "外部サイト", "ブラウザ",
    "webサイト", "web site", "外部リンク",
  ];

  for (const el of elements) {
    if (!el.label || el.label.length === 0) continue;
    const type = el.type.toLowerCase();
    const label = el.label.toLowerCase().replace(/&#10;/g, " ");

    // Skip non-interactive container groups at depth 0-2 (usually structural)
    if (type === "group" && el.depth < 2 && !label.includes("タブ") && !label.includes("もっと")) continue;
    // Skip scroll-area
    if (type === "scroll-area") continue;

    let priority = 0;
    let isTab = false;
    let isExternalLink = false;

    // Tabs (highest priority)
    if (label.includes("タブ:") || type === "tab" || type === "tabbar") {
      priority = 100;
      isTab = true;
    }
    // Tab-like groups at the top (e.g., "たまポン", "行政P/商品券", "さいコイン")
    else if (type === "group" && el.depth <= 4 && el.label.length < 15 &&
             !label.includes("もっと見る") && !label.includes("お知らせ")) {
      priority = 95;
      isTab = true;
    }
    // Feature menu items (images with labels)
    else if (type === "image" && el.label.length > 1 && el.label.length < 30) {
      isExternalLink = externalPatterns.some((p) => label.includes(p.toLowerCase()));
      priority = isExternalLink ? 20 : 70;
    }
    // Labeled buttons
    else if (type === "button" && el.label.length > 1) {
      priority = 60;
    }
    // "もっと見る" links
    else if (label.includes("もっと見る") || label.includes("more")) {
      priority = 50;
    }
    // Other labeled groups that might be tappable
    else if (type === "group" && el.label.length > 1 && el.label.length < 25) {
      priority = 25;
    }
    else {
      continue; // Skip unlabeled or irrelevant elements
    }

    targets.push({
      label: el.label,
      type: el.type,
      priority,
      isTab,
      isExternalLink,
    });
  }

  return targets;
}

function detectScreenLabel(
  elements: { ref: string; type: string; label: string; depth: number }[],
  fallbackIndex: number,
): string {
  const heading = elements.find(
    (e) => e.type.toLowerCase() === "heading" || e.type.toLowerCase() === "statictext"
  );
  if (heading?.label) return heading.label.replace(/&#10;/g, " ").slice(0, 40);

  const shallowLabeled = elements.find(
    (e) => e.depth <= 3 && e.label.length > 1 && e.label.length < 30
  );
  if (shallowLabeled) return shallowLabeled.label.replace(/&#10;/g, " ");

  return `Screen ${fallbackIndex + 1}`;
}

function countInteractive(
  elements: { type: string }[],
): number {
  const interactiveTypes = new Set(["button", "textfield", "switch", "checkbox", "slider", "link"]);
  return elements.filter((e) => interactiveTypes.has(e.type.toLowerCase())).length;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLockOrSystemScreen(snapshotRaw: string): boolean {
  const lower = snapshotRaw.toLowerCase();
  if (lower.includes("keyguard") || lower.includes("lockscreen")) return true;
  if (lower.includes("com.android.systemui") && lower.includes("notification")) return true;
  if (lower.includes("ロック画面") || lower.includes("スワイプしてロック解除")) return true;

  const lines = snapshotRaw.split("\n").filter((l) => l.match(/@\w+\s+\[/));
  if (lines.length > 0 && lines.length < 10) {
    const imageCount = lines.filter((l) => l.includes("[Image]") || l.includes("[image]")).length;
    const ratio = imageCount / lines.length;
    if (ratio > 0.8) return true;
  }

  return false;
}

function detectNavPattern(
  elements: { type: string; label: string }[]
): string {
  const types = elements.map((e) => e.type.toLowerCase());
  const labels = elements.map((e) => e.label.toLowerCase());
  const hasTabBar =
    types.some((t) => t === "tab" || t === "tabbar") ||
    labels.some((l) => l.includes("タブ:"));
  const hasNavBar =
    types.some((t) => t === "navigationbar" || t === "toolbar");
  const hasDrawer =
    labels.some((l) => l.includes("menu") || l.includes("drawer") || l.includes("メニュー"));

  if (hasTabBar && hasNavBar) return "Tab + Navigation Bar";
  if (hasTabBar) return "Tab Navigation";
  if (hasDrawer) return "Drawer Navigation";
  if (hasNavBar) return "Navigation Bar";
  return "Simple";
}
