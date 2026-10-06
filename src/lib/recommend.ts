import type { Subject, StudyMode } from "./types";
import { weakestConcepts, subjectMastery } from "./adaptive";

export interface Recommendation {
  id: string;
  subjectId: string | null;
  mode: StudyMode | "setup";
  title: string;
  reason: string;
  focusConcepts?: string[];
  minutes: number;
  score: number;
}

export function studyHref(r: Recommendation): string {
  if (!r.subjectId) return "/subjects?new=1";
  if (r.mode === "setup") return `/subjects/${r.subjectId}?tab=materials`;
  if (r.mode === "guide") return `/subjects/${r.subjectId}?tab=guide`;
  const focus = r.focusConcepts?.length ? `?focus=${r.focusConcepts.join(",")}` : "";
  return `/study/${r.subjectId}/${r.mode}${focus}`;
}

export function recommend(subjects: Subject[]): Recommendation[] {
  const out: Recommendation[] = [];
  if (!subjects.length) {
    return [
      {
        id: "create",
        subjectId: null,
        mode: "setup",
        title: "Create your first subject",
        reason: "Add your notes and Synapse will build a full study system from them.",
        minutes: 3,
        score: 1000,
      },
    ];
  }

  for (const s of subjects) {
    const staleDays = s.lastStudied ? (Date.now() - s.lastStudied) / 86_400_000 : 3;
    const stale = Math.min(staleDays, 10) * 4;
    if (!s.kit) {
      out.push({
        id: `${s.id}-setup`,
        subjectId: s.id,
        mode: "setup",
        title: `Build your ${s.name} study kit`,
        reason: "Add notes or flashcards — the AI will generate a guide, cards, and quizzes.",
        minutes: 3,
        score: 90,
      });
      continue;
    }

    const kit = s.kit;
    const open = s.mistakes.filter((m) => !m.resolved).length;
    const weak = weakestConcepts(s, 2);
    const mastery = subjectMastery(s);
    const learning = Object.values(s.cardStatus).filter((v) => v === "learning").length;
    const unseen = kit.concepts.filter((c) => !s.conceptStats[c.id]?.attempts).length;

    if (open >= 3) {
      out.push({
        id: `${s.id}-review`,
        subjectId: s.id,
        mode: "review",
        title: `Fix ${open} missed questions in ${s.name}`,
        reason: "Re-attempting mistakes soon after making them is the fastest way to lock in a concept.",
        minutes: Math.min(15, 2 + open),
        score: 80 + open * 3 + stale,
      });
    }

    if (unseen > 0 && weak[0]) {
      const target = kit.concepts.find((c) => !s.conceptStats[c.id]?.attempts) ?? weak[0].concept;
      out.push({
        id: `${s.id}-learn-${target.id}`,
        subjectId: s.id,
        mode: "learn",
        title: `Learn ${target.name}`,
        reason: `${unseen} concept${unseen > 1 ? "s" : ""} in ${s.name} you haven't practiced yet. Learn first, then test.`,
        focusConcepts: [target.id],
        minutes: 8,
        score: 70 + stale + unseen * 2,
      });
    }

    if (weak[0] && weak[0].stat.attempts > 0 && weak[0].stat.mastery < 70) {
      out.push({
        id: `${s.id}-quiz-${weak[0].concept.id}`,
        subjectId: s.id,
        mode: "quiz",
        title: `Strengthen ${weak[0].concept.name}`,
        reason: `${Math.round(weak[0].stat.mastery)}% mastery — your weakest area in ${s.name}.`,
        focusConcepts: weak.map((w) => w.concept.id),
        minutes: 6,
        score: 75 + (70 - weak[0].stat.mastery) / 2 + stale,
      });
    }

    if (learning >= 4) {
      out.push({
        id: `${s.id}-cards`,
        subjectId: s.id,
        mode: "flashcards",
        title: `${learning} cards still learning in ${s.name}`,
        reason: "A quick flashcard pass keeps these from slipping.",
        minutes: 5,
        score: 55 + learning + stale,
      });
    }

    if (mastery >= 75) {
      out.push({
        id: `${s.id}-challenge`,
        subjectId: s.id,
        mode: "challenge",
        title: `Challenge round: ${s.name}`,
        reason: `${mastery}% overall mastery. Harder questions, double XP.`,
        minutes: 8,
        score: 50 + stale,
      });
    }

    if (!out.some((r) => r.subjectId === s.id)) {
      out.push({
        id: `${s.id}-quiz`,
        subjectId: s.id,
        mode: "quiz",
        title: `Adaptive quiz: ${s.name}`,
        reason: "A mixed quiz that targets whatever you're weakest at.",
        minutes: 6,
        score: 45 + stale,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}
