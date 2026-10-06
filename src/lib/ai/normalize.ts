import type { RawKit } from "./schema";
import type { Difficulty, MCQ, StudyKit, StudyMode } from "../types";
import { uid } from "../utils";

const MODES: StudyMode[] = ["guide", "learn", "flashcards", "quiz", "review", "challenge"];
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

type RawMcq = RawKit["mcqs"][number];

export function normalizeMcq(q: RawMcq, keyToId: Map<string, string>, fallbackConcept: string): MCQ | null {
  const choices = q.choices.map((c) => c.trim()).filter(Boolean);
  if (choices.length < 2 || !q.question.trim()) return null;
  if (q.answerIndex < 0 || q.answerIndex >= choices.length) return null;
  return {
    id: uid("q"),
    question: q.question.trim(),
    choices,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    conceptId: keyToId.get(q.conceptKey) ?? fallbackConcept,
    difficulty: DIFFS.includes(q.difficulty) ? q.difficulty : "medium",
  };
}

/** Converts model output (keyed by concept slugs) into the app's id-based kit. */
export function normalizeKit(raw: RawKit, source: StudyKit["source"]): StudyKit {
  const keyToId = new Map<string, string>();
  const concepts = raw.concepts
    .filter((c) => c.name.trim())
    .map((c) => {
      const id = uid("c");
      keyToId.set(c.key, id);
      return { id, name: c.name.trim(), summary: c.summary };
    });
  if (!concepts.length) {
    const id = uid("c");
    keyToId.set("general", id);
    concepts.push({ id, name: "General", summary: raw.summary });
  }
  const fallback = concepts[0].id;
  const cid = (k: string) => keyToId.get(k) ?? fallback;

  return {
    summary: raw.summary,
    concepts,
    guide: raw.guide.map((g) => ({
      id: uid("g"),
      conceptId: cid(g.conceptKey),
      title: g.title,
      overview: g.overview,
      keyPoints: g.keyPoints,
      formulas: g.formulas,
      steps: g.steps,
      example: g.example && g.example.problem ? g.example : null,
      commonMistakes: g.commonMistakes,
      quickReview: g.quickReview,
    })),
    definitions: raw.definitions.map((d) => ({ id: uid("d"), term: d.term, definition: d.definition, conceptId: cid(d.conceptKey) })),
    formulas: raw.formulas.map((f) => ({ id: uid("f"), name: f.name, expression: f.expression, explanation: f.explanation, conceptId: cid(f.conceptKey) })),
    flashcards: raw.flashcards
      .filter((c) => c.front.trim() && c.back.trim())
      .map((c) => ({ id: uid("card"), front: c.front, back: c.back, conceptId: cid(c.conceptKey) })),
    mcqs: raw.mcqs.map((q) => normalizeMcq(q, keyToId, fallback)).filter((q): q is MCQ => !!q),
    shortAnswers: raw.shortAnswers.map((q) => ({
      id: uid("sa"),
      question: q.question,
      answer: q.answer,
      conceptId: cid(q.conceptKey),
      difficulty: DIFFS.includes(q.difficulty) ? q.difficulty : "medium",
    })),
    problems: raw.problems.map((p) => ({ id: uid("p"), problem: p.problem, solution: p.solution, conceptId: cid(p.conceptKey) })),
    plan: raw.plan.map((p) => ({
      id: uid("plan"),
      title: p.title,
      description: p.description,
      mode: MODES.includes(p.mode) ? p.mode : "quiz",
      minutes: Math.max(1, Math.min(60, p.minutes || 5)),
    })),
    generatedAt: Date.now(),
    source,
  };
}
