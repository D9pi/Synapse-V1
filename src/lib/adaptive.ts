import type { ConceptStat, MCQ, Subject, Flashcard, Difficulty } from "./types";
import { shuffle } from "./utils";

export const DEFAULT_STAT: ConceptStat = { mastery: 0, attempts: 0, correct: 0, lastSeen: 0, mastered: false };

export function statFor(subject: Subject, conceptId: string): ConceptStat {
  return subject.conceptStats[conceptId] ?? DEFAULT_STAT;
}

export function subjectMastery(subject: Subject): number {
  const concepts = subject.kit?.concepts ?? [];
  if (!concepts.length) return 0;
  const sum = concepts.reduce((acc, c) => acc + statFor(subject, c.id).mastery, 0);
  return Math.round(sum / concepts.length);
}

/** Higher weight = more in need of practice. */
export function conceptWeight(subject: Subject, conceptId: string): number {
  const s = statFor(subject, conceptId);
  const unseen = s.attempts === 0 ? 25 : 0;
  const openMistakes = subject.mistakes.filter((m) => m.conceptId === conceptId && !m.resolved).length;
  const staleDays = s.lastSeen ? (Date.now() - s.lastSeen) / 86_400_000 : 0;
  return 5 + (100 - s.mastery) + unseen + openMistakes * 15 + Math.min(staleDays, 14) * 2;
}

export function weakestConcepts(subject: Subject, n = 3) {
  const concepts = subject.kit?.concepts ?? [];
  return [...concepts]
    .map((c) => ({ concept: c, stat: statFor(subject, c.id), weight: conceptWeight(subject, c.id) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n);
}

function weightedPick<T>(items: T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((a, t) => a + weight(t), 0);
  let r = Math.random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

const diffRank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Build an adaptive question set, biased toward weak concepts. */
export function buildQuiz(
  subject: Subject,
  opts: { count: number; focusConcepts?: string[]; minDifficulty?: Difficulty; pool?: MCQ[] },
): MCQ[] {
  let pool = opts.pool ?? subject.kit?.mcqs ?? [];
  if (opts.focusConcepts?.length) {
    const focused = pool.filter((q) => opts.focusConcepts!.includes(q.conceptId));
    if (focused.length) pool = focused;
  }
  if (opts.minDifficulty) {
    const min = diffRank[opts.minDifficulty];
    const harder = pool.filter((q) => diffRank[q.difficulty] >= min);
    if (harder.length >= Math.min(opts.count, 3)) pool = harder;
  }
  const remaining = [...pool];
  const picked: MCQ[] = [];
  while (picked.length < opts.count && remaining.length) {
    const q = weightedPick(remaining, (x) => conceptWeight(subject, x.conceptId))!;
    picked.push(q);
    remaining.splice(remaining.indexOf(q), 1);
  }
  return picked;
}

/** When a concept is missed, find a follow-up question on the same concept not already queued. */
export function followUpFor(subject: Subject, missed: MCQ, queued: MCQ[], pool?: MCQ[]): MCQ | null {
  const source = pool ?? subject.kit?.mcqs ?? [];
  const ids = new Set(queued.map((q) => q.id));
  const candidates = source.filter((q) => q.conceptId === missed.conceptId && !ids.has(q.id));
  return candidates.length ? shuffle(candidates)[0] : null;
}

/** Order flashcards: still-learning and weak concepts first. */
export function orderCards(subject: Subject, cards: Flashcard[]): Flashcard[] {
  return [...cards]
    .map((c) => ({
      c,
      w:
        conceptWeight(subject, c.conceptId) +
        (subject.cardStatus[c.id] === "learning" ? 60 : subject.cardStatus[c.id] === "known" ? -40 : 20) +
        Math.random() * 30,
    }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.c);
}

export function shuffleChoices(q: MCQ): MCQ {
  const order = shuffle(q.choices.map((_, i) => i));
  return {
    ...q,
    choices: order.map((i) => q.choices[i]),
    answerIndex: order.indexOf(q.answerIndex),
  };
}
