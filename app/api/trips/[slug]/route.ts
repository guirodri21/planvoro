import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();

    const { data: trip, error } = await db.from("trips").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const [members, preferences, itineraries] = await Promise.all([
      db.from("members").select("*").eq("trip_id", trip.id).order("created_at"),
      db.from("preferences").select("*").eq("trip_id", trip.id),
      db
        .from("itineraries")
        .select("id, version, rationale, itinerary_days(*, itinerary_items(*))")
        .eq("trip_id", trip.id)
        .order("version", { ascending: false })
        .limit(1),
    ]);

    type DayRow = { position: number; itinerary_items: { id: string; position: number }[] };
    const itinerary = (itineraries.data?.[0] ?? null) as
      | ({ itinerary_days: DayRow[] } & Record<string, unknown>)
      | null;

    if (itinerary) {
      itinerary.itinerary_days.sort((a: DayRow, b: DayRow) => a.position - b.position);
      for (const day of itinerary.itinerary_days) {
        day.itinerary_items.sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position
        );
      }
    }

    // Votos e comentarios dos itens do roteiro atual.
    // Buscamos pelos ids dos itens para nao trazer dados de versoes antigas.
    let votes: unknown[] = [];
    let comments: unknown[] = [];

    if (itinerary) {
      const itemIds = itinerary.itinerary_days.flatMap((d) =>
        d.itinerary_items.map((i) => i.id)
      );

      if (itemIds.length) {
        const [v, c] = await Promise.all([
          db.from("votes").select("item_id, member_id, value").in("item_id", itemIds),
          db
            .from("comments")
            .select("id, item_id, member_id, body, created_at")
            .in("item_id", itemIds)
            .order("created_at"),
        ]);
        votes = v.data ?? [];
        comments = c.data ?? [];
      }
    }

    return NextResponse.json({
      trip,
      members: members.data ?? [],
      preferences: preferences.data ?? [],
      itinerary,
      votes,
      comments,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar a viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
