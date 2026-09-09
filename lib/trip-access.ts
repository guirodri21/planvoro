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
 *   - ela esta no teste gratis de 7 dias; ou
 *   - quem organiza tem o Pro ativo.
 */

export type TripAccessReason = "beta" | "trip_pass" | "trial" | "pro" | "locked";

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

  const { data: entitlements } = await db
    .from("trip_entitlements")
    .select("status, access_expires_at")
    .eq("trip_id", tripId)
    .in("status", ["paid", "trial"]);

  for (const linha of entitlements ?? []) {
    const status = linha.status as string;
    const expira = linha.access_expires_at as string | null;

    if (status === "paid" && isTripEntitlementActive(status, expira)) {
      return { unlocked: true, reason: "trip_pass" };
    }

    // Teste gratis: mesma liberacao do Passe, so que com prazo. Vencido,
    // a viagem tranca de novo — e nada do que foi salvo e apagado, como
    // em qualquer outro caso de tranca.
    if (status === "trial" && expira && new Date(expira).getTime() > Date.now()) {
      return { unlocked: true, reason: "trial" };
    }
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

/**
 * Mensagem para quem tentou escrever numa viagem trancada.
 *
 * A saida muda com quem esta lendo. A versao anterior mandava "peca ao
 * organizador" para todo mundo — inclusive para o proprio organizador,
 * que ficava sendo instruido a pedir para si mesmo. Quem pode resolver
 * precisa do caminho; quem nao pode precisa saber que nao vai pagar nada.
 */
export function lockedMessage(feature: string, isOrganizer = false) {
  if (isOrganizer) {
    return `${feature} faz parte do Passe desta viagem. Libere no seu painel, ou teste 7 dias grátis.`;
  }
  return `${feature} faz parte do Passe desta viagem. Peça ao organizador para liberar — você não paga nada.`;
}
