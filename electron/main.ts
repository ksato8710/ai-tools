import { app, BrowserWindow, shell, dialog } from "electron";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as net from "net";

// ── Globals ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;
let serverPort = 0;

const isDev = !app.isPackaged;
const appDir = isDev
  ? path.resolve(__dirname, "..")
  : path.join(process.resourcesPath, "app");

// ── PATH fix for macOS GUI apps ──────────────────────────────────────────────
// Apps launched from Finder / Dock don't inherit the user's shell PATH.
function fixPath() {
  const home = process.env.HOME || "";
  const extra = [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    `${home}/.local/bin`,
    `${home}/Library/Android/sdk/platform-tools`, // adb
    `${home}/whisper.cpp/build/bin`,              // whisper-cli
  ];
  process.env.PATH = extra.join(":") + ":" + (process.env.PATH || "");
}

// ── Free port finder ─────────────────────────────────────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr !== "string") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not get port"));
      }
    });
    srv.on("error", reject);
  });
}

// ── Wait for server ──────────────────────────────────────────────────────────
function waitForServer(port: number, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server did not start within ${timeoutMs}ms`));
      }
      const socket = net.createConnection({ port, host: "127.0.0.1" }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        setTimeout(check, 300);
      });
    };
    check();
  });
}

// ── Start Next.js ────────────────────────────────────────────────────────────
function startNextServer(port: number): ChildProcess {
  // Set CWD so that process.cwd() in Next.js API routes resolves correctly
  process.chdir(appDir);

  const cmd = isDev ? "dev" : "start";
  const nextBin = path.join(appDir, "node_modules", ".bin", "next");

  console.log(`[electron] Starting Next.js: ${nextBin} ${cmd} --port ${port} (cwd: ${appDir})`);

  const child = spawn(nextBin, [cmd, "--port", String(port)], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      // Don't pass ANTHROPIC_API_KEY to Next.js; let claude CLI use its own auth
      ANTHROPIC_API_KEY: undefined,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    process.stdout.write(`[next] ${msg}`);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    // Filter out noisy dev warnings
    if (!msg.includes("ExperimentalWarning")) {
      process.stderr.write(`[next:err] ${msg}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`[electron] Next.js process exited with code ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("Server Error", `Next.js server exited unexpectedly (code ${code}).`);
      app.quit();
    }
  });

  return child;
}

// ── Create window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) {
    console.log("[electron] Killing Next.js server...");
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
});

app.on("activate", () => {
  if (mainWindow === null && serverPort > 0) {
    createWindow();
  }
});

// ── Main ─────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  fixPath();

  try {
    serverPort = await getFreePort();
    console.log(`[electron] Using port ${serverPort}`);

    nextProcess = startNextServer(serverPort);

    console.log("[electron] Waiting for Next.js server...");
    await waitForServer(serverPort);
    console.log("[electron] Next.js server ready!");

    createWindow();
  } catch (err) {
    console.error("[electron] Failed to start:", err);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start AI Tools server:\n${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
  }
});
