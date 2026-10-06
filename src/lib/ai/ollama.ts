import "server-only";
import * as z from "zod";
import { AIError } from "./errors";
import { KitSchema, QuestionBatchSchema, GradeSchema, McqSchema, type RawKit } from "./schema";

// Local AI via Ollama (https://ollama.com): free, runs on the user's own computer.
// Small local models are less reliable with big JSON documents, so the study kit is
// generated in steps (outline first, then one concept at a time) and every response is
// coerced into shape instead of trusted.

export const OLLAMA_DEFAULT_MODEL = "qwen2.5:7b";

export function ollamaHost(): string {
  return (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
}

const NOT_RUNNING = "Local AI isn't running. Open the Ollama app (or run “ollama serve”), then try again.";

async function request(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${ollamaHost()}${path}`, init);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new AIError(NOT_RUNNING, 503);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const msg = body.error ?? `Local AI error (${res.status})`;
    if (res.status === 404 || /not found/i.test(msg)) {
      throw new AIError(`The local model “${ollamaModel()}” isn't downloaded yet. Download it in Settings → AI.`, 404);
    }
    throw new AIError(`Local AI error: ${msg}`, 502);
  }
  return res;
}

/** Removes reasoning blocks some local models emit before their answer. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trimStart();
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function chatJSON(schema: z.ZodType, messages: Msg[], opts: { numCtx?: number; numPredict?: number } = {}): Promise<unknown> {
  const format = z.toJSONSchema(schema);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel(),
        messages:
          attempt === 0
            ? messages
            : [...messages, { role: "user", content: `Your previous reply was not valid JSON (${lastError}). Reply again with only valid JSON matching the schema.` }],
        stream: false,
        format,
        options: { temperature: 0.3, num_ctx: opts.numCtx ?? 16384, num_predict: opts.numPredict ?? 4096 },
      }),
    });
    const data = (await res.json()) as { message?: { content?: string } };
    const text = stripThinking(data.message?.content ?? "");
    try {
      return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  throw new AIError("The local model returned unreadable output. Try again, or pick a larger model in Settings.", 502);
}

// ---------- coercion helpers: accept whatever a small model produced ----------

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const diff = (v: unknown): "easy" | "medium" | "hard" => (v === "easy" || v === "hard" ? v : "medium");

function coerceMcq(v: unknown, conceptKey: string): RawKit["mcqs"][number] | null {
  const o = obj(v);
  const choices = strs(o.choices);
  let answerIndex = typeof o.answerIndex === "number" ? Math.round(o.answerIndex) : Number(o.answerIndex);
  // Some models answer with the choice text instead of an index.
  if (!Number.isFinite(answerIndex) && typeof o.answer === "string") answerIndex = choices.indexOf(o.answer);
  if (!str(o.question) || choices.length < 2 || !(answerIndex >= 0 && answerIndex < choices.length)) return null;
  return { question: str(o.question), choices, answerIndex, explanation: str(o.explanation), conceptKey: str(o.conceptKey) || conceptKey, difficulty: diff(o.difficulty) };
}

// ---------- prompts ----------

const SYSTEM = `You are Synapse, an expert tutor who turns a student's class notes into study material.
Be accurate and faithful to the notes. Write clearly for a student. Use plain text and Unicode for math (x², √, π), never LaTeX.
Always reply with JSON only, matching the requested schema exactly.`;

const OutlineSchema = z.object({
  summary: z.string(),
  concepts: z.array(z.object({ key: z.string(), name: z.string(), summary: z.string() })),
});

const PackSchema = z.object({
  title: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  formulas: z.array(z.object({ expression: z.string(), meaning: z.string() })),
  steps: z.array(z.string()),
  example: z.object({ problem: z.string(), solution: z.string() }).nullable(),
  commonMistakes: z.array(z.string()),
  quickReview: z.array(z.string()),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  mcqs: z.array(McqSchema.omit({ conceptKey: true })),
  shortAnswers: z.array(z.object({ question: z.string(), answer: z.string() })),
  practiceProblems: z.array(z.object({ problem: z.string(), solution: z.string() })),
});

const MATERIAL_LIMIT = 24_000;

export async function generateKitOllama(subjectName: string, material: string): Promise<RawKit> {
  const notes = material.length > MATERIAL_LIMIT ? material.slice(0, MATERIAL_LIMIT) + "\n[…notes truncated…]" : material;

  // 1) Outline: the concepts to teach.
  const outline = obj(
    await chatJSON(OutlineSchema, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Course: ${subjectName}\n\n<notes>\n${notes}\n</notes>\n\nList the 3-8 main concepts a student must learn from these notes, in teaching order. "key" is a short lowercase slug. Also write a one-sentence summary of the material.`,
      },
    ]),
  );
  const concepts = arr(outline.concepts)
    .map((c, i) => {
      const o = obj(c);
      const name = str(o.name);
      return { key: str(o.key) || `concept-${i + 1}`, name, summary: str(o.summary) || name };
    })
    .filter((c) => c.name)
    .slice(0, 8);
  if (!concepts.length) throw new AIError("The local model couldn't find concepts in this material.", 502);

  const kit: RawKit = {
    summary: str(outline.summary) || `${subjectName}: ${concepts.map((c) => c.name).join(", ")}.`,
    concepts,
    guide: [],
    definitions: [],
    formulas: [],
    flashcards: [],
    mcqs: [],
    shortAnswers: [],
    problems: [],
    plan: [
      { title: "Read the study guide", description: "Go through each section once, focusing on key points.", mode: "guide", minutes: 10 },
      { title: "Learn each concept", description: "Teach-then-test rounds for anything new.", mode: "learn", minutes: 10 },
      { title: "Flashcard pass", description: "Mark cards Known or Still learning.", mode: "flashcards", minutes: 8 },
      { title: "Adaptive quiz", description: "Questions focus on your weakest concepts.", mode: "quiz", minutes: 8 },
      { title: "Review mistakes", description: "Re-attempt everything you missed.", mode: "review", minutes: 5 },
      { title: "Challenge round", description: "Harder questions for double XP.", mode: "challenge", minutes: 8 },
    ],
  };

  // 2) One concept at a time: guide section, cards, questions.
  for (const c of concepts) {
    let pack: Record<string, unknown>;
    try {
      pack = obj(
        await chatJSON(PackSchema, [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Course: ${subjectName}\nAll concepts: ${concepts.map((x) => x.name).join(", ")}\n\n<notes>\n${notes}\n</notes>\n\nCreate study material for ONE concept: "${c.name}" (${c.summary}).
- overview: explain what it is and why it matters, in simple language.
- keyPoints: 3-6 important facts. formulas: only if the concept has formulas. steps: only if it's a procedure.
- example: a worked example with full solution, or null if not applicable.
- commonMistakes: 1-3 mistakes students make. quickReview: 2-4 terse facts.
- definitions: key terms for this concept.
- flashcards: 4-6 cards, one fact each.
- mcqs: 4 multiple-choice questions, exactly 4 choices each, answerIndex is the 0-based index of the correct choice, mix of easy/medium/hard.
- shortAnswers: 1-2 questions with model answers. practiceProblems: 0-2 if the subject has problems to solve.`,
          },
        ]),
      );
    } catch (err) {
      console.error(`[ollama] concept "${c.name}" failed:`, (err as Error).message);
      continue;
    }
    const ex = obj(pack.example);
    kit.guide.push({
      conceptKey: c.key,
      title: str(pack.title) || c.name,
      overview: str(pack.overview) || c.summary,
      keyPoints: strs(pack.keyPoints),
      formulas: arr(pack.formulas).map(obj).map((f) => ({ expression: str(f.expression), meaning: str(f.meaning) })).filter((f) => f.expression),
      steps: strs(pack.steps),
      example: str(ex.problem) ? { problem: str(ex.problem), solution: str(ex.solution) } : null,
      commonMistakes: strs(pack.commonMistakes),
      quickReview: strs(pack.quickReview),
    });
    for (const d of arr(pack.definitions).map(obj)) if (str(d.term) && str(d.definition)) kit.definitions.push({ term: str(d.term), definition: str(d.definition), conceptKey: c.key });
    for (const f of arr(pack.formulas).map(obj)) if (str(f.expression)) kit.formulas.push({ name: str(f.meaning) || c.name, expression: str(f.expression), explanation: str(f.meaning), conceptKey: c.key });
    for (const f of arr(pack.flashcards).map(obj)) if (str(f.front) && str(f.back)) kit.flashcards.push({ front: str(f.front), back: str(f.back), conceptKey: c.key });
    for (const q of arr(pack.mcqs)) {
      const m = coerceMcq(q, c.key);
      if (m) kit.mcqs.push({ ...m, conceptKey: c.key });
    }
    for (const s of arr(pack.shortAnswers).map(obj)) if (str(s.question) && str(s.answer)) kit.shortAnswers.push({ question: str(s.question), answer: str(s.answer), conceptKey: c.key, difficulty: "medium" });
    for (const p of arr(pack.practiceProblems).map(obj)) if (str(p.problem)) kit.problems.push({ problem: str(p.problem), solution: str(p.solution), conceptKey: c.key });
  }

  if (!kit.guide.length) throw new AIError("The local model couldn't produce study material. Try again or use a larger model.", 502);
  return KitSchema.parse(kit);
}

export async function generateQuestionsOllama(opts: {
  subjectName: string;
  context: string;
  concepts: { key: string; name: string; mastery: number }[];
  difficulty: "medium" | "hard";
  count: number;
  avoid: string[];
}) {
  const data = obj(
    await chatJSON(QuestionBatchSchema, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Course: ${opts.subjectName}\n\n<notes>\n${opts.context.slice(0, MATERIAL_LIMIT)}\n</notes>\n\nWrite ${opts.count} new ${opts.difficulty === "hard" ? "HARD (application, multi-step reasoning)" : "medium"} multiple-choice questions with exactly 4 choices each. Focus on these concepts (use the key as conceptKey):\n${opts.concepts.map((c) => `- ${c.key}: ${c.name}`).join("\n")}\nDon't repeat:\n${opts.avoid.slice(0, 20).map((q) => `- ${q}`).join("\n")}`,
      },
    ]),
  );
  return arr(data.mcqs)
    .map((q) => coerceMcq(q, opts.concepts[0].key))
    .filter((q): q is NonNullable<typeof q> => !!q);
}

export async function gradeOllama(question: string, expected: string, given: string) {
  const data = obj(
    await chatJSON(
      GradeSchema,
      [
        { role: "system", content: "You grade a student's short answer against a model answer. Accept answers that capture the key idea in other words. Reply with JSON only." },
        { role: "user", content: `Question: ${question}\nModel answer: ${expected}\nStudent answer: ${given || "(blank)"}\n\nverdict is "correct", "partial", or "incorrect". feedback is 1-2 sentences to the student.` },
      ],
      { numCtx: 4096, numPredict: 400 },
    ),
  );
  const v = data.verdict;
  return { verdict: v === "correct" || v === "partial" ? v : ("incorrect" as const), feedback: str(data.feedback) || "Compare your answer with the model answer." };
}

const ASSISTANT_CONTEXT_LIMIT = 20_000;

/** Streams the tutor's reply as text chunks. */
export async function* streamAssistantOllama(
  system: string,
  context: string,
  messages: { role: "user" | "assistant"; content: string }[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const ctx = context.length > ASSISTANT_CONTEXT_LIMIT ? context.slice(0, ASSISTANT_CONTEXT_LIMIT) + "\n[…]" : context;
  const res = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: ollamaModel(),
      messages: [{ role: "system", content: `${system}\n\n<student_context>\n${ctx}\n</student_context>` }, ...messages.slice(-12)],
      stream: true,
      options: { temperature: 0.5, num_ctx: 12288 },
    }),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let emitted = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let chunk: { message?: { content?: string }; error?: string };
      try {
        chunk = JSON.parse(line);
      } catch {
        continue;
      }
      if (chunk.error) throw new AIError(`Local AI error: ${chunk.error}`, 502);
      raw += chunk.message?.content ?? "";
      const clean = stripThinking(raw);
      if (clean.length > emitted) {
        yield clean.slice(emitted);
        emitted = clean.length;
      }
    }
  }
}

// ---------- model management (used by the Settings page) ----------

export async function ollamaStatus() {
  try {
    const [v, t] = await Promise.all([
      fetch(`${ollamaHost()}/api/version`, { signal: AbortSignal.timeout(2500) }),
      fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(2500) }),
    ]);
    const version = ((await v.json()) as { version?: string }).version ?? null;
    const tags = (await t.json()) as { models?: { name: string; size?: number; details?: { parameter_size?: string } }[] };
    return {
      running: true,
      version,
      models: (tags.models ?? []).map((m) => ({ name: m.name, size: m.size ?? 0, parameterSize: m.details?.parameter_size ?? null })),
    };
  } catch {
    return { running: false, version: null, models: [] };
  }
}

/** Starts a model download; returns Ollama's NDJSON progress stream. */
export async function pullModel(model: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await request("/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ model, stream: true }),
  });
  if (!res.body) throw new AIError("No response from local AI.", 502);
  return res.body;
}
