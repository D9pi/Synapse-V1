import type { MCQ, StudyKit } from "./types";

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  status: async (): Promise<{ ai: boolean; model: string | null }> => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      return await r.json();
    } catch {
      return { ai: false, model: null };
    }
  },
  generate: (subjectName: string, material: string, offlineMaterial: string, signal?: AbortSignal) =>
    post<{ kit: StudyKit; notice?: string }>("/api/generate", { subjectName, material, offlineMaterial }, signal),
  questions: (body: {
    subjectName: string;
    context: string;
    concepts: { id: string; name: string; mastery: number }[];
    difficulty: "medium" | "hard";
    count: number;
    avoid: string[];
  }) => post<{ mcqs: MCQ[]; offline?: boolean }>("/api/questions", body),
  grade: (question: string, expected: string, given: string) =>
    post<{ verdict: "correct" | "partial" | "incorrect"; feedback: string; offline?: boolean }>("/api/grade", {
      question,
      expected,
      given,
    }),
  extract: (name: string, data: string) =>
    post<{ text: string }>("/api/extract", { name, data, mediaType: "application/pdf" }),
};

export async function streamAssistant(
  context: string,
  messages: { role: "user" | "assistant"; content: string }[],
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "The assistant is unavailable right now.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  return full;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
