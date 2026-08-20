import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guardas de autorizacao.
 *
 * O MVP nao tem login: a pessoa e identificada por um member_id guardado no
 * navegador. Isso e proposital -- exigir cadastro mata o convite. Mas significa
 * que TODA rota de escrita precisa confirmar duas coisas no servidor:
 *   1. esse member_id pertence mesmo a esta viagem
 *   2. o recurso alvo pertence mesmo a esta viagem
 * Sem a segunda, quem descobrir o id de um item de outra viagem consegue
 * escrever nela.
 */

export async function memberBelongsToTrip(
  db: SupabaseClient,
  slug: string,
  memberId: string
): Promise<{ id: string } | null> {
  const { data: trip } = await db.from("trips").select("id").eq("slug", slug).maybeSingle();
  if (!trip) return null;

  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  return member ? { id: trip.id } : null;
}

export async function itemBelongsToTrip(
  db: SupabaseClient,
  tripId: string,
  itemId: string
): Promise<boolean> {
  const { data } = await db
    .from("itinerary_items")
    .select("id, itinerary_days!inner(itineraries!inner(trip_id))")
    .eq("id", itemId)
    .maybeSingle();

  if (!data) return false;

  const days = data.itinerary_days as unknown as { itineraries: { trip_id: string } };
  return days?.itineraries?.trip_id === tripId;
}
