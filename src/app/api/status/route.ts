import { connection } from "next/server";
import { aiEnabled, modelName, provider } from "@/lib/ai/engine";

export async function GET() {
  await connection();
  return Response.json({ ai: aiEnabled(), provider: provider(), model: modelName() });
}
