import { supabaseAdmin } from "./supabase";
import type { Itinerary, Trip } from "./types";

export type PublicTrip = { trip: Trip; itinerary: Itinerary | null };

type DayRow = { position: number; itinerary_items: { position: number }[] };

/**
 * Leitura do roteiro publico, feita no servidor.
 * E o que alimenta as paginas indexaveis pelo Google -- o canal de
 * aquisicao organica que nao custa nada.
 */
/**
 * A viagem existe? E esta publicada?
 *
 * Sao perguntas diferentes e o 404 respondia as duas do mesmo jeito. Quem
 * compartilhava o link antes de publicar via a propria pagina sumir, sem
 * nada dizendo que faltava um clique — enquanto a tabela de precos
 * anuncia "Pagina publica do roteiro" como recurso incluso.
 *
 * Nao devolve dado nenhum da viagem nao publicada. Saber que ela existe ja
 * esta implicito em quem tem o link; o conteudo continua fechado.
 */
export async function getTripPublishState(
  slug: string
): Promise<"publicado" | "nao-publicado" | "inexistente"> {
  const db = supabaseAdmin();

  const { data } = await db
    .from("trips")
    .select("is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return "inexistente";
  return data.is_public ? "publicado" : "nao-publicado";
}

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
