"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/client-api";

const AIContext = createContext<{ ai: boolean; model: string | null; checked: boolean }>({ ai: false, model: null, checked: false });
export const useAI = () => useContext(AIContext);

const noopSubscribe = () => () => {};

export function Providers({ children }: { children: React.ReactNode }) {
  // false during SSR/hydration, true on the client: progress lives in localStorage.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [ai, setAi] = useState({ ai: false, model: null as string | null, checked: false });
  const theme = useStore((s) => s.player.theme);

  useEffect(() => {
    api.status().then((s) => setAi({ ...s, checked: true }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
  return <AIContext.Provider value={ai}>{children}</AIContext.Provider>;
}
