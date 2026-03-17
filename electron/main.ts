import { app, BrowserWindow, shell, dialog, Menu } from "electron";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as net from "net";

// ── Globals ──────────────────────────────────────────────────────────────────
const windows = new Set<BrowserWindow>();
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
    if (windows.size > 0) {
      dialog.showErrorBox("Server Error", `Next.js server exited unexpectedly (code ${code}).`);
      app.quit();
    }
  });

  return child;
}

// ── Create window ────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
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

  windows.add(win);
  win.loadURL(`http://localhost:${serverPort}`);

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  win.on("closed", () => {
    windows.delete(win);
  });

  return win;
}

// ── Menu ─────────────────────────────────────────────────────────────────────
function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            if (serverPort > 0) createWindow();
          },
        },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.on("window-all-closed", () => {
  // On macOS, keep app running even if all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextProcess) {
    console.log("[electron] Killing Next.js server...");
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
});

app.on("activate", () => {
  // Re-create a window if Dock icon is clicked and no windows are open
  if (windows.size === 0 && serverPort > 0) {
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
    setupMenu();
  } catch (err) {
    console.error("[electron] Failed to start:", err);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start AI Tools server:\n${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
  }
});
