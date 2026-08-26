import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { currentModelName, datasEntre, generateItinerary } from "@/lib/generate";
import { verifyPlace, type PlaceInfo } from "@/lib/places";
import type { Idea, IdeaVote, Preference } from "@/lib/types";

export const maxDuration = 60;

// A verificacao no Nominatim e serializada em 1 req/s por exigencia da
// politica de uso. Para nao estourar o tempo limite da funcao, damos um
// orcamento de tempo: o que nao der pra conferir fica como nao verificado.
const VERIFY_BUDGET_MS = 8_000;
const NOT_VERIFIED: PlaceInfo = { verified: false, lat: null, lng: null, data: null };
const DIAS_POR_LOTE = 7;

type ExistingItinerary = {
  id: string;
  version: number;
  rationale: string | null;
  itinerary_days: { day_date: string }[];
};

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(_req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para gerar o roteiro." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data: trip } = await db.from("trips").select("*").eq("slug", slug).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const [membersResult, prefRowsResult, plannedIdeasResult] = await Promise.all([
      db.from("members").select("*").eq("trip_id", trip.id),
      db.from("preferences").select("*").eq("trip_id", trip.id),
      db
        .from("ideas")
        .select("id, member_id, title, notes, category, estimated_cost, status")
        .eq("trip_id", trip.id)
        .eq("status", "planned")
        .order("updated_at", { ascending: false }),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (prefRowsResult.error) throw prefRowsResult.error;
    if (plannedIdeasResult.error) throw plannedIdeasResult.error;

    const members = membersResult.data ?? [];
    const prefRows = prefRowsResult.data ?? [];
    const plannedIdeas = (plannedIdeasResult.data ?? []) as Idea[];

    if (prefRows.length === 0) {
      return NextResponse.json(
        { error: "Ninguem preencheu as preferencias ainda. O roteiro em grupo depende disso." },
        { status: 400 }
      );
    }

    let ideaVotes: IdeaVote[] = [];
    const plannedIdeaIds = plannedIdeas.map((idea) => idea.id);
    if (plannedIdeaIds.length) {
      const { data, error } = await db
        .from("idea_votes")
        .select("idea_id, member_id, value")
        .in("idea_id", plannedIdeaIds);
      if (error) throw error;
      ideaVotes = (data ?? []) as IdeaVote[];
    }

    const prefs: Record<string, Preference> = {};
    for (const p of prefRows) prefs[p.member_id] = p as Preference;

    const allDates = datasEntre(trip.start_date, trip.end_date);
    const { data: lastRows, error: lastError } = await db
      .from("itineraries")
      .select("id, version, rationale, itinerary_days(day_date)")
      .eq("trip_id", trip.id)
      .order("version", { ascending: false })
      .limit(1);
    if (lastError) throw lastError;

    const last = (lastRows?.[0] ?? null) as ExistingItinerary | null;
    const lastDates = new Set(last?.itinerary_days?.map((day) => day.day_date) ?? []);
    const lastIsIncomplete = Boolean(last && allDates.some((date) => !lastDates.has(date)));
    const itineraryToContinue = lastIsIncomplete ? last : null;
    const existingDates = new Set(itineraryToContinue ? lastDates : []);
    const missingDates = allDates.filter((date) => !existingDates.has(date));
    const targetDates = (itineraryToContinue ? missingDates : allDates).slice(0, DIAS_POR_LOTE);

    if (!targetDates.length) {
      return NextResponse.json({
        ok: true,
        concluido: true,
        dias_gerados: allDates.length,
        dias_totais: allDates.length,
        version: last?.version ?? null,
      });
    }

    const generated = await generateItinerary(trip, members, prefs, plannedIdeas, ideaVotes, targetDates);

    if (!generated.days.length) {
      return NextResponse.json(
        {
          error:
            "A IA nao devolveu nenhum dos dias pedidos para este lote. Tente novamente para continuar o roteiro.",
          faltando: generated.faltando ?? targetDates,
        },
        { status: 502 }
      );
    }

    let itinerary = itineraryToContinue;
    if (!itinerary) {
      const version = (last?.version ?? 0) + 1;
      const { data: created, error: itError } = await db
        .from("itineraries")
        .insert({
          trip_id: trip.id,
          version,
          model: currentModelName(),
          rationale: generated.rationale,
        })
        .select("id, version, rationale")
        .single();
      if (itError) throw itError;
      itinerary = { ...created, itinerary_days: [] } as ExistingItinerary;
    } else {
      const { error: updateError } = await db
        .from("itineraries")
        .update({
          model: currentModelName(),
          rationale: generated.rationale || itinerary.rationale,
        })
        .eq("id", itinerary.id);
      if (updateError) throw updateError;
    }

    const deadline = Date.now() + VERIFY_BUDGET_MS;

    let insertedDays = 0;
    for (const day of generated.days) {
      if (existingDates.has(day.day_date)) continue;

      const { data: dayRow, error: dayError } = await db
        .from("itinerary_days")
        .insert({
          itinerary_id: itinerary.id,
          day_date: day.day_date,
          title: day.title,
          note: day.note,
          position: allDates.indexOf(day.day_date),
        })
        .select()
        .single();
      if (dayError) throw dayError;
      insertedDays += 1;
      existingDates.add(day.day_date);

      const items = day.items ?? [];
      const checked: PlaceInfo[] = [];
      for (const item of items) {
        checked.push(Date.now() < deadline ? await verifyPlace(item.place_query) : NOT_VERIFIED);
      }

      const rows = items.map((item, i) => ({
        day_id: dayRow.id,
        position: i,
        start_time: item.start_time,
        duration_min: item.duration_min,
        title: item.title,
        description: item.description,
        category: item.category,
        cost_estimate: item.cost_estimate,
        place_query: item.place_query,
        needs_vote: Boolean(item.needs_vote),
        verified: checked[i].verified,
        lat: checked[i].lat,
        lng: checked[i].lng,
        place_data: checked[i].data,
      }));

      if (rows.length) {
        const { error: itemsError } = await db.from("itinerary_items").insert(rows);
        if (itemsError) throw itemsError;
      }
    }

    const diasGerados = allDates.filter((date) => existingDates.has(date)).length;

    return NextResponse.json({
      ok: true,
      version: itinerary.version,
      concluido: diasGerados >= allDates.length,
      dias_gerados: diasGerados,
      dias_totais: allDates.length,
      dias_lote: insertedDays,
      faltando: allDates.filter((date) => !existingDates.has(date)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar o roteiro.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
