import { z } from "zod";
import { aiEnabled, describeError, grade } from "@/lib/ai/engine";
import { gradeOffline } from "@/lib/offline";

const Body = z.object({
  question: z.string().max(4000),
  expected: z.string().max(8000),
  given: z.string().max(8000),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { question, expected, given } = parsed.data;
  if (aiEnabled()) {
    try {
      return Response.json(await grade(question, expected, given));
    } catch (err) {
      console.error("[grade]", describeError(err).message);
    }
  }
  return Response.json({ ...gradeOffline(expected, given), offline: true });
}
