import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// Since all functionality goes through Next.js HTTP API routes,
// this is kept minimal for now.
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  // Future: add native dialogs, menu actions, etc.
  send: (channel: string, data: unknown) => {
    const validChannels = ["app:quit", "app:minimize", "app:maximize"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});
