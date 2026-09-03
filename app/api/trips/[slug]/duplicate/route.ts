import { NextResponse } from "next/server";
import { displayNameFromUser, getUserFromRequest } from "@/lib/auth";
import { checkTripCreation } from "@/lib/ai-limits";
import { memberForUserInTrip } from "@/lib/guards";
import { logError, logInfo, startTimer } from "@/lib/logger";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const COLORS = ["#4ade80", "#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#38bdf8", "#34d399"];

/**
 * Duplicar viagem.
 *
 * Copia a configuracao e o roteiro. NAO copia Cofre, gastos, checklist,
 * ideias, votos, comentarios, membros nem preferencias.
 *
 * O Cofre e a linha que nao pode ser cruzada: ele guarda localizador,
 * comprovante e anexo de reserva de outra pessoa. Duplicar uma viagem
 * publica que levasse isso junto entregaria a reserva de um estranho a
 * quem clicou num botao. Roteiro e sugestao; reserva e documento.
 *
 * Quem pode duplicar: participante da viagem, ou qualquer pessoa
 * autenticada se a viagem for publica.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const elapsed = startTimer();

  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();

    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para duplicar." }, { status: 401 });
    }

    const { data: origin, error: originError } = await db
      .from("trips")
      .select(
        "id, destination, start_date, end_date, party_size, budget_band, styles, is_solo, is_public"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (originError) throw originError;
    if (!origin) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership && !origin.is_public) {
      return NextResponse.json({ error: "Essa viagem nao e publica." }, { status: 403 });
    }

    const tripLimitMessage = await checkTripCreation(db, user.id);
    if (tripLimitMessage) {
      return NextResponse.json({ error: tripLimitMessage }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const destination = String(body.destination ?? origin.destination).trim() || origin.destination;

    const { data: trip, error: tripError } = await db
      .from("trips")
      .insert({
        slug: slugify(destination),
        destination,
        start_date: origin.start_date,
        end_date: origin.end_date,
        party_size: origin.party_size,
        is_solo: origin.is_solo,
        budget_band: origin.budget_band,
        styles: Array.isArray(origin.styles) ? origin.styles : [],
        // A copia nasce privada mesmo vindo de uma viagem publica: publicar
        // e uma escolha de quem duplicou, nao heranca do original.
        is_public: false,
      })
      .select("id, slug")
      .single();
    if (tripError) throw tripError;

    const { error: memberError } = await db.from("members").insert({
      trip_id: trip.id,
      user_id: user.id,
      name: displayNameFromUser(user),
      is_organizer: true,
      color: COLORS[0],
    });
    if (memberError) throw memberError;

    const copiedDays = await copyItinerary(db, origin.id, trip.id);

    logInfo({
      event: "trip_duplicated",
      route: "trips/[slug]/duplicate",
      userId: user.id,
      tripId: trip.id,
      fromPublic: !membership,
      copiedDays,
      durationMs: elapsed(),
    });

    return NextResponse.json({ ok: true, slug: trip.slug, copied_days: copiedDays });
  } catch (e) {
    logError({
      event: "trip_duplication_failed",
      route: "trips/[slug]/duplicate",
      durationMs: elapsed(),
      error: e,
    });
    const msg = e instanceof Error ? e.message : "Erro ao duplicar a viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type DbClient = ReturnType<typeof supabaseAdmin>;

/**
 * Copia a versao mais recente do roteiro. Voto, comentario e verificacao
 * de lugar nao vem junto: voto e opiniao do grupo antigo, e a copia comeca
 * como rascunho de quem duplicou.
 */
async function copyItinerary(db: DbClient, fromTripId: string, toTripId: string) {
  const { data: rows, error } = await db
    .from("itineraries")
    .select("id, rationale, model, itinerary_days(day_date, title, note, position, itinerary_items(*))")
    .eq("trip_id", fromTripId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw error;

  const source = rows?.[0];
  if (!source) return 0;

  const { data: created, error: createdError } = await db
    .from("itineraries")
    .insert({
      trip_id: toTripId,
      version: 1,
      model: source.model,
      rationale: source.rationale,
    })
    .select("id")
    .single();
  if (createdError) throw createdError;

  const days = (source.itinerary_days ?? []) as Array<{
    day_date: string;
    title: string | null;
    note: string | null;
    position: number;
    itinerary_items: Array<Record<string, unknown>>;
  }>;

  let copied = 0;

  for (const day of days) {
    const { data: dayRow, error: dayError } = await db
      .from("itinerary_days")
      .insert({
        itinerary_id: created.id,
        day_date: day.day_date,
        title: day.title,
        note: day.note,
        position: day.position,
      })
      .select("id")
      .single();
    if (dayError) throw dayError;

    copied += 1;

    const items = (day.itinerary_items ?? []).map((item) => ({
      day_id: dayRow.id,
      position: item.position,
      start_time: item.start_time,
      duration_min: item.duration_min,
      title: item.title,
      description: item.description,
      category: item.category,
      cost_estimate: item.cost_estimate,
      place_query: item.place_query,
      needs_vote: item.needs_vote,
      verified: item.verified,
      lat: item.lat,
      lng: item.lng,
      place_data: item.place_data,
    }));

    if (items.length) {
      const { error: itemsError } = await db.from("itinerary_items").insert(items);
      if (itemsError) throw itemsError;
    }
  }

  return copied;
}
