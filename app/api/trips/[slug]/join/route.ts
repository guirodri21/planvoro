import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const COLORS = ["#4ade80", "#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#38bdf8", "#34d399"];

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const { name } = await req.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Digite seu nome." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: trip } = await db.from("trips").select("id").eq("slug", slug).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", trip.id);

    const { data: member, error } = await db
      .from("members")
      .insert({
        trip_id: trip.id,
        name: String(name).trim(),
        color: COLORS[(count ?? 0) % COLORS.length],
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ member });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao entrar na viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
