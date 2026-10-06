"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { recommend, studyHref } from "@/lib/recommend";
import { statFor, subjectMastery } from "@/lib/adaptive";
import { subjectLevel } from "@/lib/levels";
import type { StudyMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader, MODE_META } from "@/components/common/bits";
import { Card, EmptyState, SectionTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const CHALLENGE_UNLOCK = 2;
const MODES: StudyMode[] = ["learn", "flashcards", "quiz", "review", "challenge", "guide"];

function StudyInner() {
  const subjects = useStore((s) => s.subjects);
  const params = useSearchParams();
  const ready = subjects.filter((s) => s.kit);
  const [sid, setSid] = useState<string | null>(params.get("subject") ?? ready[0]?.id ?? null);
  const [focus, setFocus] = useState<string[]>([]);
  const recs = useMemo(() => recommend(subjects).filter((r) => r.mode !== "setup").slice(0, 3), [subjects]);
  const subject = ready.find((s) => s.id === sid) ?? ready[0] ?? null;

  if (!ready.length) {
    return (
      <div>
        <PageHeader eyebrow="Study" title="Choose a session" />
        <EmptyState
          title="Nothing to study yet"
          body={subjects.length ? "Generate a study kit for one of your subjects to unlock study modes." : "Create a subject and add your notes to get started."}
          action={<LinkButton href={subjects.length ? `/subjects/${subjects[0].id}?tab=materials` : "/subjects?new=1"} icon="plus">{subjects.length ? "Generate a kit" : "New subject"}</LinkButton>}
        />
      </div>
    );
  }

  const kit = subject!.kit!;
  const lv = subjectLevel(subject!.xp).level;
  const openMistakes = subject!.mistakes.filter((m) => !m.resolved).length;
  const learning = Object.values(subject!.cardStatus).filter((v) => v === "learning").length;
  const unseen = kit.concepts.filter((c) => !statFor(subject!, c.id).attempts).length;
  const focusQ = focus.length ? `?focus=${focus.join(",")}` : "";

  const modeInfo = (m: StudyMode): { stat: string; locked?: string; disabled?: boolean } => {
    switch (m) {
      case "learn":
        return { stat: unseen ? `${unseen} new concept${unseen > 1 ? "s" : ""}` : `${kit.concepts.length} concepts` };
      case "flashcards":
        return { stat: `${kit.flashcards.length} cards${learning ? ` · ${learning} learning` : ""}` };
      case "quiz":
        return { stat: `${kit.mcqs.length + kit.shortAnswers.length} questions` };
      case "review":
        return { stat: openMistakes ? `${openMistakes} to fix` : "No mistakes", disabled: !openMistakes };
      case "challenge":
        return lv < CHALLENGE_UNLOCK ? { stat: "", locked: `Unlocks at subject level ${CHALLENGE_UNLOCK}` } : { stat: "Hard questions · 2× XP" };
      case "guide":
        return { stat: `${subject!.guideRead.length}/${kit.guide.length} sections read` };
      default:
        return { stat: "" };
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Study" title="Choose a session" sub="Pick a recommended session, or choose your own subject, mode, and focus." />

      {recs.length > 0 && (
        <div className="mb-10">
          <SectionTitle>Recommended for you</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {recs.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link
                  href={studyHref(r)}
                  className={cn(
                    "group flex h-full flex-col rounded-3xl border p-5 transition",
                    i === 0 ? "border-fg bg-fg text-bg" : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <span className={cn("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]", i === 0 ? "text-bg/60" : "text-muted")}>
                    <Icon name={MODE_META[r.mode].icon} size={12} /> {MODE_META[r.mode].label} · {r.minutes}m
                  </span>
                  <span className="mt-3 text-base font-semibold leading-snug">{r.title}</span>
                  <span className={cn("mt-1.5 text-xs leading-relaxed", i === 0 ? "text-bg/70" : "text-muted")}>{r.reason}</span>
                  <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium">
                    Start <Icon name="arrow" size={13} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <SectionTitle>Or choose your own</SectionTitle>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Subject">
        {ready.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={s.id === subject!.id}
            onClick={() => {
              setSid(s.id);
              setFocus([]);
            }}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition",
              s.id === subject!.id ? "border-fg bg-surface-2" : "border-line text-muted hover:text-fg",
            )}
          >
            <span className="text-sm font-medium">{s.name}</span>
            <span className="font-mono text-[10px] text-muted">
              LV {subjectLevel(s.xp).level} · {subjectMastery(s)}%
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const meta = MODE_META[m];
            const info = modeInfo(m);
            const disabled = !!info.locked || info.disabled;
            const href = m === "guide" ? `/subjects/${subject!.id}?tab=guide` : `/study/${subject!.id}/${m}${m === "review" ? "" : focusQ}`;
            const body = (
              <>
                <div className="flex items-start justify-between">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", disabled ? "border-line text-faint" : "border-line-strong")}>
                    <Icon name={info.locked ? "lock" : meta.icon} size={18} />
                  </span>
                  {!disabled && <Icon name="arrow" size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />}
                </div>
                <p className="mt-5 text-lg font-semibold tracking-tight">{meta.label}</p>
                <p className="mt-1 text-sm text-muted">{meta.blurb}</p>
                <p className="mt-4 font-mono text-[11px] text-faint">{info.locked ?? info.stat}</p>
              </>
            );
            return disabled ? (
              <div key={m} className="flex flex-col rounded-3xl border border-dashed border-line p-5 opacity-60" aria-disabled="true">
                {body}
              </div>
            ) : (
              <Link key={m} href={href} className="group flex flex-col rounded-3xl border border-line bg-surface p-5 transition hover:border-line-strong hover:bg-surface-2">
                {body}
              </Link>
            );
          })}
        </div>

        <Card className="lg:self-start">
          <SectionTitle action={focus.length > 0 && <button onClick={() => setFocus([])} className="text-[11px] text-muted hover:text-fg">Clear</button>}>
            Focus · optional
          </SectionTitle>
          <p className="-mt-2 mb-4 text-xs text-muted">Pick concepts to study. Leave empty and Synapse prioritises your weakest areas automatically.</p>
          <ul className="flex flex-col gap-1.5">
            {[...kit.concepts]
              .sort((a, b) => statFor(subject!, a.id).mastery - statFor(subject!, b.id).mastery)
              .map((c) => {
                const on = focus.includes(c.id);
                const m = Math.round(statFor(subject!, c.id).mastery);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setFocus(on ? focus.filter((x) => x !== c.id) : [...focus, c.id])}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                        on ? "border-fg bg-fg text-bg" : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className={cn("num font-mono text-[11px]", on ? "text-bg/70" : "text-muted")}>{m}%</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense>
      <StudyInner />
    </Suspense>
  );
}
