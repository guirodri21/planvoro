import { NextResponse } from "next/server";
import { displayNameFromUser, getUserFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const COLORS = ["#4ade80", "#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#38bdf8", "#34d399"];

function slugify(destination: string) {
  const base = destination
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "viagem"}-${suffix}`;
}

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para criar uma viagem." }, { status: 401 });
    }

    const body = await req.json();
    const {
      destination,
      start_date,
      end_date,
      party_size,
      budget_band,
      styles,
      organizer_name,
      is_solo,
    } = body;

    const organizerName = String(organizer_name ?? "").trim() || displayNameFromUser(user);

    if (!destination || !start_date || !end_date || !organizerName) {
      return NextResponse.json(
        { error: "Preencha destino, datas e seu nome." },
        { status: 400 }
      );
    }
    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: "A volta nao pode ser antes da ida." }, { status: 400 });
    }

    const { data: trip, error } = await db
      .from("trips")
      .insert({
        slug: slugify(destination),
        destination,
        start_date,
        end_date,
        party_size: is_solo ? 1 : Number(party_size) || 4,
        is_solo: Boolean(is_solo),
        budget_band: budget_band ?? null,
        styles: Array.isArray(styles) ? styles : [],
      })
      .select()
      .single();
    if (error) throw error;

    const { data: member, error: memberError } = await db
      .from("members")
      .insert({
        trip_id: trip.id,
        user_id: user.id,
        name: organizerName,
        is_organizer: true,
        color: COLORS[0],
      })
      .select("id")
      .single();
    if (memberError) throw memberError;

    return NextResponse.json({ slug: trip.slug, member_id: member.id, is_solo: trip.is_solo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar a viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
