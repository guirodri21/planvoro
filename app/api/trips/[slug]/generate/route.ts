import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { currentModelName, generateItinerary } from "@/lib/generate";
import { verifyPlace, type PlaceInfo } from "@/lib/places";
import type { Preference } from "@/lib/types";

export const maxDuration = 60;

// A verificacao no Nominatim e serializada em 1 req/s por exigencia da
// politica de uso. Para nao estourar o tempo limite da funcao, damos um
// orcamento de tempo: o que nao der pra conferir fica como nao verificado.
const VERIFY_BUDGET_MS = 20_000;
const NOT_VERIFIED: PlaceInfo = { verified: false, lat: null, lng: null, data: null };

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();

    const { data: trip } = await db.from("trips").select("*").eq("slug", slug).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const { data: members } = await db.from("members").select("*").eq("trip_id", trip.id);
    const { data: prefRows } = await db.from("preferences").select("*").eq("trip_id", trip.id);

    if (!prefRows || prefRows.length === 0) {
      return NextResponse.json(
        { error: "Ninguem preencheu as preferencias ainda. O roteiro em grupo depende disso." },
        { status: 400 }
      );
    }

    const prefs: Record<string, Preference> = {};
    for (const p of prefRows) prefs[p.member_id] = p as Preference;

    const generated = await generateItinerary(trip, members ?? [], prefs);

    // Nova versao em vez de sobrescrever: da pra comparar e voltar atras.
    const { data: last } = await db
      .from("itineraries")
      .select("version")
      .eq("trip_id", trip.id)
      .order("version", { ascending: false })
      .limit(1);
    const version = (last?.[0]?.version ?? 0) + 1;

    const { data: itinerary, error: itError } = await db
      .from("itineraries")
      .insert({
        trip_id: trip.id,
        version,
        model: currentModelName(),
        rationale: generated.rationale,
      })
      .select()
      .single();
    if (itError) throw itError;

    const deadline = Date.now() + VERIFY_BUDGET_MS;

    for (const [dayIndex, day] of generated.days.entries()) {
      const { data: dayRow, error: dayError } = await db
        .from("itinerary_days")
        .insert({
          itinerary_id: itinerary.id,
          day_date: day.day_date,
          title: day.title,
          note: day.note,
          position: dayIndex,
        })
        .select()
        .single();
      if (dayError) throw dayError;

      const items = day.items ?? [];
      const checked = await Promise.all(
        items.map((item) =>
          Date.now() < deadline ? verifyPlace(item.place_query) : Promise.resolve(NOT_VERIFIED)
        )
      );

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

    return NextResponse.json({ ok: true, version });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar o roteiro.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
