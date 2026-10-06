"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { recommend, studyHref } from "@/lib/recommend";
import { playerLevel, titleFor, nextTitle } from "@/lib/levels";
import { subjectMastery, weakestConcepts } from "@/lib/adaptive";
import { dayKey, formatDuration, timeAgo } from "@/lib/utils";
import { Card, SectionTitle, Chip, EmptyState } from "@/components/ui/Card";
import { LinkButton, Button } from "@/components/ui/Button";
import { Ring } from "@/components/ui/Progress";
import { Icon } from "@/components/ui/Icon";
import { BrainMap } from "@/components/brain/BrainMap";
import { MODE_META, Stat, SubjectCard } from "@/components/common/bits";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night focus";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const player = useStore((s) => s.player);
  const subjects = useStore((s) => s.subjects);
  const activity = useStore((s) => s.activity);
  const openAssistant = useStore((s) => s.openAssistant);
  const sessionCount = useStore((s) => s.sessions.length);

  const recs = useMemo(() => recommend(subjects), [subjects]);
  const primary = recs[0];
  const others = recs.slice(1, 5);
  const lv = playerLevel(player.xp);
  const next = nextTitle(lv.level);
  const recentSubjects = [...subjects].sort((a, b) => (b.lastStudied ?? b.createdAt) - (a.lastStudied ?? a.createdAt)).slice(0, 4);
  const withKit = subjects.filter((s) => s.kit);
  const avgMastery = withKit.length ? Math.round(withKit.reduce((a, s) => a + subjectMastery(s), 0) / withKit.length) : 0;
  const studiedToday = player.lastStudyDay === dayKey();

  const insight = useMemo(() => {
    let worst: { subject: string; concept: string; mastery: number } | null = null;
    for (const s of withKit) {
      const w = weakestConcepts(s, 1)[0];
      if (w && w.stat.attempts > 0 && (!worst || w.stat.mastery < worst.mastery)) {
        worst = { subject: s.name, concept: w.concept.name, mastery: Math.round(w.stat.mastery) };
      }
    }
    return worst;
  }, [withKit]);

  const primaryMeta = MODE_META[primary.mode];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="label mb-2">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{greeting()}.</h1>
        <p className="mt-2 text-sm text-muted">
          Level {lv.level} {titleFor(lv.level)}
          {player.streak > 0 && ` · ${player.streak}-day streak${studiedToday ? "" : " — study today to keep it"}`}
        </p>
      </motion.div>

      {/* Next up: the one obvious action */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-[2rem] border border-line-strong bg-surface"
        aria-label="Recommended next session"
      >
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip active>
                <span className="h-1.5 w-1.5 rounded-full bg-bg pulse-dot" /> Study now
              </Chip>
              <Chip>
                <Icon name={primaryMeta.icon} size={11} /> {primaryMeta.label}
              </Chip>
              <Chip>~{primary.minutes} min</Chip>
            </div>
            <h2 className="mt-5 max-w-2xl text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">{primary.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{primary.reason}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href={studyHref(primary)} size="lg" iconRight="arrow">
                {primary.mode === "setup" ? "Get started" : "Start session"}
              </LinkButton>
              {subjects.length > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  icon="spark"
                  onClick={() => openAssistant({ subjectId: null, draft: "What should I study right now, and why?" })}
                >
                  Ask AI
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 lg:flex-col lg:gap-3">
            <Ring value={lv.progress} size={148} stroke={5} label={`Level ${lv.level}, ${Math.round(lv.progress * 100)}% to next`}>
              <span className="label">Level</span>
              <span className="num text-5xl font-semibold leading-none">{lv.level}</span>
            </Ring>
            <div className="text-left lg:text-center">
              <p className="num font-mono text-xs text-muted">
                {lv.needed - lv.current} XP to level {lv.level + 1}
              </p>
              {next && <p className="mt-1 text-xs text-faint">Next title: {next.title} (LV {next.level})</p>}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Streak" icon="flame" value={`${player.streak}d`} sub={`Best ${player.bestStreak}d`} />
        <Stat label="Study time" icon="clock" value={formatDuration(player.totalStudyMs)} sub={`${sessionCount} sessions`} />
        <Stat label="Total XP" icon="bolt" value={player.xp.toLocaleString()} sub={titleFor(lv.level)} />
        <Stat label="Mastery" icon="target" value={`${avgMastery}%`} sub={`${withKit.length} subject${withKit.length === 1 ? "" : "s"} tracked`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {others.length > 0 && (
            <Card>
              <SectionTitle>Recommended sessions</SectionTitle>
              <ul className="-mx-2 flex flex-col">
                {others.map((r) => {
                  const meta = MODE_META[r.mode];
                  return (
                    <li key={r.id}>
                      <Link href={studyHref(r)} className="group flex items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-surface-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted group-hover:border-line-strong group-hover:text-fg">
                          <Icon name={meta.icon} size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted">{r.reason}</span>
                        </span>
                        <span className="hidden font-mono text-[11px] text-faint sm:block">{r.minutes}m</span>
                        <Icon name="chevron" size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div>
            <SectionTitle action={<Link href="/subjects" className="text-xs text-muted hover:text-fg">All subjects →</Link>}>Recent subjects</SectionTitle>
            {recentSubjects.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {recentSubjects.map((s, i) => (
                  <SubjectCard key={s.id} subject={s} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No subjects yet"
                body="Create a subject like “AP Biology”, paste your notes, and Synapse builds the rest."
                action={<LinkButton href="/subjects?new=1" icon="plus">New subject</LinkButton>}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Link href="/progress" className="group block">
            <Card className="transition group-hover:border-line-strong">
              <SectionTitle action={<span className="text-xs text-muted group-hover:text-fg">Brain map →</span>}>Your brain</SectionTitle>
              <BrainMap subjects={subjects} compact />
            </Card>
          </Link>

          <Card>
            <SectionTitle>
              <span className="flex items-center gap-2">
                <Icon name="spark" size={12} /> AI insight
              </span>
            </SectionTitle>
            {insight ? (
              <p className="text-sm leading-relaxed">
                Your weakest area is <strong className="font-semibold">{insight.concept}</strong> in {insight.subject} at{" "}
                <span className="num font-mono">{insight.mastery}%</span>. Targeted practice here will raise your mastery fastest.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                Answer a few questions and Synapse will start spotting patterns in what you find hard.
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              icon="spark"
              onClick={() => openAssistant({ subjectId: null, draft: "Look at my progress across all subjects. What should I focus on this week?" })}
            >
              Get a personalised plan
            </Button>
          </Card>

          <Card>
            <SectionTitle>Activity</SectionTitle>
            {activity.length ? (
              <ul className="flex flex-col gap-3">
                {activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{a.label}</span>
                      <span className="block text-xs text-faint">
                        {subjects.find((s) => s.id === a.subjectId)?.name ?? "General"} · {timeAgo(a.at)}
                      </span>
                    </span>
                    <span className="num shrink-0 font-mono text-xs text-muted">+{a.xp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Your XP history will appear here.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
