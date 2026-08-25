import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guardas de autorizacao.
 *
 * Agora a identidade vem do Supabase Auth e cada participacao da viagem aponta
 * para um usuario autenticado em `members.user_id`.
 *
 * Toda rota de escrita precisa confirmar:
 *   1. a pessoa autenticada participa mesmo desta viagem
 *   2. o recurso alvo pertence mesmo a esta viagem
 * Sem a segunda, quem descobrir o id de um item de outra viagem consegue
 * escrever nela.
 */

export async function memberForUserInTrip(
  db: SupabaseClient,
  slug: string,
  userId: string
): Promise<{ tripId: string; memberId: string; isOrganizer: boolean } | null> {
  const { data: trip } = await db.from("trips").select("id").eq("slug", slug).maybeSingle();
  if (!trip) return null;

  const { data: member } = await db
    .from("members")
    .select("id, is_organizer")
    .eq("user_id", userId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  return member
    ? { tripId: trip.id, memberId: member.id, isOrganizer: Boolean(member.is_organizer) }
    : null;
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

export async function ideaBelongsToTrip(
  db: SupabaseClient,
  tripId: string,
  ideaId: string
): Promise<boolean> {
  const { data } = await db
    .from("ideas")
    .select("id")
    .eq("id", ideaId)
    .eq("trip_id", tripId)
    .maybeSingle();

  return Boolean(data);
}

export async function memberIdsBelongToTrip(
  db: SupabaseClient,
  tripId: string,
  memberIds: string[]
): Promise<boolean> {
  const uniqueIds = [...new Set(memberIds.filter(Boolean))];
  if (!uniqueIds.length) return false;

  const { data, error } = await db.from("members").select("id").eq("trip_id", tripId).in("id", uniqueIds);
  if (error) throw error;

  return (data?.length ?? 0) === uniqueIds.length;
}
