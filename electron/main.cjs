const { app, BrowserWindow, dialog, ipcMain, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const defaultFileName = "cv-data.json";
const updatePreferencesFileName = "update-preferences.json";
const updateCheckIntervalMs = 12 * 60 * 60 * 1000;
const updateIgnoreMs = 30 * 24 * 60 * 60 * 1000;
const fallbackRepository = { owner: "nickpiccaro", repo: "cv-generator" };

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function getDefaultJsonPath() {
  return path.join(app.getPath("userData"), defaultFileName);
}

function getUpdatePreferencesPath() {
  return path.join(app.getPath("userData"), updatePreferencesFileName);
}

function getSamplePath() {
  return path.join(app.getAppPath(), "src", "data", "sample-cv.json");
}

function getBuildInfoPath() {
  return path.join(app.getAppPath(), "electron", "build-info.json");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  try {
    return fs.existsSync(filePath) ? readJson(filePath) : fallback;
  } catch {
    return fallback;
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertJsonPath(filePath) {
  if (!filePath) return;
  if (typeof filePath !== "string" || path.extname(filePath).toLowerCase() !== ".json") {
    throw new Error("Only JSON files can be used for CV data.");
  }
}

function findCommand(candidates) {
  const pathParts = [
    ...(process.env.PATH || "").split(path.delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/Library/TeX/texbin"
  ];
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const command of candidates) {
    for (const dir of [...new Set(pathParts.filter(Boolean))]) {
      for (const ext of exts) {
        const fullPath = path.join(dir, command + ext);
        if (fs.existsSync(fullPath)) return fullPath;
      }
    }
  }
  return null;
}

function getPackageJson() {
  return readJsonIfExists(path.join(app.getAppPath(), "package.json"), {});
}

function getBuildInfo() {
  return readJsonIfExists(getBuildInfoPath(), {
    version: app.getVersion(),
    gitCommit: "development",
    builtAt: "development"
  });
}

function getRepositoryInfo() {
  const packageJson = getPackageJson();
  const publish = packageJson.build?.publish;
  const publishConfig = Array.isArray(publish) ? publish[0] : publish;
  if (publishConfig?.owner && publishConfig?.repo) {
    return { owner: publishConfig.owner, repo: publishConfig.repo };
  }

  const repositoryUrl = typeof packageJson.repository === "string"
    ? packageJson.repository
    : packageJson.repository?.url;
  const match = repositoryUrl?.match(/github\.com[:/](?<owner>[^/\s]+)\/(?<repo>[^/\s.]+)(?:\.git)?/i);
  if (match?.groups) {
    return { owner: match.groups.owner, repo: match.groups.repo };
  }

  return fallbackRepository;
}

function getReleaseUrl() {
  const { owner, repo } = getRepositoryInfo();
  return `https://github.com/${owner}/${repo}/releases/latest`;
}

function normalizeVersion(value) {
  return safeString(value).trim().replace(/^v/i, "").split(/[+-]/)[0];
}

function compareVersions(left, right) {
  const a = normalizeVersion(left).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = normalizeVersion(right).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

function readUpdatePreferences() {
  return readJsonIfExists(getUpdatePreferencesPath(), {});
}

function writeUpdatePreferences(prefs) {
  writeText(getUpdatePreferencesPath(), JSON.stringify(prefs, null, 2));
}

function shouldSkipUpdateCheck(force) {
  if (force) return false;
  const prefs = readUpdatePreferences();
  const now = Date.now();
  if (Number(prefs.ignoreUntil) > now) return true;
  if (Number(prefs.lastCheckedAt) && now - Number(prefs.lastCheckedAt) < updateCheckIntervalMs) return true;
  return false;
}

function markUpdateChecked() {
  writeUpdatePreferences({ ...readUpdatePreferences(), lastCheckedAt: Date.now() });
}

function ignoreUpdatesForThirtyDays(updateKey) {
  writeUpdatePreferences({
    ...readUpdatePreferences(),
    ignoredUpdate: updateKey,
    ignoreUntil: Date.now() + updateIgnoreMs
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "academic-cv-generator-update-check"
    }
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${url}`);
  return await response.json();
}

async function getGitHubUpdateMetadata() {
  const { owner, repo } = getRepositoryInfo();
  const currentVersion = app.getVersion();
  const buildInfo = getBuildInfo();
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const packageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`;
  const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/main`;

  const [releaseResult, packageResult, commitResult] = await Promise.allSettled([
    fetchJson(releaseUrl),
    fetchJson(packageUrl),
    fetchJson(commitUrl)
  ]);

  const release = releaseResult.status === "fulfilled" ? releaseResult.value : undefined;
  const mainPackage = packageResult.status === "fulfilled" ? packageResult.value : undefined;
  const mainCommit = commitResult.status === "fulfilled" ? commitResult.value : undefined;
  if (!release && !mainPackage && !mainCommit) {
    throw new Error("No GitHub release, version, or commit metadata could be read.");
  }

  const latestReleaseVersion = normalizeVersion(release?.tag_name);
  const mainVersion = normalizeVersion(mainPackage?.version);
  const mainSha = safeString(mainCommit?.sha);

  if (latestReleaseVersion && compareVersions(latestReleaseVersion, currentVersion) > 0) {
    return {
      available: true,
      source: "GitHub release",
      version: latestReleaseVersion,
      url: release?.html_url || getReleaseUrl(),
      notes: safeString(release?.body)
    };
  }

  if (mainVersion && compareVersions(mainVersion, currentVersion) > 0) {
    return {
      available: true,
      source: "main branch version",
      version: mainVersion,
      url: getReleaseUrl()
    };
  }

  if (
    mainSha &&
    safeString(buildInfo.gitCommit) &&
    buildInfo.gitCommit !== "development" &&
    !mainSha.startsWith(buildInfo.gitCommit)
  ) {
    return {
      available: true,
      source: "main branch commit",
      version: currentVersion,
      commit: mainSha.slice(0, 12),
      url: getReleaseUrl()
    };
  }

  return {
    available: false,
    version: currentVersion,
    checkedRelease: latestReleaseVersion,
    checkedMain: mainVersion
  };
}

async function promptForUpdate(win, update, canAutoInstall) {
  const versionLabel = update.version ? `Version ${update.version}` : "A newer build";
  const detailParts = [
    `${versionLabel} is available from ${update.source || "GitHub"}.`,
    "Your CV data stays on this computer. Updating downloads only the signed app release from GitHub.",
    canAutoInstall ? "Choose Update now to download it in the background." : "Choose Update now to open the official GitHub release page."
  ];

  const result = await dialog.showMessageBox(win, {
    type: "info",
    title: "Update available",
    message: "Academic CV Generator can be updated.",
    detail: detailParts.join("\n\n"),
    buttons: ["Update now", "Remind me in 30 days", "Skip"],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  if (result.response === 1) {
    ignoreUpdatesForThirtyDays(update.version || update.commit || "latest");
    return "ignored";
  }
  if (result.response !== 0) return "skipped";

  if (canAutoInstall) {
    await autoUpdater.downloadUpdate();
  } else {
    await shell.openExternal(update.url || getReleaseUrl());
  }
  return "accepted";
}

function sendUpdateStatus(win, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("cv:update-status", payload);
}

async function runFallbackUpdateCheck(win, force = false) {
  if (shouldSkipUpdateCheck(force)) {
    return { ok: true, skipped: true, message: "Update check skipped due to recent check or 30-day reminder preference." };
  }

  try {
    const update = await getGitHubUpdateMetadata();
    markUpdateChecked();
    if (!update.available) {
      return { ok: true, available: false, message: "Academic CV Generator is up to date." };
    }

    const action = await promptForUpdate(win, update, false);
    return {
      ok: true,
      available: true,
      action,
      message: action === "accepted" ? "Opened the official GitHub release page." : "Update prompt closed."
    };
  } catch (error) {
    markUpdateChecked();
    return { ok: false, message: `Update check failed: ${error.message}` };
  }
}

async function checkForUpdates(win, force = false) {
  if (shouldSkipUpdateCheck(force)) {
    return { ok: true, skipped: true, message: "Update check skipped due to recent check or 30-day reminder preference." };
  }

  if (!app.isPackaged) {
    return await runFallbackUpdateCheck(win, force);
  }

  try {
    markUpdateChecked();
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, message: result ? "Checked GitHub Releases for updates." : "No update provider returned a result." };
  } catch (error) {
    return await runFallbackUpdateCheck(win, true);
  }
}

function hardenSession() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith("file://")) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
          ]
        }
      });
      return;
    }
    callback({ responseHeaders: details.responseHeaders });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    title: "Academic CV Generator",
    backgroundColor: "#f7f3ec",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
      spellcheck: false
    }
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.ELECTRON_START_URL;
    const allowedUrl = devUrl || `file://${path.join(app.getAppPath(), "dist", "index.html")}`;
    if (!url.startsWith(allowedUrl)) {
      event.preventDefault();
      if (/^https:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url);
    }
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  win.webContents.once("did-finish-load", () => {
    checkForUpdates(win).then((result) => sendUpdateStatus(win, result));
  });

  return win;
}

app.setAppUserModelId("com.nickpiccaro.cvgenerator");

app.whenReady().then(() => {
  hardenSession();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

autoUpdater.on("update-available", async (info) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  sendUpdateStatus(win, { ok: true, available: true, message: `Version ${info.version} is available.` });
  await promptForUpdate(win, { source: "GitHub release", version: info.version, url: getReleaseUrl() }, true);
});

autoUpdater.on("update-not-available", () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  sendUpdateStatus(win, { ok: true, available: false, message: "Academic CV Generator is up to date." });
});

autoUpdater.on("update-downloaded", async (info) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  sendUpdateStatus(win, { ok: true, available: true, downloaded: true, message: `Version ${info.version} is ready to install.` });
  const result = await dialog.showMessageBox(win, {
    type: "info",
    title: "Update ready",
    message: "The update has downloaded.",
    detail: "Restart Academic CV Generator to finish installing the signed update.",
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (result.response === 0) autoUpdater.quitAndInstall(false, true);
});

autoUpdater.on("error", (error) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  sendUpdateStatus(win, { ok: false, message: `Update error: ${error.message}` });
});

ipcMain.handle("cv:load", () => {
  const defaultPath = getDefaultJsonPath();
  if (fs.existsSync(defaultPath)) {
    return { data: readJson(defaultPath), filePath: defaultPath };
  }
  const data = readJson(getSamplePath());
  writeText(defaultPath, JSON.stringify(data, null, 2));
  return { data, filePath: defaultPath };
});

ipcMain.handle("cv:open-json", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open CV JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const filePath = result.filePaths[0];
  assertJsonPath(filePath);
  return { data: readJson(filePath), filePath };
});

ipcMain.handle("cv:save-json", async (_event, payload) => {
  assertPlainObject(payload, "Save payload");
  assertPlainObject(payload.data, "CV data");
  assertJsonPath(payload.filePath);
  const filePath = payload.filePath || getDefaultJsonPath();
  writeText(filePath, JSON.stringify(payload.data, null, 2));
  return { filePath };
});

ipcMain.handle("cv:save-json-as", async (_event, payload) => {
  assertPlainObject(payload, "Save payload");
  assertPlainObject(payload.data, "CV data");
  assertJsonPath(payload.filePath);
  const result = await dialog.showSaveDialog({
    title: "Save CV JSON",
    defaultPath: payload.filePath || getDefaultJsonPath(),
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  assertJsonPath(result.filePath);
  writeText(result.filePath, JSON.stringify(payload.data, null, 2));
  return { filePath: result.filePath };
});

ipcMain.handle("cv:export-tex", async (_event, payload) => {
  assertPlainObject(payload, "Export payload");
  const tex = safeString(payload.tex);
  const result = await dialog.showSaveDialog({
    title: "Export LaTeX",
    defaultPath: "academic-cv.tex",
    filters: [{ name: "LaTeX", extensions: ["tex"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  writeText(result.filePath, tex);
  return { filePath: result.filePath };
});

ipcMain.handle("cv:export-pdf", async (_event, payload) => {
  assertPlainObject(payload, "Export payload");
  const tex = safeString(payload.tex);
  const result = await dialog.showSaveDialog({
    title: "Export PDF",
    defaultPath: "academic-cv.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const texPath = result.filePath.replace(/\.pdf$/i, ".tex");
  writeText(texPath, tex);

  const tectonic = findCommand(["tectonic"]);
  const xelatex = findCommand(["xelatex"]);
  const lualatex = findCommand(["lualatex"]);
  const engine = tectonic || xelatex || lualatex;
  if (!engine) {
    return {
      filePath: result.filePath,
      texPath,
      ok: false,
      message: "No compatible TeX engine was found. Install Tectonic, XeLaTeX, or LuaLaTeX, then export PDF again."
    };
  }

  const args = tectonic
    ? ["--outdir", path.dirname(result.filePath), texPath]
    : ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(result.filePath)}`, texPath];

  return await new Promise((resolve) => {
    execFile(engine, args, { cwd: path.dirname(texPath) }, (error, stdout, stderr) => {
      const generatedPath = path.join(path.dirname(result.filePath), path.basename(texPath, ".tex") + ".pdf");
      if (!error && generatedPath !== result.filePath && fs.existsSync(generatedPath)) {
        fs.copyFileSync(generatedPath, result.filePath);
      }
      resolve({
        ok: !error && fs.existsSync(result.filePath),
        filePath: result.filePath,
        texPath,
        message: error ? `${stdout}\n${stderr}`.trim() : "PDF exported."
      });
    });
  });
});

ipcMain.handle("cv:reveal-file", (_event, filePath) => {
  if (typeof filePath === "string" && filePath) shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("cv:open-data-folder", async () => {
  await shell.openPath(app.getPath("userData"));
  return true;
});

ipcMain.handle("cv:get-app-info", () => {
  const repository = getRepositoryInfo();
  return {
    version: app.getVersion(),
    buildInfo: getBuildInfo(),
    dataPath: app.getPath("userData"),
    defaultJsonPath: getDefaultJsonPath(),
    repository,
    releaseUrl: getReleaseUrl(),
    isPackaged: app.isPackaged
  };
});

ipcMain.handle("cv:check-for-updates", async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  return await checkForUpdates(win, true);
});
