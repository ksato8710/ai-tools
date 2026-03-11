import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = promisify(execFile);

const AGENT_DEVICE = "npx";
const AGENT_DEVICE_ARGS = ["agent-device"];

async function run(
  args: string[],
  timeoutMs = 30000
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(AGENT_DEVICE, [...AGENT_DEVICE_ARGS, ...args], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return result;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `agent-device ${args.join(" ")} failed: ${e.stderr || e.message}`
    );
  }
}

export async function listDevices(): Promise<
  { name: string; platform: string; serial?: string; status: string }[]
> {
  try {
    const { stdout } = await run(["devices", "--json"]);
    const data = JSON.parse(stdout);
    return Array.isArray(data) ? data : data.devices || [];
  } catch {
    return [];
  }
}

export async function openApp(packageName: string): Promise<string> {
  const { stdout } = await run(["open", packageName, "--platform", "android"], 15000);
  return stdout.trim();
}

export async function takeScreenshot(filePath: string): Promise<void> {
  await run(["screenshot", filePath], 15000);
}

export async function takeSnapshot(
  interactiveOnly = true
): Promise<string> {
  const args = ["snapshot"];
  if (interactiveOnly) args.push("-i");
  const { stdout } = await run(args, 15000);
  return stdout;
}

export async function pressElement(ref: string): Promise<void> {
  await run(["press", ref], 10000);
}

export async function scrollDown(): Promise<void> {
  await run(["scroll", "down"], 10000);
}

export async function goBack(): Promise<void> {
  await run(["back"], 5000);
}

export async function goHome(): Promise<void> {
  await run(["home"], 5000);
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
}

export async function listInstalledApps(
  userOnly = true
): Promise<InstalledApp[]> {
  try {
    const scriptPath = join(__dirname, "..", "scripts", "list-android-apps.py");
    const pythonBin = "/tmp/apk-tools/bin/python3";
    const args = [scriptPath];
    if (!userOnly) args.push("--all");

    const { stdout } = await execFileAsync(pythonBin, args, {
      timeout: 300000, // 5 min — APK pull can be slow
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout) as InstalledApp[];
  } catch {
    // Fallback: package names only (fast, no androguard)
    return listInstalledAppsFast(userOnly);
  }
}

async function listInstalledAppsFast(
  userOnly: boolean
): Promise<InstalledApp[]> {
  try {
    const userArgs = ["shell", "pm", "list", "packages", "-3"];
    const { stdout: userOut } = await execFileAsync("adb", userArgs, {
      timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
    });
    const userPkgs = new Set(
      userOut
        .split("\n")
        .map((l) => l.replace("package:", "").trim())
        .filter(Boolean)
    );

    if (userOnly) {
      return Array.from(userPkgs)
        .sort()
        .map((packageName) => ({ packageName, appName: packageName, isSystemApp: false }));
    }

    const { stdout: allOut } = await execFileAsync(
      "adb",
      ["shell", "pm", "list", "packages"],
      { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
    );
    return allOut
      .split("\n")
      .map((l) => l.replace("package:", "").trim())
      .filter(Boolean)
      .sort()
      .map((packageName) => ({
        packageName,
        appName: packageName,
        isSystemApp: !userPkgs.has(packageName),
      }));
  } catch {
    return [];
  }
}

export function parseSnapshotTree(
  raw: string
): { ref: string; type: string; label: string; depth: number }[] {
  const elements: { ref: string; type: string; label: string; depth: number }[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\s*)(@\w+)\s+\[(\w+(?:\s+\w+)*)\]\s*"?([^"]*)"?/);
    if (match) {
      elements.push({
        ref: match[2],
        type: match[3],
        label: match[4].trim(),
        depth: Math.floor(match[1].length / 2),
      });
    }
  }
  return elements;
}
