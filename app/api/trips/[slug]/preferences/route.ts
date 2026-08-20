import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json();
    const { member_id, interests, restrictions, daily_budget, present_from, present_to } = body;

    if (!member_id) return NextResponse.json({ error: "Sem membro identificado." }, { status: 400 });

    const db = supabaseAdmin();
    const { data: trip } = await db.from("trips").select("id").eq("slug", slug).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const { error } = await db.from("preferences").upsert(
      {
        trip_id: trip.id,
        member_id,
        interests: interests ?? [],
        restrictions: restrictions ?? [],
        daily_budget: daily_budget || null,
        present_from: present_from || null,
        present_to: present_to || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar preferencias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
