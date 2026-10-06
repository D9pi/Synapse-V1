import { connection } from "next/server";
import { z } from "zod";
import { describeError } from "@/lib/ai/engine";
import { ollamaHost, ollamaModel, ollamaStatus, pullModel } from "@/lib/ai/ollama";

// Settings helpers for free Local AI: detect Ollama, list models, download a model.

export async function GET() {
  await connection();
  const status = await ollamaStatus();
  return Response.json({ ...status, host: ollamaHost(), selected: ollamaModel() });
}

export const maxDuration = 3600;

const Body = z.object({ model: z.string().regex(/^[\w.\-/:]+$/).max(120) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid model name" }, { status: 400 });
  try {
    const stream = await pullModel(parsed.data.model, req.signal);
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  } catch (err) {
    const e = describeError(err);
    return Response.json({ error: e.message }, { status: e.status });
  }
}
