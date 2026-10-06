"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ActivityEntry,
  ChatMessage,
  Difficulty,
  Material,
  Player,
  RegionId,
  SessionRecord,
  StudyKit,
  StudyMode,
  Subject,
  ThemeId,
} from "./types";
import { dayKey, daysBetween, uid } from "./utils";
import { XP, MASTERY_THRESHOLD, nextMastery } from "./xp";
import { playerLevel, subjectLevel, titleFor } from "./levels";
import { ACHIEVEMENTS } from "./achievements";
import { DEFAULT_STAT } from "./adaptive";
import { guessRegion } from "./regions";
import { desktop } from "./desktop";

/** Transient UI events (XP pops, level ups, unlocks). Not persisted. */
export type GameEvent =
  | { id: string; kind: "xp"; amount: number; label: string }
  | { id: string; kind: "level"; level: number; title: string }
  | { id: string; kind: "subject-level"; subject: string; level: number }
  | { id: string; kind: "achievement"; name: string; glyph: string }
  | { id: string; kind: "mastered"; concept: string };

export interface AnswerInput {
  itemId: string;
  conceptId: string;
  question: string;
  given: string;
  correctAnswer: string;
  isCorrect: boolean;
  challenge?: boolean;
  difficulty?: Difficulty;
}

interface State {
  player: Player;
  subjects: Subject[];
  sessions: SessionRecord[];
  activity: ActivityEntry[];
  chats: Record<string, ChatMessage[]>; // key: subjectId or "global"

  // transient
  events: GameEvent[];
  assistantOpen: boolean;
  assistantSubjectId: string | null;
  assistantFocus: string | null;
  assistantDraft: string | null;

  createSubject: (name: string, region?: RegionId) => string;
  updateSubject: (id: string, patch: Partial<Pick<Subject, "name" | "region">>) => void;
  deleteSubject: (id: string) => void;
  addMaterial: (subjectId: string, m: Omit<Material, "id" | "addedAt">) => void;
  removeMaterial: (subjectId: string, materialId: string) => void;
  setKit: (subjectId: string, kit: StudyKit) => void;
  editKit: (subjectId: string, fn: (kit: StudyKit) => StudyKit) => void;

  recordCard: (subjectId: string, cardId: string, conceptId: string, known: boolean) => void;
  recordAnswer: (subjectId: string, a: AnswerInput) => number;
  readGuideSection: (subjectId: string, sectionId: string) => void;
  completeLearn: (subjectId: string, conceptId: string) => void;
  resolveMistake: (subjectId: string, itemId: string) => void;
  finishSession: (s: Omit<SessionRecord, "id">, opts?: { quiz?: boolean }) => number;

  addChat: (key: string, msg: Omit<ChatMessage, "id" | "at">) => string;
  patchChat: (key: string, id: string, content: string) => void;
  clearChat: (key: string) => void;

  openAssistant: (opts?: { subjectId?: string | null; focus?: string | null; draft?: string | null }) => void;
  closeAssistant: () => void;
  setAssistantContext: (subjectId: string | null, focus?: string | null) => void;
  dismissEvent: (id: string) => void;
  setTheme: (t: ThemeId) => void;
  resetAll: () => void;
}

const initialPlayer: Player = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastStudyDay: null,
  totalStudyMs: 0,
  achievements: {},
  cardsReviewed: 0,
  questionsAnswered: 0,
  perfectQuizzes: 0,
  theme: "onyx",
};

type Draft = Pick<State, "player" | "subjects" | "sessions" | "activity" | "events">;

/** Grants XP to player (and optionally subject) and queues level-up events. Mutates draft copies. */
function grant(d: Draft, subjectId: string | null, amount: number, label: string) {
  if (amount <= 0) return;
  const beforeP = playerLevel(d.player.xp).level;
  d.player = { ...d.player, xp: d.player.xp + amount };
  const afterP = playerLevel(d.player.xp).level;
  d.events = [...d.events, { id: uid("ev"), kind: "xp", amount, label }];
  if (afterP > beforeP) {
    d.events = [...d.events, { id: uid("ev"), kind: "level", level: afterP, title: titleFor(afterP) }];
  }
  if (subjectId) {
    d.subjects = d.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      const before = subjectLevel(s.xp).level;
      const next = { ...s, xp: s.xp + amount, lastStudied: Date.now() };
      const after = subjectLevel(next.xp).level;
      if (after > before) {
        d.events = [...d.events, { id: uid("ev"), kind: "subject-level", subject: s.name, level: after }];
      }
      return next;
    });
  }
  const last = d.activity[0];
  // Collapse rapid repeated entries of the same label to keep the feed readable.
  if (last && last.label === label && last.subjectId === subjectId && Date.now() - last.at < 10 * 60_000) {
    d.activity = [{ ...last, xp: last.xp + amount, at: Date.now() }, ...d.activity.slice(1)];
  } else {
    d.activity = [{ id: uid("a"), at: Date.now(), subjectId, label, xp: amount }, ...d.activity].slice(0, 120);
  }
}

/** Updates streak on the first study action of a day and pays the streak bonus. */
function touchStreak(d: Draft, subjectId: string | null) {
  const today = dayKey();
  const last = d.player.lastStudyDay;
  if (last === today) return;
  let streak = 1;
  if (last && daysBetween(last, today) === 1) streak = d.player.streak + 1;
  d.player = { ...d.player, streak, bestStreak: Math.max(d.player.bestStreak, streak), lastStudyDay: today };
  const bonus = XP.dailyStreakPerDay * Math.min(streak, XP.streakCap);
  grant(d, subjectId, bonus, streak > 1 ? `${streak}-day streak bonus` : "Daily check-in");
}

function checkAchievements(d: Draft) {
  for (const a of ACHIEVEMENTS) {
    if (d.player.achievements[a.id]) continue;
    if (a.check({ player: d.player, subjects: d.subjects, sessions: d.sessions })) {
      d.player = { ...d.player, achievements: { ...d.player.achievements, [a.id]: Date.now() } };
      d.events = [...d.events, { id: uid("ev"), kind: "achievement", name: a.name, glyph: a.glyph }];
    }
  }
}

function mapSubject(d: Draft, id: string, fn: (s: Subject) => Subject) {
  d.subjects = d.subjects.map((s) => (s.id === id ? fn(s) : s));
}

/**
 * Persistence that never throws. In the desktop app progress goes to a file via the
 * Electron bridge; in a browser it uses localStorage (private mode / quota errors ignored).
 */
const safeStorage = {
  getItem: (k: string) => {
    try {
      const d = desktop();
      if (d) return d.storage.getItem(k);
      return typeof window === "undefined" ? null : window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      const d = desktop();
      if (d) d.storage.setItem(k, v);
      else window.localStorage.setItem(k, v);
    } catch (err) {
      console.warn("Synapse: could not save progress", err);
    }
  },
  removeItem: (k: string) => {
    try {
      const d = desktop();
      if (d) d.storage.removeItem(k);
      else window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Run a mutation against a draft of game state, then commit. */
      const mutate = <T,>(fn: (d: Draft) => T): T => {
        const s = get();
        const d: Draft = {
          player: s.player,
          subjects: s.subjects,
          sessions: s.sessions,
          activity: s.activity,
          events: s.events,
        };
        const result = fn(d);
        checkAchievements(d);
        set(d);
        return result;
      };

      return {
        player: initialPlayer,
        subjects: [],
        sessions: [],
        activity: [],
        chats: {},
        events: [],
        assistantOpen: false,
        assistantSubjectId: null,
        assistantFocus: null,
        assistantDraft: null,

        createSubject: (name, region) => {
          const id = uid("sub");
          const subject: Subject = {
            id,
            name: name.trim(),
            region: region ?? guessRegion(name),
            createdAt: Date.now(),
            materials: [],
            kit: null,
            xp: 0,
            conceptStats: {},
            cardStatus: {},
            mistakes: [],
            guideRead: [],
            lastStudied: null,
          };
          set((s) => ({ subjects: [subject, ...s.subjects] }));
          return id;
        },

        updateSubject: (id, patch) =>
          set((s) => ({ subjects: s.subjects.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

        deleteSubject: (id) =>
          set((s) => {
            const chats = { ...s.chats };
            delete chats[id];
            return {
              subjects: s.subjects.filter((x) => x.id !== id),
              sessions: s.sessions.filter((x) => x.subjectId !== id),
              chats,
            };
          }),

        addMaterial: (subjectId, m) =>
          set((s) => ({
            subjects: s.subjects.map((x) =>
              x.id === subjectId
                ? { ...x, materials: [...x.materials, { ...m, id: uid("mat"), addedAt: Date.now() }] }
                : x,
            ),
          })),

        removeMaterial: (subjectId, materialId) =>
          set((s) => ({
            subjects: s.subjects.map((x) =>
              x.id === subjectId ? { ...x, materials: x.materials.filter((m) => m.id !== materialId) } : x,
            ),
          })),

        setKit: (subjectId, kit) =>
          mutate((d) => {
            const prev = d.subjects.find((s) => s.id === subjectId);
            const first = !prev?.kit;
            mapSubject(d, subjectId, (s) => {
              // Keep stats for concepts that survive regeneration.
              const keep = new Set(kit.concepts.map((c) => c.id));
              const conceptStats = Object.fromEntries(
                Object.entries(s.conceptStats).filter(([k]) => keep.has(k)),
              );
              return { ...s, kit, conceptStats };
            });
            grant(d, subjectId, first ? XP.materialAdded * 2 : XP.materialAdded, first ? "Study kit generated" : "Study kit updated");
          }),

        editKit: (subjectId, fn) =>
          set((s) => ({
            subjects: s.subjects.map((x) => (x.id === subjectId && x.kit ? { ...x, kit: fn(x.kit) } : x)),
          })),

        recordCard: (subjectId, cardId, conceptId, known) =>
          mutate((d) => {
            touchStreak(d, subjectId);
            d.player = { ...d.player, cardsReviewed: d.player.cardsReviewed + 1 };
            let masteredName: string | null = null;
            mapSubject(d, subjectId, (s) => {
              const prev = s.conceptStats[conceptId] ?? DEFAULT_STAT;
              const mastery = nextMastery(prev.mastery, known, 0.45);
              const crossed = !prev.mastered && mastery >= MASTERY_THRESHOLD;
              if (crossed) masteredName = s.kit?.concepts.find((c) => c.id === conceptId)?.name ?? "concept";
              return {
                ...s,
                cardStatus: { ...s.cardStatus, [cardId]: known ? "known" : "learning" },
                conceptStats: {
                  ...s.conceptStats,
                  [conceptId]: { ...prev, mastery, lastSeen: Date.now(), mastered: prev.mastered || crossed },
                },
              };
            });
            grant(d, subjectId, XP.cardReviewed + (known ? XP.cardKnown : 0), "Flashcards");
            if (masteredName) {
              d.events = [...d.events, { id: uid("ev"), kind: "mastered", concept: masteredName }];
              grant(d, subjectId, XP.conceptMastered, `Mastered ${masteredName}`);
            }
          }),

        recordAnswer: (subjectId, a) =>
          mutate((d) => {
            touchStreak(d, subjectId);
            d.player = { ...d.player, questionsAnswered: d.player.questionsAnswered + 1 };
            let masteredName: string | null = null;
            const weight = a.difficulty === "hard" ? 1.25 : a.difficulty === "easy" ? 0.8 : 1;
            mapSubject(d, subjectId, (s) => {
              const prev = s.conceptStats[a.conceptId] ?? DEFAULT_STAT;
              const mastery = nextMastery(prev.mastery, a.isCorrect, weight);
              const crossed = !prev.mastered && mastery >= MASTERY_THRESHOLD;
              if (crossed) masteredName = s.kit?.concepts.find((c) => c.id === a.conceptId)?.name ?? "concept";
              let mistakes = s.mistakes;
              if (a.isCorrect) {
                mistakes = mistakes.map((m) => (m.itemId === a.itemId ? { ...m, resolved: true } : m));
              } else {
                mistakes = [
                  {
                    id: uid("mis"),
                    itemId: a.itemId,
                    conceptId: a.conceptId,
                    question: a.question,
                    given: a.given,
                    correct: a.correctAnswer,
                    at: Date.now(),
                    resolved: false,
                  },
                  ...mistakes.filter((m) => m.itemId !== a.itemId),
                ].slice(0, 200);
              }
              return {
                ...s,
                mistakes,
                conceptStats: {
                  ...s.conceptStats,
                  [a.conceptId]: {
                    mastery,
                    attempts: prev.attempts + 1,
                    correct: prev.correct + (a.isCorrect ? 1 : 0),
                    lastSeen: Date.now(),
                    mastered: prev.mastered || crossed,
                  },
                },
              };
            });
            const amount = a.isCorrect ? (a.challenge ? XP.correctChallenge : XP.correct) : XP.wrongEffort;
            grant(d, subjectId, amount, a.challenge ? "Challenge" : "Questions");
            if (masteredName) {
              d.events = [...d.events, { id: uid("ev"), kind: "mastered", concept: masteredName }];
              grant(d, subjectId, XP.conceptMastered, `Mastered ${masteredName}`);
            }
            return amount;
          }),

        readGuideSection: (subjectId, sectionId) =>
          mutate((d) => {
            const s = d.subjects.find((x) => x.id === subjectId);
            if (!s || s.guideRead.includes(sectionId)) return;
            touchStreak(d, subjectId);
            const guideRead = [...s.guideRead, sectionId];
            mapSubject(d, subjectId, (x) => ({ ...x, guideRead }));
            grant(d, subjectId, XP.guideSection, "Study guide");
            const total = s.kit?.guide.length ?? 0;
            if (total > 0 && s.kit!.guide.every((g) => guideRead.includes(g.id))) {
              grant(d, subjectId, XP.guideComplete, "Completed study guide");
            }
          }),

        completeLearn: (subjectId, conceptId) =>
          mutate((d) => {
            const name = d.subjects.find((x) => x.id === subjectId)?.kit?.concepts.find((c) => c.id === conceptId)?.name;
            grant(d, subjectId, XP.learnConcept, `Learned ${name ?? "concept"}`);
          }),

        resolveMistake: (subjectId, itemId) =>
          set((s) => ({
            subjects: s.subjects.map((x) =>
              x.id === subjectId
                ? { ...x, mistakes: x.mistakes.map((m) => (m.itemId === itemId ? { ...m, resolved: true } : m)) }
                : x,
            ),
          })),

        finishSession: (rec, opts) =>
          mutate((d) => {
            let bonus = 0;
            if (opts?.quiz && rec.total > 0) {
              bonus += XP.quizComplete;
              const pct = rec.correct / rec.total;
              if (pct >= 0.8) bonus += XP.quizStrong;
              if (pct === 1 && rec.total >= 5) {
                bonus += XP.perfectQuiz;
                d.player = { ...d.player, perfectQuizzes: d.player.perfectQuizzes + 1 };
              }
            }
            const durationMs = Math.min(rec.durationMs, 3 * 3_600_000);
            d.player = { ...d.player, totalStudyMs: d.player.totalStudyMs + durationMs };
            d.sessions = [{ ...rec, durationMs, xp: rec.xp + bonus, id: uid("ses") }, ...d.sessions].slice(0, 500);
            mapSubject(d, rec.subjectId, (s) => ({ ...s, lastStudied: Date.now() }));
            if (bonus) grant(d, rec.subjectId, bonus, "Session complete");
            return bonus;
          }),

        addChat: (key, msg) => {
          const id = uid("m");
          set((s) => ({
            chats: { ...s.chats, [key]: [...(s.chats[key] ?? []), { ...msg, id, at: Date.now() }].slice(-80) },
          }));
          return id;
        },
        patchChat: (key, id, content) =>
          set((s) => ({
            chats: { ...s.chats, [key]: (s.chats[key] ?? []).map((m) => (m.id === id ? { ...m, content } : m)) },
          })),
        clearChat: (key) => set((s) => ({ chats: { ...s.chats, [key]: [] } })),

        openAssistant: (opts) =>
          set((s) => ({
            assistantOpen: true,
            assistantSubjectId: opts?.subjectId !== undefined ? opts.subjectId : s.assistantSubjectId,
            assistantFocus: opts?.focus !== undefined ? opts.focus : s.assistantFocus,
            assistantDraft: opts?.draft ?? null,
          })),
        closeAssistant: () => set({ assistantOpen: false, assistantDraft: null }),
        setAssistantContext: (subjectId, focus = null) => set({ assistantSubjectId: subjectId, assistantFocus: focus }),
        dismissEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
        setTheme: (theme) => set((s) => ({ player: { ...s.player, theme } })),
        resetAll: () =>
          set({ player: initialPlayer, subjects: [], sessions: [], activity: [], chats: {}, events: [] }),
      };
    },
    {
      name: "synapse-v1",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        player: s.player,
        subjects: s.subjects,
        sessions: s.sessions,
        activity: s.activity,
        chats: s.chats,
      }),
    },
  ),
);

export const useSubject = (id: string | null | undefined) =>
  useStore((s) => (id ? s.subjects.find((x) => x.id === id) ?? null : null));

export type { StudyMode };
