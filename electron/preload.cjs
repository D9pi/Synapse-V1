// Bridge between the Synapse UI and the desktop shell. Exposes a minimal, explicit API.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("synapseDesktop", {
  platform: process.platform,
  storage: {
    getItem: (key) => ipcRenderer.sendSync("storage:get", String(key)),
    setItem: (key, value) => ipcRenderer.send("storage:set", String(key), String(value)),
    removeItem: (key) => ipcRenderer.send("storage:remove", String(key)),
  },
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setApiKey: (key) => ipcRenderer.invoke("settings:setKey", key),
  setAI: (opts) => ipcRenderer.invoke("settings:setAI", opts),
  openDataFolder: () => ipcRenderer.invoke("app:openDataFolder"),
});
