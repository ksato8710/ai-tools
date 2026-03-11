import { NextResponse } from "next/server";
import { join } from "path";
import { loadSession, saveSession, getScreenshotsDir } from "@/lib/app-inspector-store";
import {
  openApp,
  takeScreenshot,
  takeSnapshot,
  parseSnapshotTree,
  scrollDown,
  goBack,
} from "@/lib/agent-device";
import { generateId } from "@/lib/app-inspector-schema";
import type { CapturedScreen, ComponentCount } from "@/lib/app-inspector-schema";

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

  try {
    // Open the app
    await openApp(session.appPackage);
    await delay(2000);

    // Capture screens
    for (let i = 0; i < maxScreens; i++) {
      const screenId = generateId("sc");
      const screenshotFile = `${session.id}_${screenId}.png`;
      const screenshotFullPath = join(getScreenshotsDir(), screenshotFile);
      const screenshotPublicPath = `/app-inspector/${screenshotFile}`;

      // Take screenshot
      await takeScreenshot(screenshotFullPath);

      // Take accessibility snapshot
      let snapshotRaw = "";
      try {
        snapshotRaw = await takeSnapshot(false);
      } catch {
        snapshotRaw = "(snapshot unavailable)";
      }

      const elements = parseSnapshotTree(snapshotRaw);
      const interactiveTypes = new Set([
        "button",
        "textfield",
        "switch",
        "checkbox",
        "slider",
        "link",
      ]);
      const interactiveCount = elements.filter((e) =>
        interactiveTypes.has(e.type.toLowerCase())
      ).length;

      // Detect screen label from heading or first text
      const heading = elements.find(
        (e) => e.type.toLowerCase() === "heading" || e.type.toLowerCase() === "statictext"
      );
      const label = heading?.label || `Screen ${i + 1}`;

      const screen: CapturedScreen = {
        id: screenId,
        index: i,
        screenshotPath: screenshotPublicPath,
        snapshotTree: snapshotRaw,
        label,
        interactiveElements: interactiveCount,
        totalElements: elements.length,
        timestamp: new Date().toISOString(),
      };

      session.screens.push(screen);
      await saveSession(session);

      // Navigate: scroll down after odd screens, go back after even
      if (i < maxScreens - 1) {
        try {
          if (i % 2 === 0) {
            await scrollDown();
          } else {
            await goBack();
          }
          await delay(1500);
        } catch {
          // Navigation failed, continue
        }
      }
    }

    // Generate summary
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
          session.screens.length
      ),
      navigationPattern: detectNavPattern(allElements),
      componentInventory,
    };
    session.status = "completed";
    await saveSession(session);

    return NextResponse.json({
      status: "completed",
      screensCount: session.screens.length,
      sessionId: session.id,
    });
  } catch (err: unknown) {
    session.status = "error";
    session.error = err instanceof Error ? err.message : "Capture failed";
    await saveSession(session);
    return NextResponse.json(
      { error: session.error, sessionId: session.id },
      { status: 500 }
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectNavPattern(
  elements: { type: string; label: string }[]
): string {
  const types = elements.map((e) => e.type.toLowerCase());
  const hasTabBar =
    types.filter((t) => t === "tab" || t === "tabbar").length > 0;
  const hasNavBar =
    types.filter((t) => t === "navigationbar" || t === "toolbar").length > 0;
  const hasDrawer =
    elements.some((e) => e.label.toLowerCase().includes("menu")) ||
    elements.some((e) => e.label.toLowerCase().includes("drawer"));

  if (hasTabBar && hasNavBar) return "Tab + Navigation Bar";
  if (hasTabBar) return "Tab Navigation";
  if (hasDrawer) return "Drawer Navigation";
  if (hasNavBar) return "Navigation Bar";
  return "Simple";
}
