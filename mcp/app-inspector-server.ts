import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import type { AppInspectorSession, CapturedScreen, ComponentCount } from "../lib/app-inspector-schema.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, "..", "data", "app-inspector-sessions");
const SCREENSHOTS_DIR = join(__dirname, "..", "public", "app-inspector");

async function ensureDirs() {
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sessionPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

async function loadSession(id: string): Promise<AppInspectorSession | null> {
  try {
    const content = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(content) as AppInspectorSession;
  } catch {
    return null;
  }
}

async function saveSession(session: AppInspectorSession): Promise<void> {
  await ensureDirs();
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
}

async function runAgentDevice(args: string[], timeoutMs = 30000): Promise<string> {
  const { stdout } = await execFileAsync("npx", ["agent-device", ...args], {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return stdout;
}

function parseSnapshotElements(raw: string): { ref: string; type: string; label: string }[] {
  const elements: { ref: string; type: string; label: string }[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/(@\w+)\s+\[(\w+(?:\s+\w+)*)\]\s*"?([^"]*)"?/);
    if (match) {
      elements.push({ ref: match[1], type: match[2], label: match[3].trim() });
    }
  }
  return elements;
}

const server = new McpServer({
  name: "app-inspector",
  version: "1.0.0",
});

// Tool 1: inspect_app — full automated capture
server.tool(
  "inspect_app",
  `Automatically open an Android app, capture screenshots and UI trees for multiple screens.
After capturing, open http://localhost:3000/app-inspector to view results.`,
  {
    appPackage: z.string().describe("Android package name (e.g. jp.saitamacity.rsa)"),
    appName: z.string().optional().describe("Human-readable app name"),
    maxScreens: z.number().min(1).max(20).default(5).describe("Number of screens to capture"),
  },
  async ({ appPackage, appName, maxScreens }) => {
    await ensureDirs();
    const now = new Date().toISOString();
    const session: AppInspectorSession = {
      id: generateId("ai"),
      appPackage,
      appName: appName || appPackage.split(".").pop() || appPackage,
      deviceName: "default",
      createdAt: now,
      updatedAt: now,
      status: "capturing",
      screens: [],
    };
    await saveSession(session);

    try {
      // Open the app
      await runAgentDevice(["open", appPackage, "--platform", "android"], 15000);
      await new Promise((r) => setTimeout(r, 2000));

      for (let i = 0; i < maxScreens; i++) {
        const screenId = generateId("sc");
        const screenshotFile = `${session.id}_${screenId}.png`;
        const screenshotFullPath = join(SCREENSHOTS_DIR, screenshotFile);

        await runAgentDevice(["screenshot", screenshotFullPath], 15000);

        let snapshotRaw = "";
        try {
          snapshotRaw = await runAgentDevice(["snapshot"], 15000);
        } catch { /* ignore */ }

        const elements = parseSnapshotElements(snapshotRaw);
        const interactiveTypes = new Set(["button", "textfield", "switch", "checkbox", "slider", "link"]);
        const interactiveCount = elements.filter((e) => interactiveTypes.has(e.type.toLowerCase())).length;
        const heading = elements.find((e) => e.type.toLowerCase() === "heading" || e.type.toLowerCase() === "statictext");

        const screen: CapturedScreen = {
          id: screenId,
          index: i,
          screenshotPath: `/app-inspector/${screenshotFile}`,
          snapshotTree: snapshotRaw,
          label: heading?.label || `Screen ${i + 1}`,
          interactiveElements: interactiveCount,
          totalElements: elements.length,
          timestamp: new Date().toISOString(),
        };
        session.screens.push(screen);
        await saveSession(session);

        // Navigate
        if (i < maxScreens - 1) {
          try {
            if (i % 2 === 0) {
              await runAgentDevice(["scroll", "down"], 10000);
            } else {
              await runAgentDevice(["back"], 5000);
            }
            await new Promise((r) => setTimeout(r, 1500));
          } catch { /* continue */ }
        }
      }

      // Summary
      const allElements = session.screens.flatMap((s) => parseSnapshotElements(s.snapshotTree));
      const typeCounts = new Map<string, number>();
      for (const el of allElements) {
        typeCounts.set(el.type.toLowerCase(), (typeCounts.get(el.type.toLowerCase()) || 0) + 1);
      }
      const componentInventory: ComponentCount[] = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      session.summary = {
        totalScreens: session.screens.length,
        uniqueScreens: session.screens.length,
        avgInteractiveElements: Math.round(session.screens.reduce((s, sc) => s + sc.interactiveElements, 0) / session.screens.length),
        navigationPattern: "Auto-detected",
        componentInventory,
      };
      session.status = "completed";
      await saveSession(session);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          sessionId: session.id,
          screens: session.screens.length,
          viewUrl: "http://localhost:3000/app-inspector",
          message: `Captured ${session.screens.length} screens from ${session.appName}`,
        }) }],
      };
    } catch (err: unknown) {
      session.status = "error";
      session.error = err instanceof Error ? err.message : "Failed";
      await saveSession(session);
      return {
        content: [{ type: "text" as const, text: `Error: ${session.error}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: list_inspections
server.tool(
  "list_inspections",
  "List all app inspection sessions",
  {},
  async () => {
    await ensureDirs();
    const files = await readdir(SESSIONS_DIR).catch(() => []);
    const sessions: { id: string; appName: string; status: string; screens: number; date: string }[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const s = JSON.parse(await readFile(join(SESSIONS_DIR, f), "utf-8")) as AppInspectorSession;
      sessions.push({ id: s.id, appName: s.appName, status: s.status, screens: s.screens.length, date: s.createdAt });
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(sessions, null, 2) }],
    };
  }
);

// Tool 3: get_screen_tree — get UI tree of a specific screen
server.tool(
  "get_screen_tree",
  "Get the accessibility tree of a captured screen for analysis",
  {
    sessionId: z.string().describe("Session ID"),
    screenIndex: z.number().describe("Screen index (0-based)"),
  },
  async ({ sessionId, screenIndex }) => {
    const session = await loadSession(sessionId);
    if (!session) return { content: [{ type: "text" as const, text: "Session not found" }], isError: true };
    const screen = session.screens[screenIndex];
    if (!screen) return { content: [{ type: "text" as const, text: "Screen not found" }], isError: true };
    return {
      content: [{ type: "text" as const, text: screen.snapshotTree }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
