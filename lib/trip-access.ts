import type { SupabaseClient } from "@supabase/supabase-js";
import { betaAccessEnabled } from "@/lib/beta";
import { isProStatusActive, isTripEntitlementActive } from "@/lib/billing";

/**
 * O que esta liberado numa viagem.
 *
 * A regra central: o acesso segue a VIAGEM, nao a pessoa. Se o
 * organizador liberou, todo mundo que participa usa Cofre, gastos,
 * checklist e modo viagem — inclusive quem entrou por convite e nunca
 * pagou nada. Amarrar isso ao usuario quebraria a promessa de que
 * convidado nunca paga, e transformaria cada viagem numa cobranca por
 * cabeca.
 *
 * Uma viagem esta liberada quando:
 *   - a beta gratis esta ligada; ou
 *   - alguem comprou o Passe dela e ele nao expirou; ou
 *   - quem organiza tem o Pro ativo.
 */

export type TripAccessReason = "beta" | "trip_pass" | "pro" | "locked";

export type TripAccess = {
  unlocked: boolean;
  reason: TripAccessReason;
};

const LOCKED: TripAccess = { unlocked: false, reason: "locked" };

export async function resolveTripAccess(
  db: SupabaseClient,
  tripId: string
): Promise<TripAccess> {
  if (betaAccessEnabled) return { unlocked: true, reason: "beta" };

  const { data: entitlement } = await db
    .from("trip_entitlements")
    .select("status, access_expires_at")
    .eq("trip_id", tripId)
    .eq("status", "paid")
    .maybeSingle();

  if (isTripEntitlementActive(entitlement?.status, entitlement?.access_expires_at)) {
    return { unlocked: true, reason: "trip_pass" };
  }

  // O Pro de quem organiza cobre a viagem inteira. Um participante Pro
  // nao libera a viagem dos outros: o plano dele e dele.
  const { data: organizers } = await db
    .from("members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("is_organizer", true);

  const organizerIds = (organizers ?? [])
    .map((row) => row.user_id as string | null)
    .filter((id): id is string => Boolean(id));

  if (organizerIds.length) {
    const { data: subscriptions } = await db
      .from("user_subscriptions")
      .select("status, current_period_end")
      .in("user_id", organizerIds);

    const proOrganizer = (subscriptions ?? []).some((row) =>
      isProStatusActive(row.status as string, row.current_period_end as string | null)
    );

    if (proOrganizer) return { unlocked: true, reason: "pro" };
  }

  return LOCKED;
}

/** Mensagem para quem tentou escrever numa viagem trancada. */
export function lockedMessage(feature: string) {
  return `${feature} faz parte do Passe desta viagem. Peca ao organizador para liberar, ou assine o Pro.`;
}
