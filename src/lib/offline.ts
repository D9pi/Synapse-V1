// Heuristic study-kit generator used when no AI key is configured (or the AI call fails).
// It is deliberately simple but produces a complete, playable kit from structured notes.
import type { RawKit } from "./ai/schema";
import { shuffle } from "./utils";

const STOP = new Set(
  "a an the and or but of to in on for with by as at from is are was were be been being this that these those it its into than then so such can will would should could may might must do does did not no yes if when which who whom what where why how also very more most less least each other some any all both either neither your you we they he she i our their there here about over under between through during before after above below up down out off again further once only own same too just".split(
    " ",
  ),
);

export function parseFlashcards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    const m =
      line.match(/^(.{1,120}?)\t+(.+)$/) ||
      line.match(/^(.{1,120}?)\s+[-–—]\s+(.+)$/) ||
      line.match(/^(.{1,120}?)\s*::?\s+(.+)$/) ||
      line.match(/^(.{1,80}?)\s*;\s*(.+)$/);
    if (m && m[1].trim() && m[2].trim()) out.push({ front: m[1].trim(), back: m[2].trim() });
  }
  return out;
}

interface Section {
  title: string;
  lines: string[];
}

function isHeading(line: string, next: string | undefined): boolean {
  const t = line.trim();
  if (/^#{1,6}\s+/.test(t)) return true;
  if (/^[A-Z0-9][A-Z0-9 &/,'()-]{2,60}$/.test(t) && /[A-Z]{3}/.test(t)) return true;
  if (/^[^.!?]{2,60}:$/.test(t)) return true;
  if (/^(unit|chapter|section|topic|lesson|part)\s+\w+/i.test(t) && t.length < 70 && !/[.]$/.test(t)) return true;
  if (next && t.length < 45 && !/[.:;,=?]$/.test(t) && !/^[-*•\d]/.test(t) && /^[A-Z]/.test(t) && next.trim().length > t.length && /^[-*•]/.test(next.trim()))
    return true;
  return false;
}

function cleanHeading(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim().replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());
}

function splitSections(text: string): Section[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const sections: Section[] = [];
  let cur: Section | null = null;
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    if (isHeading(line, lines.slice(i + 1).find((l) => l.trim()))) {
      cur = { title: cleanHeading(line), lines: [] };
      sections.push(cur);
    } else {
      if (!cur) {
        cur = { title: "", lines: [] };
        sections.push(cur);
      }
      cur.lines.push(line.trim());
    }
  });
  const filled = sections.filter((s) => s.lines.length);
  if (filled.length >= 2) return filled.map((s, i) => ({ ...s, title: s.title || topKeyword(s.lines.join(" ")) || `Part ${i + 1}` }));

  // No structure: chunk sentences.
  const sentences = sentencesOf(text);
  const size = Math.max(4, Math.ceil(sentences.length / 5));
  const chunks: Section[] = [];
  for (let i = 0; i < sentences.length; i += size) {
    const body = sentences.slice(i, i + size);
    chunks.push({ title: topKeyword(body.join(" ")) || `Part ${chunks.length + 1}`, lines: body });
  }
  return chunks.length ? chunks : [{ title: "Overview", lines: [text.trim()] }];
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\r?\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function topKeyword(text: string): string {
  const counts = new Map<string, number>();
  const phrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  for (const p of phrases) {
    if (STOP.has(p.toLowerCase())) continue;
    counts.set(p, (counts.get(p) ?? 0) + 2);
  }
  for (const w of text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? []) {
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = "";
  let n = 0;
  counts.forEach((v, k) => {
    if (v > n) {
      n = v;
      best = k;
    }
  });
  return best ? best[0].toUpperCase() + best.slice(1) : "";
}

const stripBullet = (l: string) => l.replace(/^\s*(?:[-*•]|\d+[.)]|step\s*\d+[:.)]?)\s*/i, "").trim();

const NOT_TERM = /^(example|ex|e\.g|solution|answer|sol|note|step|mistake|common mistake|common error|tip|if|when|remember|warning|important)\b/i;
const EXAMPLE_LINE = /^(example|ex\b|e\.g\.|solution|answer|sol\b|step\s*\d)/i;

function extractDefinitions(lines: string[]): { term: string; definition: string }[] {
  const out: { term: string; definition: string }[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (EXAMPLE_LINE.test(line)) continue;
    let m = line.match(/^([^:–—\t=]{2,60}?)\s*(?::|\t| [-–—] )\s*(.{6,})$/);
    if (m && m[1].split(/\s+/).length <= 6 && !NOT_TERM.test(m[1]) && (m[2].match(/[A-Za-z]{3,}/g) ?? []).length >= 2) {
      out.push({ term: m[1].trim(), definition: m[2].trim() });
      continue;
    }
    if (/=/.test(line)) continue;
    m = line.match(/^(?:an?\s+|the\s+)?([A-Za-z][\w\s'()-]{1,50}?)\s+(?:is|are|refers to|means|describes)\s+(.{8,})$/i);
    if (m && m[1].split(/\s+/).length <= 5 && !STOP.has(m[1].toLowerCase()) && !NOT_TERM.test(m[1])) {
      out.push({ term: m[1].trim().replace(/^\w/, (c) => c.toUpperCase()), definition: m[2].trim().replace(/\.$/, "") });
    }
  }
  return out;
}

/** Pulls short math expressions (containing "=") out of lines. */
function extractFormulas(lines: string[]): { name: string; expression: string }[] {
  const out: { name: string; expression: string }[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!/=/.test(line) || EXAMPLE_LINE.test(line) || line.length > 200) continue;
    const named = line.match(/^([A-Za-z][^:=]{2,50}):\s*(.+)$/);
    const body = named ? named[2] : line;
    const exprMatch = body.match(/[^,;:]*=[^,;]*/);
    if (!exprMatch) continue;
    let expr = exprMatch[0].trim().replace(/\.$/, "");
    // Trim leading prose such as "at x = ..." or "means bˣ = y".
    expr = expr.replace(/^(?:[a-z]+\s+){1,6}(?=[A-Za-z0-9(√−-]\S*\s*[=(])/i, (pre) => (/^[a-z]+\s+$/i.test(pre) && pre.length > 4 ? "" : pre));
    expr = expr.replace(/\s+where\s+.*/i, "");
    const proseWords = (expr.match(/\b[a-zA-Z]{4,}\b/g) ?? []).length;
    if (proseWords > 2 || expr.length > 60 || expr.length < 3) continue;
    out.push({ name: named ? named[1].trim() : "", expression: expr });
  }
  return out;
}

function trunc(s: string, n = 140) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function pickDistractors(pool: string[], correct: string, n = 3, fillers: string[] = []): string[] {
  const options = shuffle(pool.filter((p) => p && p !== correct));
  const out = options.slice(0, n);
  for (const f of fillers) if (out.length < n && f !== correct && !out.includes(f)) out.push(f);
  return out;
}

const slug = (s: string, i: number) =>
  (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "concept") + "-" + i;

export function generateOfflineKit(subjectName: string, text: string): RawKit {
  const sections = splitSections(text).slice(0, 10);
  const concepts = sections.map((s, i) => {
    const sents = sentencesOf(s.lines.map(stripBullet).join(". ").replace(/\.\./g, "."));
    return {
      key: slug(s.title, i),
      name: s.title,
      summary: trunc(sents[0] ?? s.lines[0] ?? s.title, 220),
    };
  });

  const definitions: RawKit["definitions"] = [];
  const formulas: RawKit["formulas"] = [];
  const guide: RawKit["guide"] = [];

  sections.forEach((s, i) => {
    const key = concepts[i].key;
    const defs = extractDefinitions(s.lines);
    const forms = extractFormulas(s.lines);
    defs.forEach((d) => definitions.push({ ...d, conceptKey: key }));
    forms.forEach((f, j) =>
      formulas.push({ name: f.name || `${s.title} formula${forms.length > 1 ? ` ${j + 1}` : ""}`, expression: f.expression, explanation: f.name ? `Formula for ${f.name.toLowerCase()}.` : `Key relationship in ${s.title}.`, conceptKey: key }),
    );

    const steps = s.lines.filter((l) => /^\s*(step\s*\d|\d+[.)])/i.test(l)).map(stripBullet);
    const mistakes = s.lines.filter((l) => /mistake|don't|do not|avoid|careful|common error|forget/i.test(l)).map(stripBullet);
    const exIdx = s.lines.findIndex((l) => /^(example|ex\b|e\.g\.)/i.test(stripBullet(l)));
    let example: { problem: string; solution: string } | null = null;
    if (exIdx >= 0) {
      const problem = stripBullet(s.lines[exIdx]).replace(/^(example|ex)\s*\d*[:.)-]?\s*/i, "");
      const rest = s.lines.slice(exIdx + 1, exIdx + 4).map(stripBullet);
      const solIdx = rest.findIndex((l) => /^(solution|answer|sol)\b/i.test(l));
      const solution = (solIdx >= 0 ? rest.slice(solIdx) : rest).join(" ").replace(/^(solution|answer|sol)\s*[:.-]?\s*/i, "");
      if (problem) example = { problem, solution: solution || "Work through it using the steps above." };
    }
    const used = new Set([...steps, ...mistakes]);
    const keyPoints = s.lines
      .map(stripBullet)
      .filter((l) => !used.has(l) && l.length > 3 && !EXAMPLE_LINE.test(l) && l.replace(/\.$/, "") !== concepts[i].summary.replace(/\.$/, ""))
      .slice(0, 8);
    guide.push({
      conceptKey: key,
      title: s.title,
      overview: concepts[i].summary,
      keyPoints,
      formulas: forms.map((f) => ({ expression: f.expression, meaning: f.name || "Key relationship" })),
      steps,
      example,
      commonMistakes: mistakes,
      quickReview: [
        ...defs.slice(0, 3).map((d) => `${d.term}: ${trunc(d.definition, 80)}`),
        ...forms.slice(0, 2).map((f) => f.expression),
      ].slice(0, 5),
    });
  });

  // Flashcards
  const flashcards: RawKit["flashcards"] = [
    ...definitions.map((d) => ({ front: d.term, back: d.definition, conceptKey: d.conceptKey })),
    ...formulas.map((f) => ({ front: `Formula: ${f.name}`, back: f.expression, conceptKey: f.conceptKey })),
    ...concepts.map((c) => ({ front: `What is ${c.name}?`, back: c.summary, conceptKey: c.key })),
  ];

  // Multiple choice
  const allDefs = definitions.map((d) => trunc(d.definition));
  const allTerms = definitions.map((d) => d.term);
  const conceptNames = concepts.map((c) => c.name);
  const conceptSummaries = concepts.map((c) => trunc(c.summary));
  const genericTerms = ["None of the above", "A related but different idea", "The inverse relationship"];
  const mcqs: RawKit["mcqs"] = [];
  const mk = (question: string, correct: string, distractors: string[], explanation: string, conceptKey: string, difficulty: "easy" | "medium" | "hard") => {
    if (distractors.length < 2) return;
    const choices = shuffle([correct, ...distractors]);
    mcqs.push({ question, choices, answerIndex: choices.indexOf(correct), explanation, conceptKey, difficulty });
  };

  definitions.forEach((d) => {
    const def = trunc(d.definition);
    mk(`Which best describes "${d.term}"?`, def, pickDistractors(allDefs, def, 3, conceptSummaries), `${d.term}: ${d.definition}`, d.conceptKey, "easy");
    mk(`Which term matches this description?\n"${def}"`, d.term, pickDistractors(allTerms, d.term, 3, [...conceptNames, ...genericTerms]), `This describes ${d.term}.`, d.conceptKey, "medium");
  });
  const allExpr = formulas.map((f) => f.expression);
  formulas.forEach((f) => {
    mk(`Which expression is the ${f.name}?`, f.expression, pickDistractors(allExpr, f.expression, 3, ["a² + b² = c", "x = -b / 2a", "y = mx"]), `${f.name}: ${f.expression}`, f.conceptKey, "medium");
  });
  concepts.forEach((c) => {
    mk(`Which statement is about ${c.name}?`, trunc(c.summary), pickDistractors(conceptSummaries, trunc(c.summary), 3, allDefs), c.summary, c.key, "medium");
  });
  // Cloze questions on key points (harder)
  guide.forEach((g) => {
    for (const point of g.keyPoints.slice(0, 3)) {
      const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const term = allTerms.find(
        (t) => t.length > 2 && new RegExp(`\\b${esc(t)}\\b`, "i").test(point) && !point.toLowerCase().startsWith(t.toLowerCase()),
      );
      if (!term) continue;
      const blanked = point.replace(new RegExp(`\\b${esc(term)}\\b`, "i"), "_____");
      mk(`Fill in the blank:\n${blanked}`, term, pickDistractors(allTerms, term, 3, conceptNames), point, g.conceptKey, "hard");
    }
  });

  const shortAnswers: RawKit["shortAnswers"] = [
    ...concepts.map((c) => ({ question: `In your own words, explain ${c.name}.`, answer: c.summary, conceptKey: c.key, difficulty: "medium" as const })),
    ...definitions.slice(0, 12).map((d) => ({ question: `Define: ${d.term}`, answer: d.definition, conceptKey: d.conceptKey, difficulty: "easy" as const })),
  ];

  const problems: RawKit["problems"] = guide
    .filter((g) => g.example)
    .map((g) => ({ problem: g.example!.problem, solution: g.example!.solution, conceptKey: g.conceptKey }));

  const plan: RawKit["plan"] = [
    { title: "Read the study guide", description: "Skim every section once. Focus on key points and formulas.", mode: "guide", minutes: 10 },
    { title: "Learn each concept", description: "Short teach-then-test rounds for anything new.", mode: "learn", minutes: 10 },
    { title: "Flashcard pass", description: "Mark cards Known or Still learning to build your review queue.", mode: "flashcards", minutes: 8 },
    { title: "Adaptive quiz", description: "Questions target your weakest concepts automatically.", mode: "quiz", minutes: 8 },
    { title: "Review mistakes", description: "Re-attempt everything you missed.", mode: "review", minutes: 5 },
    { title: "Challenge round", description: "Harder questions for double XP once mastery is above 75%.", mode: "challenge", minutes: 8 },
  ];

  return {
    summary: `${subjectName}: ${concepts.length} concept${concepts.length === 1 ? "" : "s"} — ${concepts.slice(0, 4).map((c) => c.name).join(", ")}${concepts.length > 4 ? "…" : ""}.`,
    concepts,
    guide,
    definitions,
    formulas,
    flashcards,
    mcqs,
    shortAnswers,
    problems,
    plan,
  };
}

/** Very small fallback grader for short answers: keyword overlap. */
export function gradeOffline(expected: string, given: string): { verdict: "correct" | "partial" | "incorrect"; feedback: string } {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((w) => !STOP.has(w)) ?? []);
  const exp = words(expected);
  const got = words(given);
  if (!exp.size) return { verdict: given.trim() ? "partial" : "incorrect", feedback: "Compare your answer with the model answer." };
  let hit = 0;
  exp.forEach((w) => got.has(w) && hit++);
  const ratio = hit / exp.size;
  if (ratio >= 0.5) return { verdict: "correct", feedback: "You covered the key ideas." };
  if (ratio >= 0.2) return { verdict: "partial", feedback: "You're on the right track, but some key ideas are missing. Compare with the model answer." };
  return { verdict: "incorrect", feedback: "This misses the main idea. Review the model answer, then try explaining it again." };
}
