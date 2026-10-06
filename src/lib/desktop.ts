// Typed access to the Electron preload bridge. Undefined when running in a normal browser.

export type AIProvider = "anthropic" | "ollama" | "off";

export interface DesktopSettings {
  provider: AIProvider;
  ollamaModel: string | null;
  hasKey: boolean;
  keyHint: string | null;
  encrypted: boolean;
  dataPath: string;
  version: string;
  platform: string;
}

export interface DesktopBridge {
  platform: string;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  getSettings: () => Promise<DesktopSettings>;
  setApiKey: (key: string | null) => Promise<{ ok: boolean }>;
  setAI: (opts: { provider: AIProvider; ollamaModel?: string }) => Promise<{ ok: boolean }>;
  openDataFolder: () => Promise<string>;
}

export function desktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { synapseDesktop?: DesktopBridge }).synapseDesktop ?? null;
}
