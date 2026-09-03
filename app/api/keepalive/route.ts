import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * O plano gratuito do Supabase pausa o projeto depois de 7 dias sem atividade.
 * Um cron gratuito (cron-job.org) chama esta rota a cada poucos dias e o
 * projeto nunca pausa. Veja o COMECE-AQUI.md.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { count, error } = await db
      .from("trips")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, trips: count ?? 0, at: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
