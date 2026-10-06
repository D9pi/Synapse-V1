import { z } from "zod";
import { addKeyHint, aiEnabled, describeError, generateKit, provider } from "@/lib/ai/engine";
import { normalizeKit } from "@/lib/ai/normalize";
import { generateOfflineKit } from "@/lib/offline";

// Local AI generates concept by concept and can take several minutes on a laptop.
export const maxDuration = 900;

const Body = z.object({
  subjectName: z.string().min(1).max(120),
  material: z.string().min(20, "Add a bit more material first (at least a few sentences).").max(400_000, "That's too much material for one pass. Split it into smaller parts."),
  // Same material, pre-formatted for the heuristic generator.
  offlineMaterial: z.string().max(400_000).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { subjectName, material } = parsed.data;
  const offlineText = parsed.data.offlineMaterial || material;

  if (aiEnabled()) {
    try {
      const raw = await generateKit(subjectName, material);
      return Response.json({ kit: normalizeKit(raw, "ai"), engine: provider() });
    } catch (err) {
      const e = describeError(err);
      console.error("[generate] AI failed, using offline generator:", e.message);
      const kit = normalizeKit(generateOfflineKit(subjectName, offlineText), "offline");
      return Response.json({ kit, notice: `${e.message} Built a basic kit offline instead — you can regenerate later.` });
    }
  }
  const kit = normalizeKit(generateOfflineKit(subjectName, offlineText), "offline");
  return Response.json({
    kit,
    notice: `AI is off, so this kit was built with the offline generator. ${addKeyHint()} for full AI generation.`,
  });
}
