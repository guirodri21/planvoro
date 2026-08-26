import type { SupabaseClient } from "@supabase/supabase-js";
import { isProStatusActive, isTripEntitlementActive } from "@/lib/billing";

/**
 * Limites de uso da IA.
 *
 * O objetivo nao e monetizar, e evitar que uma conta sozinha gere custo
 * ilimitado de modelo. Os numeros sao folgados para uso real e apertados
 * para abuso.
 *
 * O evento e gravado ANTES da chamada ao modelo: o custo nasce na chamada,
 * entao contar apenas as respostas bem-sucedidas deixaria o retry livre.
 *
 * Quem pagou tem teto mais alto, nao teto infinito. Sem nenhum limite, um
 * unico script com uma assinatura ativa consegue queimar a conta de IA do
 * mes inteiro.
 */

export type AiUsageKind = "itinerary_generation" | "agent_question" | "vault_import";

/** free = beta gratis. trip_pass = esta viagem foi liberada. pro = assinatura ativa. */
export type BillingTier = "free" | "trip_pass" | "pro";

type LimitRule = {
  /** Teto por viagem, somando todos os participantes. */
  perTripTotal?: number;
  /** Teto por usuario nas ultimas 24h. */
  perUserPerDay?: number;
  /** Nome usado na mensagem de erro. */
  label: string;
};

const FREE_LIMITS: Record<AiUsageKind, LimitRule> = {
  itinerary_generation: {
    perTripTotal: 15,
    perUserPerDay: 25,
    label: "geracoes de roteiro",
  },
  agent_question: {
    perUserPerDay: 40,
    label: "perguntas ao agente",
  },
  vault_import: {
    perUserPerDay: 30,
    label: "importacoes do Cofre",
  },
};

const PAID_LIMITS: Record<AiUsageKind, LimitRule> = {
  itinerary_generation: {
    perTripTotal: 80,
    perUserPerDay: 120,
    label: "geracoes de roteiro",
  },
  agent_question: {
    perUserPerDay: 250,
    label: "perguntas ao agente",
  },
  vault_import: {
    perUserPerDay: 150,
    label: "importacoes do Cofre",
  },
};

export const AI_LIMITS = FREE_LIMITS;

/** Teto de viagens criadas por pessoa. */
export const TRIPS_PER_USER = 12;
export const TRIPS_PER_PRO_USER = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

function limitsFor(tier: BillingTier) {
  return tier === "free" ? FREE_LIMITS : PAID_LIMITS;
}

/**
 * Descobre o que a pessoa pagou.
 *
 * O passe de viagem vale para a viagem, nao para a pessoa: qualquer
 * participante de uma viagem liberada usa o teto maior ali dentro, porque
 * quem pagou comprou para o grupo.
 */
export async function resolveBillingTier(
  db: SupabaseClient,
  userId: string,
  tripId?: string
): Promise<BillingTier> {
  const { data: subscription } = await db
    .from("user_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (isProStatusActive(subscription?.status, subscription?.current_period_end)) {
    return "pro";
  }

  if (tripId) {
    const { data: entitlement } = await db
      .from("trip_entitlements")
      .select("status, access_expires_at")
      .eq("trip_id", tripId)
      .eq("status", "paid")
      .maybeSingle();

    if (isTripEntitlementActive(entitlement?.status, entitlement?.access_expires_at)) {
      return "trip_pass";
    }
  }

  return "free";
}

export async function tripsAllowedFor(db: SupabaseClient, userId: string) {
  const tier = await resolveBillingTier(db, userId);
  return tier === "pro" ? TRIPS_PER_PRO_USER : TRIPS_PER_USER;
}

async function countEvents(
  db: SupabaseClient,
  filters: { kind: AiUsageKind; userId?: string; tripId?: string; since?: string }
) {
  let query = db
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", filters.kind);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.tripId) query = query.eq("trip_id", filters.tripId);
  if (filters.since) query = query.gte("created_at", filters.since);

  const { count, error } = await query;
  if (error) throw error;

  return count ?? 0;
}

/**
 * Confere os limites e, se houver espaco, registra o uso.
 *
 * Retorna `null` quando pode seguir, ou uma mensagem pronta para o usuario
 * quando o limite estourou.
 */
export async function reserveAiUsage(
  db: SupabaseClient,
  params: { kind: AiUsageKind; userId: string; tripId: string }
): Promise<string | null> {
  const tier = await resolveBillingTier(db, params.userId, params.tripId);
  const rule = limitsFor(tier)[params.kind];
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const upgradeHint =
    tier === "free" ? " Liberar esta viagem aumenta bastante esse limite." : " Fale com a gente se precisar de mais.";

  if (rule.perTripTotal !== undefined) {
    const used = await countEvents(db, { kind: params.kind, tripId: params.tripId });
    if (used >= rule.perTripTotal) {
      return `Esta viagem ja usou as ${rule.perTripTotal} ${rule.label} disponiveis.${upgradeHint}`;
    }
  }

  if (rule.perUserPerDay !== undefined) {
    const used = await countEvents(db, {
      kind: params.kind,
      userId: params.userId,
      since,
    });
    if (used >= rule.perUserPerDay) {
      return `Voce atingiu o limite de ${rule.perUserPerDay} ${rule.label} por dia. Tente de novo em algumas horas.`;
    }
  }

  const { error } = await db.from("ai_usage_events").insert({
    user_id: params.userId,
    trip_id: params.tripId,
    kind: params.kind,
  });
  if (error) throw error;

  return null;
}
