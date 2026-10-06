import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { KitSchema, QuestionBatchSchema, GradeSchema, type RawKit } from "./schema";

export const MODEL = process.env.SYNAPSE_MODEL || "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class AIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** Maps SDK errors to user-presentable messages. */
export function describeError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AIError("The AI key is invalid. Check ANTHROPIC_API_KEY.", 401);
  if (err instanceof Anthropic.RateLimitError) return new AIError("The AI is rate limited right now. Try again in a moment.", 429);
  if (err instanceof Anthropic.BadRequestError) return new AIError(`The AI rejected the request: ${err.message}`, 400);
  if (err instanceof Anthropic.APIConnectionError) return new AIError("Couldn't reach the AI service. Check your connection.", 503);
  if (err instanceof Anthropic.APIError) return new AIError(`AI service error (${err.status ?? "unknown"}).`, 502);
  return new AIError(err instanceof Error ? err.message : "Unknown AI error", 500);
}

const KIT_SYSTEM = `You are Synapse, an expert learning designer. You turn a student's raw class material into a complete, accurate study system.

Principles:
- Do not just summarize. Reorganize the material into something a student can actually study from: concepts in a sensible learning order, each explained clearly.
- Stay faithful to the material. You may add standard, well-established facts, examples, and common mistakes that help understanding, but never invent course-specific claims.
- Pick structure that suits the subject. Math/science: formulas, step-by-step methods, worked examples. Humanities: context, causes/effects, key figures, themes, quotations. Languages: vocabulary, grammar patterns, usage examples. Leave arrays empty when a field doesn't apply (e.g. no formulas for history).
- Each concept gets one guide section. Concept keys must be consistent across every item that references them.
- Flashcards: atomic, one fact per card, front is a cue/question, back is concise. Include every term/definition the student supplied as existing flashcards.
- Multiple-choice: exactly 4 choices, one unambiguously correct, distractors reflect real misconceptions. Spread across concepts and difficulties (roughly 30% easy, 45% medium, 25% hard). Hard questions require application or multi-step reasoning, not trivia.
- Short-answer: questions that require explanation in a sentence or two, with a model answer.
- Practice problems only when the subject has problems to solve; include full worked solutions.
- Plan: 4-7 ordered steps using modes: guide (read the guide), learn (teach then test), flashcards, quiz, review (mistakes), challenge (hard questions).
- Write formulas in plain text/Unicode (x², √, ≤, π, Δ), not LaTeX.`;

function sizeHint(chars: number) {
  if (chars < 1500) return "Aim for ~4-6 concepts, ~15-25 flashcards, ~15-20 multiple-choice questions, ~5 short-answer questions.";
  if (chars < 8000) return "Aim for ~6-8 concepts, ~25-40 flashcards, ~25-30 multiple-choice questions, ~8 short-answer questions.";
  return "Aim for ~8-10 concepts, ~40-60 flashcards, ~30-40 multiple-choice questions, ~10 short-answer questions.";
}

export async function generateKitAI(subjectName: string, material: string): Promise<RawKit> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(KitSchema) },
    system: KIT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Course: ${subjectName}\n\n${sizeHint(material.length)}\n\n<material>\n${material}\n</material>\n\nBuild the complete study kit.`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AIError("The AI declined to process this material.", 422);
  if (msg.stop_reason === "max_tokens") throw new AIError("The material is too long to process in one pass. Try splitting it into smaller parts.", 413);
  if (!msg.parsed_output) throw new AIError("The AI returned an unexpected format. Please try again.", 502);
  return msg.parsed_output;
}

export async function generateQuestionsAI(opts: {
  subjectName: string;
  context: string;
  concepts: { key: string; name: string; mastery: number }[];
  difficulty: "medium" | "hard";
  count: number;
  avoid: string[];
}) {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(QuestionBatchSchema) },
    system: KIT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Course: ${opts.subjectName}

<study_material>
${opts.context}
</study_material>

Target concepts (key — name — student's current mastery):
${opts.concepts.map((c) => `- ${c.key} — ${c.name} — ${Math.round(c.mastery)}%`).join("\n")}

Write ${opts.count} NEW multiple-choice questions at ${opts.difficulty === "hard" ? "HARD difficulty (application, multi-step reasoning, edge cases, combining concepts)" : "medium difficulty"}. Weight toward the lowest-mastery concepts. Use the given concept keys exactly. Do not repeat these existing questions:
${opts.avoid.slice(0, 40).map((q) => `- ${q}`).join("\n")}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new AIError("The AI declined this request.", 422);
  if (!res.parsed_output) throw new AIError("The AI returned an unexpected format.", 502);
  return res.parsed_output.mcqs;
}

export async function gradeAI(question: string, expected: string, given: string) {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(GradeSchema) },
    system:
      "You grade a student's short answer against a model answer. Be fair: accept answers that capture the key idea in different words. 'partial' means some key idea is present but something important is missing or slightly wrong. Feedback is addressed to the student, encouraging but precise.",
    messages: [
      {
        role: "user",
        content: `Question: ${question}\nModel answer: ${expected}\nStudent answer: ${given || "(blank)"}`,
      },
    ],
  });
  if (!res.parsed_output) throw new AIError("The AI returned an unexpected format.", 502);
  return res.parsed_output;
}

export async function extractDocumentAI(base64: string, mediaType: "application/pdf"): Promise<string> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: "Transcribe this document's study-relevant content as clean plain-text notes. Preserve headings, lists, definitions, formulas (as plain text/Unicode), and examples. Omit page numbers, headers/footers, and boilerplate. Output only the notes.",
          },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AIError("The AI declined to read this document.", 422);
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

const ASSISTANT_SYSTEM = `You are Synapse, a personal AI tutor inside a gamified study app. You are not a generic chatbot: you have the student's current course, study guide, flashcards, mastery levels, quiz history, and recent mistakes (provided in <student_context>). Use them.

How to tutor:
- Tailor everything to this student's data. Reference their weak concepts and specific mistakes by name when relevant. If they ask "why did I get this wrong", look at their recent mistakes and explain the misconception behind their chosen answer.
- Be concise and structured. Short paragraphs, bullet lists, bold key terms. Use plain-text/Unicode math (x², √, ≤), not LaTeX.
- "Explain simpler" / "like I'm new": use an everyday analogy, then build up step by step, no jargon without defining it.
- "Another example" / "harder version": produce a fresh example or problem in the course's style, with a worked solution hidden under a "Solution" heading after the problem.
- "Quiz me": ask ONE question at a time (prefer their weakest concepts), wait for their answer, then give feedback before the next question.
- "What should I study next": recommend 1-3 concrete actions based on mastery and mistakes, naming the app modes (Learn, Flashcards, Quiz, Review, Challenge).
- Stay grounded in their material. If something isn't covered there, you may teach it but say it goes beyond their notes.
- Never claim the app's "brain regions" are real neuroscience; they're a game mechanic.`;

export function streamAssistant(context: string, messages: Anthropic.Beta.BetaMessageParam[]) {
  return getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: ASSISTANT_SYSTEM },
      { type: "text", text: `<student_context>\n${context}\n</student_context>`, cache_control: { type: "ephemeral" } },
    ],
    messages,
  });
}
