// Core domain model for Synapse.

export type RegionId =
  | "analytical"
  | "inquiry"
  | "language"
  | "memory"
  | "systems"
  | "creative";

export type Difficulty = "easy" | "medium" | "hard";

export interface Concept {
  id: string;
  name: string;
  summary: string;
}

export interface GuideSection {
  id: string;
  conceptId: string;
  title: string;
  overview: string;
  keyPoints: string[];
  formulas: { expression: string; meaning: string }[];
  steps: string[];
  example: { problem: string; solution: string } | null;
  commonMistakes: string[];
  quickReview: string[];
}

export interface Definition {
  id: string;
  term: string;
  definition: string;
  conceptId: string;
}

export interface Formula {
  id: string;
  name: string;
  expression: string;
  explanation: string;
  conceptId: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  conceptId: string;
}

export interface MCQ {
  id: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  conceptId: string;
  difficulty: Difficulty;
}

export interface ShortAnswer {
  id: string;
  question: string;
  answer: string;
  conceptId: string;
  difficulty: Difficulty;
}

export interface PracticeProblem {
  id: string;
  problem: string;
  solution: string;
  conceptId: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  mode: StudyMode;
  minutes: number;
}

export interface StudyKit {
  summary: string;
  concepts: Concept[];
  guide: GuideSection[];
  definitions: Definition[];
  formulas: Formula[];
  flashcards: Flashcard[];
  mcqs: MCQ[];
  shortAnswers: ShortAnswer[];
  problems: PracticeProblem[];
  plan: PlanStep[];
  generatedAt: number;
  source: "ai" | "offline";
}

export type MaterialKind = "notes" | "flashcards" | "topics" | "document";

export interface Material {
  id: string;
  kind: MaterialKind;
  title: string;
  text: string;
  addedAt: number;
}

export interface ConceptStat {
  mastery: number; // 0-100
  attempts: number;
  correct: number;
  lastSeen: number;
  mastered: boolean; // has crossed mastery threshold (bonus paid)
}

export interface Mistake {
  id: string;
  itemId: string;
  conceptId: string;
  question: string;
  given: string;
  correct: string;
  at: number;
  resolved: boolean;
}

export type StudyMode = "flashcards" | "quiz" | "learn" | "review" | "challenge" | "guide";

export interface SessionRecord {
  id: string;
  subjectId: string;
  mode: StudyMode;
  startedAt: number;
  durationMs: number;
  xp: number;
  correct: number;
  total: number;
}

export interface Subject {
  id: string;
  name: string;
  region: RegionId;
  createdAt: number;
  materials: Material[];
  kit: StudyKit | null;
  xp: number;
  conceptStats: Record<string, ConceptStat>;
  cardStatus: Record<string, "known" | "learning">;
  mistakes: Mistake[];
  guideRead: string[]; // section ids
  lastStudied: number | null;
}

export interface ActivityEntry {
  id: string;
  at: number;
  subjectId: string | null;
  label: string;
  xp: number;
}

export interface Player {
  xp: number;
  streak: number;
  bestStreak: number;
  lastStudyDay: string | null; // YYYY-MM-DD
  totalStudyMs: number;
  achievements: Record<string, number>; // id -> unlocked at
  cardsReviewed: number;
  questionsAnswered: number;
  perfectQuizzes: number;
  theme: ThemeId;
}

export type ThemeId = "onyx" | "graphite" | "paper";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
}
