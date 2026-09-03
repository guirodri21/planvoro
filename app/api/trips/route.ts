import { NextResponse } from "next/server";
import { displayNameFromUser, getUserFromRequest } from "@/lib/auth";
import { checkTripCreation } from "@/lib/ai-limits";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

/** Teto por pessoa. Valor invalido vira nulo, nao zero: um orcamento de
 *  R$ 0 dispararia alerta de estouro no primeiro cafe. */
function cleanBudget(value: unknown) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;

  return Number(amount.toFixed(2));
}

const COLORS = ["#4ade80", "#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#38bdf8", "#34d399"];

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
      budget_per_person,
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

    // Teto da beta: conta viagens em que a pessoa e organizadora, nao as
    // que ela so participa a convite.
    const tripLimitMessage = await checkTripCreation(db, user.id);
    if (tripLimitMessage) {
      return NextResponse.json({ error: tripLimitMessage }, { status: 429 });
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
        budget_per_person: cleanBudget(budget_per_person),
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
