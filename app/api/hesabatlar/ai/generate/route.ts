import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAiInsights } from "@/features/hesabatlar/ai-insights";
import { requireHesabatActionPerm } from "@/features/hesabatlar/access-guard";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await requireHesabatActionPerm("ai.istifade");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 });

  try {
    const { ai_text, is_mock } = await buildAiInsights();
    return NextResponse.json({ text: ai_text, is_mock });
  } catch (e) {
    console.error("[ai/generate]", e);
    return NextResponse.json({ text: "AI cavabını almaq mümkün olmadı.", is_mock: true }, { status: 200 });
  }
}
