/**
 * A vitrine indexavel do Planvoro.
 *
 * O produto ja gera e guarda roteiros de verdade em sample_itineraries —
 * 16 destinos em 21/09/2026, cada um com dois dias, horario e custo por
 * parada. Nada disso tinha URL. O sitemap listava seis paginas fixas e
 * cinco /r/ de viagens de teste, quatro delas do mesmo Salvador e todas
 * respondendo "roteiro nao encontrado": a superficie de busca do site era
 * zero.
 *
 * Isso importa porque "roteiro 3 dias em Foz do Iguacu quanto custa" e
 * exatamente a pergunta que o produto responde, e quem digita isso no
 * Google esta a um passo de querer o produto — diferente de quem rola o
 * feed. Entre 08 e 21/09 o Instagram e o TikTok entregaram, somados,
 * menos de 20 visualizacoes; as duas unicas pessoas reais que pediram
 * amostra vieram de um diretorio, nao de rede social.
 *
 * Por que ler direto da tabela em vez de readSampleCache: aquela funcao
 * tem janela de 30 dias, certa para cache e errada para vitrine. Pagina
 * publica nao pode sumir do indice do Google porque envelheceu — some
 * do indice, perde a posicao, e recuperar leva meses.
 */

import { supabaseAdmin } from "@/lib/supabase";

export type ItemRoteiro = {
  start_time: string;
  title: string;
  description: string;
  cost_estimate: number;
  /** Valor na moeda do destino. Ausente em amostra guardada antes de 06/09. */
  cost_local?: number | null;
  cost_currency?: string | null;
  needs_vote?: boolean;
};

export type DiaRoteiro = {
  day_date: string;
  title: string;
  note: string;
  items: ItemRoteiro[];
};

export type RoteiroPublico = {
  chave: string;
  destino: string;
  atualizadoEm: string;
  rationale: string;
  dias: DiaRoteiro[];
};

type LinhaAmostra = {
  destination_key: string;
  destination: string;
  created_at: string;
  payload: { rationale?: string; days?: DiaRoteiro[] } | null;
};

function montar(linha: LinhaAmostra): RoteiroPublico | null {
  const dias = linha.payload?.days ?? [];
  // Um roteiro sem dia nenhum vira pagina vazia no indice do Google, que
  // e pior que pagina nenhuma: conta como conteudo fraco no dominio todo.
  if (dias.length === 0) return null;

  return {
    chave: linha.destination_key,
    destino: linha.destination,
    atualizadoEm: linha.created_at,
    rationale: linha.payload?.rationale ?? "",
    dias,
  };
}

/** Todos os roteiros que tem pagina propria, do mais recente para o mais antigo. */
export async function listarRoteirosPublicos(): Promise<RoteiroPublico[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("sample_itineraries")
      .select("destination_key, destination, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(500);

    return ((data ?? []) as LinhaAmostra[]).map(montar).filter((r): r is RoteiroPublico => r !== null);
  } catch {
    // Sem chave configurada o build nao pode quebrar: a rota passa a
    // existir sem paginas, e volta sozinha no proximo revalidate.
    return [];
  }
}

/** Um roteiro pelo destination_key da URL. `null` quando nao existe. */
export async function lerRoteiroPublico(chave: string): Promise<RoteiroPublico | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("sample_itineraries")
      .select("destination_key, destination, created_at, payload")
      .eq("destination_key", chave)
      .maybeSingle();

    return data ? montar(data as LinhaAmostra) : null;
  } catch {
    return null;
  }
}

/** Soma dos custos estimados de todos os dias, em reais. */
export function custoTotal(dias: DiaRoteiro[]): number {
  return dias.reduce(
    (total, dia) => total + dia.items.reduce((soma, item) => soma + (item.cost_estimate ?? 0), 0),
    0
  );
}
