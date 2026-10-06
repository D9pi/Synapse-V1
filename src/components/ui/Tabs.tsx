"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  layoutId = "tabs",
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  layoutId?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors",
              active ? "text-bg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-fg"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative">{t.label}</span>
            {t.count !== undefined && <span className={cn("relative font-mono text-[10px]", active ? "text-bg/60" : "text-faint")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
