import { z } from "zod";
import { addKeyHint, aiEnabled, assistantStream, describeError } from "@/lib/ai/engine";

export const maxDuration = 120;

const Body = z.object({
  context: z.string().max(300_000),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(60),
});

const offlineReply = () => `**The AI tutor is offline.** ${addKeyHint()} to enable personalised explanations.

In the meantime:
- **Review mode** replays every question you've missed.
- **Learn mode** walks through each concept before testing you.
- The **Study guide** tab has explanations, worked examples, and common mistakes.`;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const encoder = new TextEncoder();

  if (!aiEnabled()) {
    return new Response(offlineReply(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // The API requires the conversation to start with a user turn.
  const msgs = parsed.data.messages;
  const start = msgs.findIndex((m) => m.role === "user");
  const messages = msgs.slice(start);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of assistantStream(parsed.data.context, messages, req.signal)) {
          controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        if (!req.signal.aborted) {
          controller.enqueue(encoder.encode(`\n\n⚠ ${describeError(err).message}`));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
