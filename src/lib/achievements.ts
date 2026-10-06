import type { Player, Subject, SessionRecord } from "./types";
import { playerLevel, subjectLevel } from "./levels";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  glyph: string; // single minimalist glyph
  check: (ctx: { player: Player; subjects: Subject[]; sessions: SessionRecord[] }) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-session", name: "First Signal", description: "Complete your first study session.", glyph: "◆", check: ({ sessions }) => sessions.length >= 1 },
  { id: "first-kit", name: "Architect", description: "Generate your first study kit.", glyph: "▲", check: ({ subjects }) => subjects.some((s) => s.kit) },
  { id: "cards-100", name: "Recall Engine", description: "Review 100 flashcards.", glyph: "▣", check: ({ player }) => player.cardsReviewed >= 100 },
  { id: "questions-250", name: "Relentless", description: "Answer 250 questions.", glyph: "✕", check: ({ player }) => player.questionsAnswered >= 250 },
  { id: "perfect-quiz", name: "Flawless", description: "Score 100% on a quiz of 5+ questions.", glyph: "○", check: ({ player }) => player.perfectQuizzes >= 1 },
  { id: "streak-3", name: "Momentum", description: "Study 3 days in a row.", glyph: "≡", check: ({ player }) => player.bestStreak >= 3 },
  { id: "streak-7", name: "Unbroken", description: "Study 7 days in a row.", glyph: "∞", check: ({ player }) => player.bestStreak >= 7 },
  { id: "master-concept", name: "Deep Focus", description: "Master a concept (85%+).", glyph: "◎", check: ({ subjects }) => subjects.some((s) => Object.values(s.conceptStats).some((c) => c.mastered)) },
  { id: "subject-5", name: "Specialist", description: "Reach level 5 in a subject.", glyph: "◈", check: ({ subjects }) => subjects.some((s) => subjectLevel(s.xp).level >= 5) },
  { id: "three-regions", name: "Wide Mind", description: "Activate 3 brain regions.", glyph: "✳", check: ({ subjects }) => new Set(subjects.filter((s) => s.xp > 0).map((s) => s.region)).size >= 3 },
  { id: "level-5", name: "Ascendant", description: "Reach player level 5.", glyph: "△", check: ({ player }) => playerLevel(player.xp).level >= 5 },
  { id: "hour", name: "Deep Work", description: "Accumulate 1 hour of study time.", glyph: "◷", check: ({ player }) => player.totalStudyMs >= 3_600_000 },
];

export const THEMES = [
  { id: "onyx", name: "Onyx", description: "Pure black. The default.", unlockLevel: 1 },
  { id: "graphite", name: "Graphite", description: "Soft charcoal surfaces.", unlockLevel: 4 },
  { id: "paper", name: "Paper", description: "Inverted. Ink on white.", unlockLevel: 8 },
] as const;
