import { z } from "zod";
import { aiEnabled, describeError, gradeAI } from "@/lib/ai/claude";
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
      return Response.json(await gradeAI(question, expected, given));
    } catch (err) {
      console.error("[grade]", describeError(err).message);
    }
  }
  return Response.json({ ...gradeOffline(expected, given), offline: true });
}
