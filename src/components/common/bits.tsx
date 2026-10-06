"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Subject, StudyMode } from "@/lib/types";
import { subjectLevel } from "@/lib/levels";
import { regionById } from "@/lib/regions";
import { subjectMastery } from "@/lib/adaptive";
import { timeAgo } from "@/lib/utils";
import { ProgressBar } from "../ui/Progress";
import { Icon, type IconName } from "../ui/Icon";

export const MODE_META: Record<StudyMode | "setup", { label: string; icon: IconName; blurb: string }> = {
  guide: { label: "Study guide", icon: "book", blurb: "Read the AI-structured guide." },
  learn: { label: "Learn", icon: "target", blurb: "Teach the concept first, then test." },
  flashcards: { label: "Flashcards", icon: "cards", blurb: "Flip, recall, mark what you know." },
  quiz: { label: "Quiz", icon: "bolt", blurb: "Adaptive questions on weak spots." },
  review: { label: "Review", icon: "loop", blurb: "Replay everything you got wrong." },
  challenge: { label: "Challenge", icon: "flame", blurb: "Harder questions. Double XP." },
  setup: { label: "Set up", icon: "plus", blurb: "Add material to generate a kit." },
};

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="label mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        {icon && <Icon name={icon} size={16} className="text-faint" />}
      </div>
      <p className="num mt-3 text-3xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function SubjectCard({ subject, index = 0 }: { subject: Subject; index?: number }) {
  const lv = subjectLevel(subject.xp);
  const mastery = subjectMastery(subject);
  const region = regionById(subject.region);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link
        href={`/subjects/${subject.id}`}
        className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-5 transition hover:border-line-strong hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label truncate">{region.name}</p>
            <p className="mt-2 truncate text-lg font-semibold tracking-tight">{subject.name}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border border-line-strong">
            <span className="text-[8px] font-mono text-muted">LV</span>
            <span className="num -mt-0.5 text-sm font-semibold">{lv.level}</span>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-muted">
              <span>XP</span>
              <span className="num font-mono">
                {lv.current}/{lv.needed}
              </span>
            </div>
            <ProgressBar value={lv.progress} height={4} label={`${subject.name} level progress`} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{subject.kit ? `${mastery}% mastery` : "No study kit yet"}</span>
            <span className="text-faint">{timeAgo(subject.lastStudied)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
