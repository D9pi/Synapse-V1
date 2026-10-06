"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { StudyMode, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { recommend, studyHref } from "@/lib/recommend";
import { statFor } from "@/lib/adaptive";
import { formatDuration } from "@/lib/utils";
import { ProgressBar, Meter, Ring } from "../ui/Progress";
import { IconButton, LinkButton, Button } from "../ui/Button";
import { MODE_META } from "../common/bits";

/** Tracks a session's time, XP, and score; records it exactly once. */
export function useSessionTracker(subjectId: string, mode: StudyMode) {
  const [start] = useState(() => ({
    xp: useStore.getState().player.xp,
    at: Date.now(),
    mastery: Object.fromEntries(
      Object.entries(useStore.getState().subjects.find((s) => s.id === subjectId)?.conceptStats ?? {}).map(([k, v]) => [k, v.mastery]),
    ) as Record<string, number>,
  }));
  const finished = useRef(false);
  const [summary, setSummary] = useState<null | { xp: number; bonus: number; correct: number; total: number; durationMs: number }>(null);

  const finish = useCallback(
    (correct: number, total: number, opts?: { quiz?: boolean }) => {
      if (finished.current) return;
      finished.current = true;
      const durationMs = Date.now() - start.at;
      const xp = useStore.getState().player.xp - start.xp;
      const bonus = useStore.getState().finishSession({ subjectId, mode, startedAt: start.at, durationMs, xp, correct, total }, opts);
      setSummary({ xp: xp + bonus, bonus, correct, total, durationMs });
    },
    [subjectId, mode, start],
  );

  // If the student leaves mid-session with progress, still record the time and XP.
  const progressRef = useRef({ correct: 0, total: 0, any: false });
  useEffect(() => {
    const progress = progressRef;
    const record = () => {
      if (!finished.current && progress.current.any) {
        finished.current = true;
        const xp = useStore.getState().player.xp - start.xp;
        useStore.getState().finishSession({
          subjectId,
          mode,
          startedAt: start.at,
          durationMs: Date.now() - start.at,
          xp,
          correct: progress.current.correct,
          total: progress.current.total,
        });
      }
    };
    window.addEventListener("pagehide", record);
    return () => {
      window.removeEventListener("pagehide", record);
      record();
    };
  }, [subjectId, mode, start]);

  return { finish, summary, startMastery: start.mastery, progressRef, startXp: start.xp };
}

export function SessionFrame({
  subject,
  mode,
  progress,
  counter,
  xp,
  onEnd,
  children,
}: {
  subject: Subject;
  mode: StudyMode;
  progress: number;
  counter: string;
  xp: number;
  onEnd?: () => void;
  children: React.ReactNode;
}) {
  const meta = MODE_META[mode];
  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col">
      <div className="sticky top-14 z-20 -mx-4 mb-8 bg-bg/85 px-4 pb-4 pt-2 backdrop-blur lg:top-0 lg:pt-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton icon="close" label="End session" onClick={onEnd} />
            <div className="min-w-0">
              <p className="label">{meta.label}</p>
              <p className="truncate text-sm">{subject.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="num font-mono text-xs text-muted">{counter}</span>
            <motion.span key={xp} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="num rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
              +{xp} XP
            </motion.span>
          </div>
        </div>
        <ProgressBar value={progress} height={3} label="Session progress" />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function SessionSummary({
  subject,
  mode,
  summary,
  startMastery,
  touched,
}: {
  subject: Subject;
  mode: StudyMode;
  summary: { xp: number; bonus: number; correct: number; total: number; durationMs: number };
  startMastery: Record<string, number>;
  touched: string[];
}) {
  const subjects = useStore((s) => s.subjects);
  const openAssistant = useStore((s) => s.openAssistant);
  const fresh = subjects.find((s) => s.id === subject.id) ?? subject;
  const next = recommend(subjects).find((r) => !(r.subjectId === subject.id && r.mode === mode)) ?? recommend(subjects)[0];
  const acc = summary.total ? summary.correct / summary.total : null;
  const concepts = (fresh.kit?.concepts ?? []).filter((c) => touched.includes(c.id));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl py-6">
      <p className="label text-center">Session complete</p>
      <div className="mt-6 flex justify-center">
        <Ring value={acc ?? 1} size={180} stroke={5} label="Session result">
          {acc !== null ? (
            <>
              <span className="num text-5xl font-semibold">{Math.round(acc * 100)}%</span>
              <span className="mt-1 font-mono text-xs text-muted">
                {summary.correct}/{summary.total} correct
              </span>
            </>
          ) : (
            <>
              <span className="num text-5xl font-semibold">+{summary.xp}</span>
              <span className="mt-1 font-mono text-xs text-muted">XP earned</span>
            </>
          )}
        </Ring>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["XP earned", `+${summary.xp}`],
          ["Bonus", `+${summary.bonus}`],
          ["Time", formatDuration(Math.max(60_000, summary.durationMs))],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-surface p-4 text-center">
            <p className="label">{l}</p>
            <p className="num mt-1.5 text-xl font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {concepts.length > 0 && (
        <div className="mt-6 rounded-3xl border border-line bg-surface p-5">
          <p className="label mb-3">Mastery changes</p>
          <ul className="flex flex-col gap-3">
            {concepts.map((c) => {
              const before = Math.round(startMastery[c.id] ?? 0);
              const after = Math.round(statFor(fresh, c.id).mastery);
              const d = after - before;
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Meter value={after} />
                    <span className="num w-20 text-right font-mono text-xs">
                      {after}% <span className="text-muted">{d >= 0 ? `+${d}` : d}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {next && (
          <LinkButton href={studyHref(next)} iconRight="arrow" size="lg">
            Next: {next.title.length > 34 ? next.title.slice(0, 33) + "…" : next.title}
          </LinkButton>
        )}
        <Button
          variant="outline"
          size="lg"
          icon="spark"
          onClick={() =>
            openAssistant({
              subjectId: subject.id,
              focus: null,
              draft: `I just finished a ${mode} session (${summary.correct}/${summary.total} correct). Review how I did and tell me what to focus on next.`,
            })
          }
        >
          AI review
        </Button>
      </div>
      <div className="mt-4 text-center">
        <Link href={`/subjects/${subject.id}`} className="text-xs text-muted hover:text-fg">
          Back to {subject.name}
        </Link>
      </div>
    </motion.div>
  );
}
