import { NextResponse } from "next/server";
import { displayNameFromUser, getUserFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const COLORS = ["#4ade80", "#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#38bdf8", "#34d399"];

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para participar da viagem." }, { status: 401 });
    }

    const { name } = await req.json();
    const displayName = String(name ?? "").trim() || displayNameFromUser(user);
    if (!displayName) {
      return NextResponse.json({ error: "Digite seu nome." }, { status: 400 });
    }

    const { data: trip } = await db.from("trips").select("id").eq("slug", slug).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const { data: existing, error: existingError } = await db
      .from("members")
      .select("id, trip_id, name, is_organizer, color")
      .eq("trip_id", trip.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      if (existing.name !== displayName) {
        await db.from("members").update({ name: displayName }).eq("id", existing.id);
        return NextResponse.json({ member: { ...existing, name: displayName } });
      }
      return NextResponse.json({ member: existing });
    }

    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", trip.id);

    const { data: member, error } = await db
      .from("members")
      .insert({
        trip_id: trip.id,
        user_id: user.id,
        name: displayName,
        color: COLORS[(count ?? 0) % COLORS.length],
      })
      .select("id, trip_id, name, is_organizer, color")
      .single();
    if (error) throw error;

    return NextResponse.json({ member });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao entrar na viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
