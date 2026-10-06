// Synapse desktop shell.
// Runs the bundled Next.js server in a background process and shows it in a native window.
// Progress is stored in a JSON file in the user's app-data folder, and the AI key is kept
// encrypted with the OS keychain when available.

const { app, BrowserWindow, utilityProcess, ipcMain, safeStorage, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const PREFERRED_PORT = 47321;
const TITLEBAR_HEIGHT = 36;
const isMac = process.platform === "darwin";

/** @type {Electron.UtilityProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;
let serverUrl = "";
let quitting = false;

// ---------- paths ----------

const userData = () => app.getPath("userData");
const dataFile = () => path.join(userData(), "synapse-data.json");
const settingsFile = () => path.join(userData(), "settings.json");
const logFile = () => path.join(userData(), "server.log");

function serverDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "..", ".next", "standalone");
}

// ---------- JSON file helpers ----------

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

// ---------- progress storage (replaces browser localStorage) ----------

let store = null;
let writeTimer = null;

function loadStore() {
  if (!store) store = readJson(dataFile(), {});
  return store;
}

function flushStore() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (store) {
    try {
      writeJsonAtomic(dataFile(), store);
    } catch (err) {
      console.error("Synapse: failed to save progress", err);
    }
  }
}

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushStore, 250);
}

ipcMain.on("storage:get", (e, key) => {
  e.returnValue = loadStore()[key] ?? null;
});
ipcMain.on("storage:set", (_e, key, value) => {
  loadStore()[key] = value;
  scheduleWrite();
});
ipcMain.on("storage:remove", (_e, key) => {
  delete loadStore()[key];
  scheduleWrite();
});

// ---------- settings (AI key) ----------

function readSettings() {
  return readJson(settingsFile(), {});
}

function getApiKey() {
  const s = readSettings();
  if (!s.apiKey) return null;
  try {
    if (s.encrypted) return safeStorage.decryptString(Buffer.from(s.apiKey, "base64"));
    return Buffer.from(s.apiKey, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function saveApiKey(key) {
  const s = readSettings();
  if (!key) {
    delete s.apiKey;
    delete s.encrypted;
  } else if (safeStorage.isEncryptionAvailable()) {
    s.apiKey = safeStorage.encryptString(key).toString("base64");
    s.encrypted = true;
  } else {
    s.apiKey = Buffer.from(key, "utf8").toString("base64");
    s.encrypted = false;
  }
  writeJsonAtomic(settingsFile(), s);
}

/** "anthropic" | "ollama" | "off" | undefined (auto: Claude if a key is saved). */
function getProvider() {
  const p = readSettings().provider;
  return p === "anthropic" || p === "ollama" || p === "off" ? p : null;
}

function updateSettings(patch) {
  writeJsonAtomic(settingsFile(), { ...readSettings(), ...patch });
}

ipcMain.handle("settings:get", () => {
  const key = getApiKey();
  const s = readSettings();
  return {
    provider: getProvider() ?? (key ? "anthropic" : "off"),
    ollamaModel: s.ollamaModel || null,
    hasKey: Boolean(key),
    keyHint: key ? `…${key.slice(-4)}` : null,
    encrypted: Boolean(readSettings().encrypted),
    dataPath: userData(),
    version: app.getVersion(),
    platform: process.platform,
  };
});

ipcMain.handle("settings:setKey", async (_e, key) => {
  const clean = typeof key === "string" ? key.trim() : "";
  saveApiKey(clean || null);
  // Saving a key switches to Claude; removing it turns AI off unless Local AI is chosen.
  if (clean) updateSettings({ provider: "anthropic" });
  else if (getProvider() === "anthropic") updateSettings({ provider: "off" });
  await restartServer();
  return { ok: true };
});

ipcMain.handle("settings:setAI", async (_e, opts) => {
  const provider = opts?.provider;
  if (provider !== "anthropic" && provider !== "ollama" && provider !== "off") throw new Error("Unknown AI engine");
  const patch = { provider };
  if (typeof opts.ollamaModel === "string" && /^[\w.\-/:]+$/.test(opts.ollamaModel)) patch.ollamaModel = opts.ollamaModel;
  updateSettings(patch);
  await restartServer();
  return { ok: true };
});

ipcMain.handle("app:openDataFolder", () => shell.openPath(userData()));

// ---------- local server ----------

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (let p = PREFERRED_PORT; p < PREFERRED_PORT + 50; p++) {
    if (await portFree(p)) return p;
  }
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!server) throw new Error("The Synapse server stopped while starting.");
    try {
      const res = await fetch(`${url}/api/status`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("The Synapse server took too long to start.");
}

async function startServer() {
  const dir = serverDir();
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`Server bundle not found at ${entry}. Run "npm run desktop:prepare" first.`);
  }
  const port = await pickPort();
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    SYNAPSE_DESKTOP: "1",
  };
  const key = getApiKey();
  if (key) env.ANTHROPIC_API_KEY = key;
  const provider = getProvider();
  if (provider) env.SYNAPSE_AI_PROVIDER = provider;
  const ollamaModel = readSettings().ollamaModel;
  if (ollamaModel) env.OLLAMA_MODEL = ollamaModel;

  fs.mkdirSync(userData(), { recursive: true });
  const log = fs.createWriteStream(logFile(), { flags: "a" });
  log.write(`\n--- ${new Date().toISOString()} starting on port ${port} ---\n`);

  server = utilityProcess.fork(entry, [], { cwd: dir, env, stdio: "pipe", serviceName: "Synapse Server" });
  server.stdout?.on("data", (d) => log.write(d));
  server.stderr?.on("data", (d) => log.write(d));
  const proc = server;
  server.on("exit", (code) => {
    log.write(`--- server exited (${code}) ---\n`);
    log.end();
    if (server === proc) server = null;
    if (!quitting && win && server === null && code !== 0) {
      showError(`The Synapse server stopped unexpectedly (code ${code}).`);
    }
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

function stopServer() {
  return new Promise((resolve) => {
    const proc = server;
    if (!proc) return resolve();
    server = null;
    proc.once("exit", () => resolve());
    proc.kill();
    setTimeout(resolve, 3000);
  });
}

async function restartServer() {
  // Come back to the same screen (e.g. Settings) after the restart.
  let route = "/";
  try {
    if (win) route = new URL(win.webContents.getURL()).pathname || "/";
  } catch {
    /* keep "/" */
  }
  await stopServer();
  const url = await startServer();
  if (win) await win.loadURL(url + route);
}

// ---------- window ----------

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#000;color:#8d8d8d;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.3em;-webkit-app-region:drag}
body{display:flex;align-items:center;justify-content:center;gap:12px}
i{width:8px;height:8px;border-radius:50%;background:#fff;animation:p 1.6s ease-in-out infinite}
@keyframes p{50%{opacity:.25}}</style></head><body><i></i>SYNAPSE</body></html>`)}`;

function showError(message) {
  if (!win) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#000;color:#fff;font:14px -apple-system,Segoe UI,sans-serif}
  body{display:flex;align-items:center;justify-content:center;-webkit-app-region:drag}
  div{max-width:420px;padding:32px;text-align:center} p{color:#8d8d8d;line-height:1.6} code{color:#fff;font-size:12px}
  </style></head><body><div><h2>Synapse couldn't start</h2><p>${message.replace(/</g, "&lt;")}</p>
  <p>Details are in<br><code>${logFile().replace(/</g, "&lt;")}</code></p><p>Try quitting and reopening the app.</p></div></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 400,
    minHeight: 560,
    show: false,
    backgroundColor: "#000000",
    title: "Synapse",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 16, y: 11 } : undefined,
    titleBarOverlay: isMac ? undefined : { color: "#000000", symbolColor: "#ffffff", height: TITLEBAR_HEIGHT },
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => {
    win = null;
  });

  // Links to other sites open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (serverUrl && !url.startsWith(serverUrl) && !url.startsWith("data:")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  win.loadURL(LOADING_HTML);
}

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open Data Folder", click: () => shell.openPath(userData()) },
        { label: "Open Server Log", click: () => shell.openPath(logFile()) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- lifecycle ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    createWindow();
    try {
      const url = await startServer();
      await win?.loadURL(url);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (serverUrl && server) await win?.loadURL(serverUrl);
    }
  });

  app.on("window-all-closed", () => {
    if (!isMac) app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    flushStore();
    server?.kill();
  });
}

process.on("uncaughtException", (err) => {
  console.error(err);
  if (!app.isReady()) return;
  dialog.showErrorBox("Synapse", String(err?.message ?? err));
});
