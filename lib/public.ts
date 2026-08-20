import { supabaseAdmin } from "./supabase";
import type { Itinerary, Trip } from "./types";

export type PublicTrip = { trip: Trip; itinerary: Itinerary | null };

type DayRow = { position: number; itinerary_items: { position: number }[] };

/**
 * Leitura do roteiro publico, feita no servidor.
 * E o que alimenta as paginas indexaveis pelo Google -- o canal de
 * aquisicao organica que nao custa nada.
 */
export async function getPublicTrip(slug: string): Promise<PublicTrip | null> {
  const db = supabaseAdmin();

  const { data: trip } = await db
    .from("trips")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!trip) return null;

  const { data: rows } = await db
    .from("itineraries")
    .select("id, version, rationale, itinerary_days(*, itinerary_items(*))")
    .eq("trip_id", trip.id)
    .order("version", { ascending: false })
    .limit(1);

  const itinerary = (rows?.[0] ?? null) as
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

  return { trip: trip as Trip, itinerary: itinerary as unknown as Itinerary | null };
}

export function tripDays(trip: Trip) {
  const start = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function formatBR(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
