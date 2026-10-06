import * as z from "zod";

const difficulty = z.enum(["easy", "medium", "hard"]);
const mode = z.enum(["guide", "learn", "flashcards", "quiz", "review", "challenge"]);

export const McqSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).describe("Exactly 4 answer choices, plausible distractors."),
  answerIndex: z.number().int().describe("0-based index of the correct choice"),
  explanation: z.string().describe("Why the answer is right and the tempting distractor is wrong."),
  conceptKey: z.string(),
  difficulty,
});

export const KitSchema = z.object({
  summary: z.string().describe("One or two sentences describing what this material covers."),
  concepts: z
    .array(z.object({ key: z.string().describe("short slug, e.g. quadratic-formula"), name: z.string(), summary: z.string() }))
    .describe("4-10 distinct, testable concepts."),
  guide: z.array(
    z.object({
      conceptKey: z.string(),
      title: z.string(),
      overview: z.string().describe("Plain-language explanation of what it is and why it matters."),
      keyPoints: z.array(z.string()),
      formulas: z.array(z.object({ expression: z.string(), meaning: z.string() })),
      steps: z.array(z.string()).describe("How-to steps when the concept is procedural; empty otherwise."),
      example: z.object({ problem: z.string(), solution: z.string() }).nullable(),
      commonMistakes: z.array(z.string()),
      quickReview: z.array(z.string()).describe("Terse key facts for last-minute review."),
    }),
  ),
  definitions: z.array(z.object({ term: z.string(), definition: z.string(), conceptKey: z.string() })),
  formulas: z.array(z.object({ name: z.string(), expression: z.string(), explanation: z.string(), conceptKey: z.string() })),
  flashcards: z.array(z.object({ front: z.string(), back: z.string(), conceptKey: z.string() })),
  mcqs: z.array(McqSchema),
  shortAnswers: z.array(z.object({ question: z.string(), answer: z.string(), conceptKey: z.string(), difficulty })),
  problems: z.array(z.object({ problem: z.string(), solution: z.string(), conceptKey: z.string() })),
  plan: z.array(
    z.object({ title: z.string(), description: z.string(), mode, minutes: z.number().int() }),
  ),
});

export type RawKit = z.infer<typeof KitSchema>;

export const QuestionBatchSchema = z.object({ mcqs: z.array(McqSchema) });

export const GradeSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string().describe("1-3 sentences: what was right, what was missing."),
});
