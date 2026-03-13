import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = promisify(execFile);

const AGENT_DEVICE = "npx";
const AGENT_DEVICE_ARGS = ["agent-device"];

/** Wait for ADB device to become available (up to timeoutMs) */
export async function waitForDevice(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await execFileAsync("adb", ["devices"], { timeout: 5000 });
      const { stdout } = await execFileAsync("adb", ["get-state"], { timeout: 5000 });
      if (stdout.trim() === "device") return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

/** Run a function with retry + ADB reconnection on failure */
async function runWithRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 2,
  retryDelayMs = 3000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      const isAdbError = msg.includes("device not found") || msg.includes("no devices") ||
        msg.includes("device offline") || msg.includes("closed") || msg.includes("connection reset");

      if (!isAdbError || attempt >= maxRetries) throw lastError;

      console.warn(`[ADB Retry] ${label} attempt ${attempt + 1} failed: ${lastError.message}`);
      // Try to reconnect
      try { await execFileAsync("adb", ["reconnect"], { timeout: 5000 }); } catch { /* ignore */ }
      const recovered = await waitForDevice(10000);
      if (!recovered) throw new Error(`ADB device lost during ${label}`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError || new Error(`${label} failed after retries`);
}

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
  await runWithRetry(() => run(["screenshot", filePath], 15000), "takeScreenshot");
}

export async function takeSnapshot(
  interactiveOnly = true
): Promise<string> {
  const args = ["snapshot"];
  if (interactiveOnly) args.push("-i");
  const { stdout } = await runWithRetry(() => run(args, 15000), "takeSnapshot");
  return stdout;
}

export async function pressElement(ref: string): Promise<void> {
  await runWithRetry(() => run(["press", ref], 10000), "pressElement");
}

export async function scrollDown(): Promise<void> {
  await runWithRetry(() => run(["scroll", "down"], 10000), "scrollDown");
}

export async function scrollUp(): Promise<void> {
  await runWithRetry(() => run(["scroll", "up"], 10000), "scrollUp");
}

export async function goBack(): Promise<void> {
  await runWithRetry(() => run(["back"], 5000), "goBack");
}

export async function goHome(): Promise<void> {
  await runWithRetry(() => run(["home"], 5000), "goHome");
}

/** Get the package name of the currently focused (foreground) app */
export async function getForegroundPackage(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "adb",
      ["shell", "dumpsys", "activity", "activities"],
      { timeout: 10000, maxBuffer: 2 * 1024 * 1024 }
    );
    // Look for mResumedActivity or topResumedActivity
    const match = stdout.match(/(?:mResumedActivity|topResumedActivity).*?(\w+(?:\.\w+)+)\//);
    if (match) return match[1];
    // Fallback: look for ResumedActivity
    const fallback = stdout.match(/ResumedActivity.*?(\w+(?:\.\w+)+)\//);
    return fallback ? fallback[1] : null;
  } catch {
    return null;
  }
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

/** Check if the device screen is on */
export async function isScreenOn(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "adb",
      ["shell", "dumpsys", "power"],
      { timeout: 5000, maxBuffer: 1024 * 1024 }
    );
    // mWakefulness=Awake means screen is on
    // Display Power: state=ON also works
    if (stdout.includes("mWakefulness=Awake")) return true;
    if (stdout.includes("Display Power: state=ON")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Check if the device is unlocked (keyguard not showing) */
export async function isDeviceUnlocked(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "adb",
      ["shell", "dumpsys", "window"],
      { timeout: 5000, maxBuffer: 2 * 1024 * 1024 }
    );
    // mDreamingLockscreen=false and mShowingLockscreen=false means unlocked
    // Also check: isStatusBarKeyguard=false or mOccluded=false
    if (stdout.includes("mShowingLockscreen=true")) return false;
    if (stdout.includes("mDreamingLockscreen=true")) return false;
    // On newer Android, check KeyguardController
    if (stdout.includes("KeyguardShowing=true")) return false;
    return true;
  } catch {
    return true; // Assume unlocked if check fails
  }
}

/** Wake up the device screen (press power button) */
export async function wakeDevice(): Promise<void> {
  await execFileAsync("adb", ["shell", "input", "keyevent", "KEYCODE_WAKEUP"], {
    timeout: 5000,
  });
}

/** Dismiss lock screen by swiping up (works for swipe-to-unlock, not PIN/pattern) */
export async function dismissLockScreen(): Promise<void> {
  // Send MENU keyevent to dismiss simple lock screen
  await execFileAsync("adb", ["shell", "input", "keyevent", "82"], {
    timeout: 5000,
  });
  // Also try swipe up gesture (covers swipe-to-unlock)
  await execFileAsync(
    "adb",
    ["shell", "input", "swipe", "540", "1800", "540", "400", "300"],
    { timeout: 5000 }
  );
}

export interface DeviceReadiness {
  ready: boolean;
  screenOn: boolean;
  unlocked: boolean;
  message: string;
}

/**
 * Check device readiness and attempt to wake/unlock if needed.
 * Returns status with instructions if manual intervention is required.
 */
/** Keep screen on while USB is connected + set long screen timeout */
export async function keepScreenOn(): Promise<void> {
  try {
    // svc power stayon usb — screen stays on while USB connected
    await execFileAsync("adb", ["shell", "svc", "power", "stayon", "usb"], { timeout: 5000 });
    // Set screen timeout to 30 minutes (1800000ms) as fallback
    await execFileAsync("adb", ["shell", "settings", "put", "system", "screen_off_timeout", "1800000"], { timeout: 5000 });
  } catch {
    // Best-effort; don't fail the capture if this doesn't work
  }
}

/** Restore default screen timeout (1 minute) */
export async function restoreScreenTimeout(): Promise<void> {
  try {
    await execFileAsync("adb", ["shell", "settings", "put", "system", "screen_off_timeout", "60000"], { timeout: 5000 });
    await execFileAsync("adb", ["shell", "svc", "power", "stayon", "false"], { timeout: 5000 });
  } catch { /* best-effort */ }
}

export async function ensureDeviceReady(): Promise<DeviceReadiness> {
  // Step 1: Check if screen is on
  let screenOn = await isScreenOn();
  if (!screenOn) {
    // Try to wake the device
    await wakeDevice();
    await new Promise((r) => setTimeout(r, 1000));
    screenOn = await isScreenOn();
    if (!screenOn) {
      return {
        ready: false,
        screenOn: false,
        unlocked: false,
        message: "端末の画面がOFFです。電源ボタンを押して画面を点灯してください。",
      };
    }
  }

  // Step 2: Check if device is unlocked
  let unlocked = await isDeviceUnlocked();
  if (!unlocked) {
    // Try to dismiss simple lock screen
    await dismissLockScreen();
    await new Promise((r) => setTimeout(r, 1500));
    unlocked = await isDeviceUnlocked();
    if (!unlocked) {
      return {
        ready: false,
        screenOn: true,
        unlocked: false,
        message: "端末がロックされています。ロックを解除してから再試行してください。",
      };
    }
  }

  return {
    ready: true,
    screenOn: true,
    unlocked: true,
    message: "端末は準備完了です。",
  };
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

/**
 * Start screen recording on the device.
 * Returns a handle with a stop() function that kills recording, pulls the file, and cleans up.
 */
export function startScreenRecording(outputPath: string): { stop: () => Promise<void> } {
  const devicePath = "/sdcard/capture_recording.mp4";

  // spawn adb shell screenrecord in the background
  const proc = spawn("adb", ["shell", "screenrecord", "--time-limit", "180", devicePath], {
    stdio: "ignore",
    detached: false,
  });

  // Prevent unhandled error crash if process exits unexpectedly
  proc.on("error", () => {});

  return {
    stop: async () => {
      // Kill screenrecord on device (sends SIGINT which finalizes the mp4)
      await execFileAsync("adb", ["shell", "pkill", "-INT", "screenrecord"], { timeout: 5000 }).catch(() => {});
      // Wait for the recording to finalize
      await new Promise((r) => setTimeout(r, 2000));
      // Ensure the spawn process is dead on our side
      try { proc.kill(); } catch { /* ignore */ }
      // Pull the file from the device
      await execFileAsync("adb", ["pull", devicePath, outputPath], { timeout: 30000 });
      // Clean up on device
      await execFileAsync("adb", ["shell", "rm", devicePath], { timeout: 5000 }).catch(() => {});
    },
  };
}
