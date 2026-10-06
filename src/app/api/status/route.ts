import { connection } from "next/server";
import { aiEnabled, MODEL } from "@/lib/ai/claude";

export async function GET() {
  await connection();
  return Response.json({ ai: aiEnabled(), model: aiEnabled() ? MODEL : null });
}
