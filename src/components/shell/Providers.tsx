"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/client-api";
import { desktop } from "@/lib/desktop";

interface AIState {
  ai: boolean;
  provider: "anthropic" | "ollama" | null;
  model: string | null;
  checked: boolean;
  isDesktop: boolean;
}
const AIContext = createContext<AIState>({ ai: false, provider: null, model: null, checked: false, isDesktop: false });
export const useAI = () => useContext(AIContext);

const noopSubscribe = () => () => {};

export function Providers({ children }: { children: React.ReactNode }) {
  // false during SSR/hydration, true on the client: progress lives in localStorage.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [ai, setAi] = useState<Omit<AIState, "isDesktop">>({ ai: false, provider: null, model: null, checked: false });
  const isDesktop = useSyncExternalStore(noopSubscribe, () => desktop() !== null, () => false);
  const theme = useStore((s) => s.player.theme);

  useEffect(() => {
    api.status().then((s) => setAi({ ...s, checked: true }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const d = desktop();
    if (d) document.documentElement.classList.add("is-desktop", `platform-${d.platform}`);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-fg pulse-dot" />
          <span className="label">Synapse</span>
        </div>
      </div>
    );
  }
  return <AIContext.Provider value={{ ...ai, isDesktop }}>{children}</AIContext.Provider>;
}
