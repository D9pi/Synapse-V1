import "server-only";
import { AIError } from "./errors";
import {
  ASSISTANT_SYSTEM,
  MODEL as CLAUDE_MODEL,
  claudeConfigured,
  describeClaudeError,
  extractDocumentAI,
  generateKitAI,
  generateQuestionsAI,
  gradeAI,
  streamAssistantClaude,
} from "./claude";
import {
  generateKitOllama,
  generateQuestionsOllama,
  gradeOllama,
  ollamaModel,
  streamAssistantOllama,
} from "./ollama";
import type { RawKit } from "./schema";

// Routes every AI feature to the engine the student chose:
//   SYNAPSE_AI_PROVIDER = "anthropic" (Claude, needs a key) | "ollama" (free, local) | "off"
// Unset: Claude when a key is present, otherwise off.

export type Provider = "anthropic" | "ollama";

export function provider(): Provider | null {
  const p = process.env.SYNAPSE_AI_PROVIDER;
  if (p === "off") return null;
  if (p === "ollama") return "ollama";
  return claudeConfigured() ? "anthropic" : null;
}

export const aiEnabled = () => provider() !== null;

export function modelName(): string | null {
  const p = provider();
  return p === "anthropic" ? CLAUDE_MODEL : p === "ollama" ? ollamaModel() : null;
}

/** How to turn AI on, phrased for where the app is running. */
export function addKeyHint(): string {
  return process.env.SYNAPSE_DESKTOP
    ? "Turn on AI in Settings (free Local AI, or Claude with an API key)"
    : "Set ANTHROPIC_API_KEY or SYNAPSE_AI_PROVIDER=ollama in .env.local";
}

export function describeError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  return provider() === "anthropic" ? describeClaudeError(err) : new AIError(err instanceof Error ? err.message : "Unknown AI error", 500);
}

export function generateKit(subjectName: string, material: string): Promise<RawKit> {
  return provider() === "ollama" ? generateKitOllama(subjectName, material) : generateKitAI(subjectName, material);
}

export function generateQuestions(opts: Parameters<typeof generateQuestionsAI>[0]) {
  return provider() === "ollama" ? generateQuestionsOllama(opts) : generateQuestionsAI(opts);
}

export function grade(question: string, expected: string, given: string) {
  return provider() === "ollama" ? gradeOllama(question, expected, given) : gradeAI(question, expected, given);
}

export function extractDocument(base64: string, mediaType: "application/pdf"): Promise<string> {
  if (provider() === "ollama") {
    throw new AIError("Local AI can't read PDFs yet. Copy the text from the PDF and paste it in as notes instead.", 501);
  }
  return extractDocumentAI(base64, mediaType);
}

export function assistantStream(
  context: string,
  messages: { role: "user" | "assistant"; content: string }[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  return provider() === "ollama"
    ? streamAssistantOllama(ASSISTANT_SYSTEM, context, messages, signal)
    : streamAssistantClaude(context, messages, signal);
}
