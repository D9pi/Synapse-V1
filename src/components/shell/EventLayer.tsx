"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore, type GameEvent } from "@/lib/store";
import { Button } from "../ui/Button";

function useAutoDismiss(ev: GameEvent, ms: number) {
  const dismiss = useStore((s) => s.dismissEvent);
  useEffect(() => {
    const t = setTimeout(() => dismiss(ev.id), ms);
    return () => clearTimeout(t);
  }, [ev.id, ms, dismiss]);
}

function XpPop({ ev }: { ev: Extract<GameEvent, { kind: "xp" }> }) {
  useAutoDismiss(ev, 1600);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex items-center gap-2 rounded-full border border-line-strong bg-surface/95 px-4 py-2 backdrop-blur"
    >
      <span className="num font-mono text-sm font-semibold">+{ev.amount} XP</span>
      <span className="text-xs text-muted">{ev.label}</span>
    </motion.div>
  );
}

function Toast({ ev, title, body, glyph }: { ev: GameEvent; title: string; body: string; glyph: string }) {
  useAutoDismiss(ev, 4200);
  const dismiss = useStore((s) => s.dismissEvent);
  return (
    <motion.button
      layout
      onClick={() => dismiss(ev.id)}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="flex w-72 items-center gap-4 rounded-2xl border border-line-strong bg-surface/95 p-4 text-left backdrop-blur"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fg text-lg text-bg">{glyph}</span>
      <span className="min-w-0">
        <span className="label block">{title}</span>
        <span className="mt-0.5 block truncate text-sm font-medium">{body}</span>
      </span>
    </motion.button>
  );
}

function LevelUp({ ev }: { ev: Extract<GameEvent, { kind: "level" }> }) {
  const dismiss = useStore((s) => s.dismissEvent);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismiss(ev.id);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [ev.id, dismiss]);
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => dismiss(ev.id)}
      role="dialog"
      aria-label={`Level ${ev.level} reached`}
    >
      <div className="relative flex flex-col items-center text-center text-white">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-[38%] rounded-full border border-white/30"
            style={{ x: "-50%", y: "-50%" }}
            initial={{ width: 40, height: 40, opacity: 0.8 }}
            animate={{ width: 520, height: 520, opacity: 0 }}
            transition={{ duration: 2.2, delay: i * 0.45, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        <motion.p className="label !text-white/60" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          Level up
        </motion.p>
        <motion.p
          className="num mt-2 text-[9rem] font-semibold leading-none tracking-tighter"
          initial={{ scale: 0.4, opacity: 0, filter: "blur(12px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.15 }}
        >
          {ev.level}
        </motion.p>
        <motion.p className="mt-3 text-xl font-medium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {ev.title}
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8">
          <Button variant="outline" className="!border-white/30 !text-white" onClick={() => dismiss(ev.id)}>
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function EventLayer() {
  const events = useStore((s) => s.events);
  const xps = events.filter((e): e is Extract<GameEvent, { kind: "xp" }> => e.kind === "xp").slice(-3);
  const toasts = events.filter((e) => e.kind === "achievement" || e.kind === "subject-level" || e.kind === "mastered").slice(-3);
  const level = events.find((e): e is Extract<GameEvent, { kind: "level" }> => e.kind === "level");

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4rem_+_var(--tb))] z-50 flex flex-col items-center gap-2 lg:top-[calc(1.5rem_+_var(--tb))]">
        <AnimatePresence>
          {xps.map((e) => (
            <XpPop key={e.id} ev={e} />
          ))}
        </AnimatePresence>
      </div>
      <div aria-live="polite" className="fixed right-4 top-[calc(5rem_+_var(--tb))] z-50 flex flex-col gap-2 lg:top-[calc(1.5rem_+_var(--tb))]">
        <AnimatePresence>
          {toasts.map((e) =>
            e.kind === "achievement" ? (
              <Toast key={e.id} ev={e} title="Achievement unlocked" body={e.name} glyph={e.glyph} />
            ) : e.kind === "subject-level" ? (
              <Toast key={e.id} ev={e} title={`${e.subject} leveled up`} body={`Subject level ${e.level}`} glyph="↑" />
            ) : e.kind === "mastered" ? (
              <Toast key={e.id} ev={e} title="Concept mastered" body={e.concept} glyph="◎" />
            ) : null,
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{level && <LevelUp key={level.id} ev={level} />}</AnimatePresence>
    </>
  );
}
