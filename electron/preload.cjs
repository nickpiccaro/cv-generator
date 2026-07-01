const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cvApi", {
  load: () => ipcRenderer.invoke("cv:load"),
  openJson: () => ipcRenderer.invoke("cv:open-json"),
  saveJson: (payload) => ipcRenderer.invoke("cv:save-json", payload),
  saveJsonAs: (payload) => ipcRenderer.invoke("cv:save-json-as", payload),
  exportTex: (payload) => ipcRenderer.invoke("cv:export-tex", payload),
  exportPdf: (payload) => ipcRenderer.invoke("cv:export-pdf", payload),
  revealFile: (filePath) => ipcRenderer.invoke("cv:reveal-file", filePath),
  openDataFolder: () => ipcRenderer.invoke("cv:open-data-folder"),
  getAppInfo: () => ipcRenderer.invoke("cv:get-app-info"),
  checkForUpdates: () => ipcRenderer.invoke("cv:check-for-updates"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("cv:update-status", listener);
    return () => ipcRenderer.removeListener("cv:update-status", listener);
  }
});
