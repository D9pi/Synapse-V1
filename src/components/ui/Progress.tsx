"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  height = 6,
  label,
}: {
  value: number; // 0..1
  className?: string;
  height?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-fg"
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 120,
  stroke = 6,
  children,
  className,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--fg)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Segmented mastery meter: 10 ticks. */
export function Meter({ value, className }: { value: number; className?: string }) {
  const filled = Math.round((value / 100) * 10);
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={cn("h-3 w-1.5 rounded-sm transition-colors", i < filled ? "bg-fg" : "bg-surface-3")} />
      ))}
    </div>
  );
}
