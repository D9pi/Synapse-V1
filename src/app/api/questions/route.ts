import { z } from "zod";
import { aiEnabled, describeError, generateQuestionsAI } from "@/lib/ai/claude";
import { normalizeMcq } from "@/lib/ai/normalize";
import type { MCQ } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  subjectName: z.string().max(120),
  context: z.string().max(200_000),
  concepts: z.array(z.object({ id: z.string(), name: z.string(), mastery: z.number() })).min(1).max(20),
  difficulty: z.enum(["medium", "hard"]),
  count: z.number().int().min(1).max(15),
  avoid: z.array(z.string()).max(200),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (!aiEnabled()) return Response.json({ mcqs: [], offline: true });
  const b = parsed.data;
  // Use concept ids directly as keys so the model's references map straight back.
  const keyToId = new Map(b.concepts.map((c) => [c.id, c.id]));
  try {
    const raw = await generateQuestionsAI({
      subjectName: b.subjectName,
      context: b.context,
      concepts: b.concepts.map((c) => ({ key: c.id, name: c.name, mastery: c.mastery })),
      difficulty: b.difficulty,
      count: b.count,
      avoid: b.avoid,
    });
    const mcqs = raw
      .map((q) => normalizeMcq(q, keyToId, b.concepts[0].id))
      .filter((q): q is MCQ => !!q)
      .map((q) => ({ ...q, difficulty: b.difficulty === "hard" ? ("hard" as const) : q.difficulty }));
    return Response.json({ mcqs });
  } catch (err) {
    const e = describeError(err);
    return Response.json({ error: e.message, mcqs: [] }, { status: e.status });
  }
}
