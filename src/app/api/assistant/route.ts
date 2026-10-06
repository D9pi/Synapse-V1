import { z } from "zod";
import { aiEnabled, describeError, streamAssistant } from "@/lib/ai/claude";

export const maxDuration = 120;

const Body = z.object({
  context: z.string().max(300_000),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(60),
});

const OFFLINE_REPLY = `**The AI tutor is offline.** Add an \`ANTHROPIC_API_KEY\` to \`.env.local\` and restart to enable personalised explanations.

In the meantime:
- **Review mode** replays every question you've missed.
- **Learn mode** walks through each concept before testing you.
- The **Study guide** tab has explanations, worked examples, and common mistakes.`;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const encoder = new TextEncoder();

  if (!aiEnabled()) {
    return new Response(OFFLINE_REPLY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // The API requires the conversation to start with a user turn.
  const msgs = parsed.data.messages;
  const start = msgs.findIndex((m) => m.role === "user");
  const messages = msgs.slice(start);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = streamAssistant(parsed.data.context, messages);
        req.signal.addEventListener("abort", () => stream.abort());
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_I can't help with that one. Let's get back to your material._"));
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
