"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { playerLevel, subjectLevel, titleFor, TITLES } from "@/lib/levels";
import { REGIONS, regionById } from "@/lib/regions";
import { ACHIEVEMENTS, THEMES } from "@/lib/achievements";
import { statFor, subjectMastery } from "@/lib/adaptive";
import type { RegionId, ThemeId } from "@/lib/types";
import { cn, dayKey, formatDuration, timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/common/bits";
import { Card, SectionTitle, Chip } from "@/components/ui/Card";
import { ProgressBar, Meter } from "@/components/ui/Progress";
import { Icon } from "@/components/ui/Icon";
import { BrainMap, regionStats } from "@/components/brain/BrainMap";

function Heatmap() {
  const sessions = useStore((s) => s.sessions);
  const activity = useStore((s) => s.activity);
  const weeks = 18;
  const { cells, max } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of sessions) byDay.set(dayKey(s.startedAt), (byDay.get(dayKey(s.startedAt)) ?? 0) + s.xp);
    for (const a of activity) if (!byDay.has(dayKey(a.at))) byDay.set(dayKey(a.at), a.xp);
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - today.getDay()));
    const out: { key: string; v: number; future: boolean }[] = [];
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      out.push({ key: dayKey(d.getTime()), v: byDay.get(dayKey(d.getTime())) ?? 0, future: d > today });
    }
    return { cells: out, max: Math.max(1, ...out.map((c) => c.v)) };
  }, [sessions, activity]);

  return (
    <div className="overflow-x-auto">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="Study activity over the last 18 weeks">
        {cells.map((c) => (
          <span
            key={c.key}
            title={`${c.key}: ${c.v} XP`}
            className={cn("h-3 w-3 rounded-[3px]", c.future ? "bg-transparent" : c.v === 0 ? "bg-surface-3" : "bg-fg")}
            style={{ opacity: c.v ? 0.25 + 0.75 * (c.v / max) : 1 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const player = useStore((s) => s.player);
  const subjects = useStore((s) => s.subjects);
  const sessions = useStore((s) => s.sessions);
  const setTheme = useStore((s) => s.setTheme);
  const lv = playerLevel(player.xp);
  const stats = useMemo(() => regionStats(subjects), [subjects]);
  const [region, setRegion] = useState<RegionId>(() => [...stats].sort((a, b) => b.xp - a.xp)[0]?.id ?? "analytical");
  const r = stats.find((s) => s.id === region)!;
  const def = regionById(region);
  const [open, setOpen] = useState<string | null>(null);



  return (
    <div>
      <PageHeader eyebrow="Progress" title={`Level ${lv.level} · ${titleFor(lv.level)}`} sub={`${player.xp.toLocaleString()} XP total · ${formatDuration(player.totalStudyMs)} studied · ${sessions.length} sessions`} />

      {/* Title track */}
      <Card className="mb-4">
        <div className="mb-2 flex justify-between font-mono text-[11px] text-muted">
          <span>LV {lv.level}</span>
          <span>
            {lv.current} / {lv.needed} XP
          </span>
          <span>LV {lv.level + 1}</span>
        </div>
        <ProgressBar value={lv.progress} height={6} label="Player level progress" />
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TITLES.map((t) => {
            const reached = lv.level >= t.level;
            return (
              <div key={t.title} className={cn("flex shrink-0 flex-col rounded-2xl border px-4 py-3", reached ? "border-line-strong" : "border-dashed border-line opacity-50")}>
                <span className="font-mono text-[10px] text-muted">LV {t.level}</span>
                <span className="mt-0.5 text-sm font-medium">{t.title}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Brain */}
      <Card className="mb-4 overflow-hidden p-0 sm:p-0">
        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          <div className="relative border-b border-line p-4 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <p className="label">Brain map</p>
              <p className="font-mono text-[10px] text-faint">TAP A REGION</p>
            </div>
            <BrainMap subjects={subjects} selected={region} onSelect={setRegion} className="mt-2" />
          </div>
          <motion.div key={region} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col p-6 sm:p-8">
            <p className="label">{r.tier}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{def.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {def.skill} · {def.subjects}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line p-4">
                <p className="label">Region level</p>
                <p className="num mt-1 text-3xl font-semibold">{r.level}</p>
              </div>
              <div className="rounded-2xl border border-line p-4">
                <p className="label">Development</p>
                <p className="num mt-1 text-3xl font-semibold">{Math.round(r.development * 100)}%</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="label mb-3">Subjects feeding this region</p>
              {r.subjects.length ? (
                <ul className="flex flex-col gap-2">
                  {r.subjects.map((s) => (
                    <li key={s.id}>
                      <Link href={`/subjects/${s.id}`} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm transition hover:border-line-strong">
                        <span>{s.name}</span>
                        <span className="font-mono text-[11px] text-muted">LV {subjectLevel(s.xp).level}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Dormant. Add a {def.subjects.split(",")[0]} subject to awaken it.</p>
              )}
            </div>
            <p className="mt-auto pt-6 text-[11px] leading-relaxed text-faint">
              Brain regions are a fictional game mechanic inspired by different kinds of thinking — not a scientific model of the brain.
            </p>
          </motion.div>
        </div>
        <div className="grid grid-cols-3 border-t border-line sm:grid-cols-6">
          {REGIONS.map((x) => {
            const st = stats.find((s) => s.id === x.id)!;
            return (
              <button
                key={x.id}
                onClick={() => setRegion(x.id)}
                className={cn("border-line p-4 text-left transition [&:not(:last-child)]:border-r", region === x.id ? "bg-surface-2" : "hover:bg-surface-2")}
              >
                <p className="truncate text-xs font-medium">{x.name}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">{st.xp ? `LV ${st.level}` : "—"}</p>
                <div className="mt-2">
                  <ProgressBar value={st.development} height={2} label={`${x.name} development`} />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Subjects */}
      <Card className="mb-4">
        <SectionTitle>Subject levels</SectionTitle>
        {subjects.length === 0 && <p className="text-sm text-muted">No subjects yet.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {subjects.map((s) => {
            const sl = subjectLevel(s.xp);
            const count = sessions.filter((x) => x.subjectId === s.id).length;
            const isOpen = open === s.id;
            return (
              <li key={s.id} className="py-4">
                <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:gap-6" aria-expanded={isOpen}>
                  <div className="flex min-w-0 items-center gap-3 sm:w-56">
                    <span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line-strong text-sm font-semibold">{sl.level}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate font-mono text-[10px] text-faint">{regionById(s.region).name}</span>
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between font-mono text-[10px] text-muted">
                      <span>{s.xp} XP</span>
                      <span>
                        {sl.current}/{sl.needed}
                      </span>
                    </div>
                    <ProgressBar value={sl.progress} height={4} label={`${s.name} progress`} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs sm:w-72">
                    <span>
                      <span className="label block">Mastery</span>
                      <span className="num">{s.kit ? `${subjectMastery(s)}%` : "—"}</span>
                    </span>
                    <span>
                      <span className="label block">Sessions</span>
                      <span className="num">{count}</span>
                    </span>
                    <span>
                      <span className="label block">Recent</span>
                      <span>{timeAgo(s.lastStudied)}</span>
                    </span>
                  </div>
                  <Icon name="down" size={16} className={cn("hidden text-faint transition sm:block", isOpen && "rotate-180")} />
                </button>
                {isOpen && s.kit && (
                  <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 grid gap-2 sm:grid-cols-2">
                    {s.kit.concepts.map((c) => {
                      const st = statFor(s, c.id);
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                          <span className="min-w-0 truncate text-sm">{c.name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Meter value={st.mastery} />
                            <span className="num w-9 text-right font-mono text-[11px]">{Math.round(st.mastery)}%</span>
                          </span>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle>
            Achievements · {Object.keys(player.achievements).length}/{ACHIEVEMENTS.length}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const at = player.achievements[a.id];
              return (
                <div key={a.id} className={cn("flex flex-col rounded-2xl border p-4", at ? "border-line-strong bg-surface-2" : "border-dashed border-line")}>
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-lg", at ? "bg-fg text-bg" : "border border-line text-faint")}>{at ? a.glyph : <Icon name="lock" size={15} />}</span>
                  <p className={cn("mt-4 text-sm font-medium", !at && "text-muted")}>{a.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.description}</p>
                  {at && <p className="mt-2 font-mono text-[10px] text-faint">{new Date(at).toLocaleDateString()}</p>}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Activity · 18 weeks</SectionTitle>
            <Heatmap />
            <div className="mt-4 flex gap-6 text-xs text-muted">
              <span>
                Streak <span className="num font-mono text-fg">{player.streak}d</span>
              </span>
              <span>
                Best <span className="num font-mono text-fg">{player.bestStreak}d</span>
              </span>
            </div>
          </Card>

          <Card>
            <SectionTitle>Themes</SectionTitle>
            <div className="flex flex-col gap-2">
              {THEMES.map((t) => {
                const unlocked = lv.level >= t.unlockLevel;
                const active = player.theme === t.id;
                return (
                  <button
                    key={t.id}
                    disabled={!unlocked}
                    onClick={() => setTheme(t.id as ThemeId)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed",
                      active ? "border-fg" : "border-line hover:border-line-strong",
                      !unlocked && "opacity-50",
                    )}
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl border border-line-strong"
                      style={{ background: t.id === "onyx" ? "#000" : t.id === "graphite" ? "#1b1b1d" : "#f5f5f3" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.name}</span>
                      <span className="block text-xs text-muted">{unlocked ? t.description : `Unlocks at level ${t.unlockLevel}`}</span>
                    </span>
                    {active && <Chip active>On</Chip>}
                    {!unlocked && <Icon name="lock" size={14} className="text-faint" />}
                  </button>
                );
              })}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
