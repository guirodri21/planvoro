import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Regras da edicao manual do roteiro.
 *
 * O roteiro so mudava gerando de novo, o que gasta IA e reescreve o dia
 * inteiro para trocar um restaurante. Agora quem organiza ajusta item a
 * item. Os participantes continuam votando e comentando — editar e do
 * organizador, pela mesma razao de apagar a viagem: a mudanca vale para
 * o grupo todo.
 */

export const LIMITES = {
  titulo: 120,
  descricao: 600,
  custoMaximo: 1_000_000,
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ItemEditavel = {
  title?: string;
  description?: string | null;
  start_time?: string | null;
  cost_estimate?: number | null;
};

/** Valida e normaliza o corpo. Devolve mensagem de erro ou os campos limpos. */
export function lerItem(
  body: Record<string, unknown>,
  { exigirTitulo }: { exigirTitulo: boolean }
): { erro: string } | { item: ItemEditavel } {
  const item: ItemEditavel = {};

  if ("title" in body || exigirTitulo) {
    const titulo = String(body.title ?? "").trim().slice(0, LIMITES.titulo);
    if (titulo.length < 2) return { erro: "Dê um nome ao item (pelo menos 2 letras)." };
    item.title = titulo;
  }

  if ("description" in body) {
    const descricao = String(body.description ?? "").trim().slice(0, LIMITES.descricao);
    item.description = descricao || null;
  }

  if ("start_time" in body) {
    const hora = String(body.start_time ?? "").trim();
    if (hora && !HORA.test(hora)) return { erro: "Horário inválido. Use o formato 14:30." };
    item.start_time = hora || null;
  }

  if ("cost_estimate" in body) {
    const bruto = body.cost_estimate;
    if (bruto === null || bruto === "" || bruto === undefined) {
      item.cost_estimate = null;
    } else {
      const valor = Number(String(bruto).replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0 || valor > LIMITES.custoMaximo) {
        return { erro: "Custo inválido." };
      }
      item.cost_estimate = Math.round(valor * 100) / 100;
    }
  }

  return { item };
}

/** O dia pertence a esta viagem? Sem isso, um id de outra viagem passaria. */
export async function dayBelongsToTrip(db: SupabaseClient, tripId: string, dayId: string) {
  const { data } = await db
    .from("itinerary_days")
    .select("id, itineraries!inner(trip_id)")
    .eq("id", dayId)
    .maybeSingle();
  const itinerary = (data as { itineraries?: { trip_id?: string } | null } | null)?.itineraries;
  return Boolean(data && itinerary?.trip_id === tripId);
}

/**
 * Reescreve as posicoes do dia em sequencia (0, 1, 2...).
 *
 * Itens criados pela IA e itens criados a mao convivem no mesmo dia; com
 * posicoes repetidas ou buracos, "subir" trocaria com o item errado.
 */
export async function renumerarDia(db: SupabaseClient, dayId: string, ordem: string[]) {
  await Promise.all(
    ordem.map((id, position) =>
      db.from("itinerary_items").update({ position }).eq("id", id).eq("day_id", dayId)
    )
  );
}

export async function idsDoDia(db: SupabaseClient, dayId: string) {
  const { data, error } = await db
    .from("itinerary_items")
    .select("id, position")
    .eq("day_id", dayId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}
