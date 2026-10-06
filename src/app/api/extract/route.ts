import { z } from "zod";
import { addKeyHint, aiEnabled, describeError, extractDocumentAI } from "@/lib/ai/claude";

export const maxDuration = 300;

const Body = z.object({
  name: z.string().max(300),
  mediaType: z.literal("application/pdf"),
  data: z.string().max(32 * 1024 * 1024),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unsupported file. Upload a PDF, or a text/markdown file." }, { status: 400 });
  if (!aiEnabled()) {
    return Response.json(
      { error: `Reading PDFs requires AI. ${addKeyHint()}, or paste the text instead.` },
      { status: 503 },
    );
  }
  try {
    const text = await extractDocumentAI(parsed.data.data, parsed.data.mediaType);
    if (!text) return Response.json({ error: "No readable text was found in that document." }, { status: 422 });
    return Response.json({ text });
  } catch (err) {
    const e = describeError(err);
    return Response.json({ error: e.message }, { status: e.status });
  }
}
