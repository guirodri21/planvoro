import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Limites de uso da IA na beta gratis.
 *
 * O objetivo aqui nao e monetizar, e evitar que uma conta sozinha gere
 * custo ilimitado de modelo antes de existir cobranca. Os numeros sao
 * folgados para uso real e apertados para abuso.
 *
 * O evento e gravado ANTES da chamada ao modelo: o custo nasce na chamada,
 * entao contar apenas as respostas bem-sucedidas deixaria o retry livre.
 */

export type AiUsageKind = "itinerary_generation" | "agent_question" | "vault_import";

type LimitRule = {
  /** Teto por viagem, somando todos os participantes. */
  perTripTotal?: number;
  /** Teto por usuario nas ultimas 24h. */
  perUserPerDay?: number;
  /** Nome usado na mensagem de erro. */
  label: string;
};

export const AI_LIMITS: Record<AiUsageKind, LimitRule> = {
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

/** Teto de viagens por usuario enquanto a beta gratis estiver ligada. */
export const TRIPS_PER_USER = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const rule = AI_LIMITS[params.kind];
  const since = new Date(Date.now() - DAY_MS).toISOString();

  if (rule.perTripTotal !== undefined) {
    const used = await countEvents(db, { kind: params.kind, tripId: params.tripId });
    if (used >= rule.perTripTotal) {
      return `Esta viagem ja usou as ${rule.perTripTotal} ${rule.label} incluidas na beta. Fale com a gente se precisar de mais.`;
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
