import { paraReais, taxasDoDia } from "./fx";
import { generateItinerary } from "./generate";
import { sampleDates } from "./sample";
import type { Member, Preference, Trip } from "./types";

/**
 * Gera o roteiro de amostra de um destino (dois dias, grupo ficticio).
 *
 * Usado pela amostra sem conta (/api/sample) e pela vitrine de roteiros
 * (/api/cron/vitrine). Um gerador so, para as paginas do Google e a
 * amostra da home mostrarem o mesmo formato.
 *
 * Configuracao propria da amostra: sao dois dias, sem ideias do grupo e
 * sem votacao — cabe numa fracao do orcamento de um roteiro completo.
 * Medido em producao, a mesma chamada com a configuracao cheia levava de
 * 29 a 42 segundos, e quem esta decidindo se cria conta nao espera isso.
 */
export async function gerarAmostra(destination: string) {
  const dates = sampleDates();
  const generated = await generateItinerary(
    buildSampleTrip(destination, dates),
    SAMPLE_MEMBERS,
    SAMPLE_PREFS,
    [],
    [],
    dates,
    { thinkingLevel: "MINIMAL", maxOutputTokens: 2500 }
  );

  // Mesma conversao do roteiro completo: sem ela o custo sairia vazio,
  // porque a IA devolve o valor na moeda local e nao em real.
  const taxas = await taxasDoDia();
  for (const day of generated.days ?? []) {
    for (const item of day.items ?? []) {
      item.cost_estimate = paraReais(item.cost_local ?? 0, item.cost_currency ?? "BRL", taxas) ?? 0;
    }
  }
  return generated;
}

/**
 * Viagem ficticia so para alimentar o gerador.
 *
 * Um grupo pequeno com interesses variados, que e o caso mais comum e o
 * que melhor mostra o que o Planvoro faz de diferente: equilibrar gente
 * que quer coisas diferentes.
 */
function buildSampleTrip(destination: string, dates: string[]): Trip {
  return {
    id: "sample",
    slug: "sample",
    destination,
    start_date: dates[0],
    end_date: dates[dates.length - 1],
    party_size: 4,
    budget_band: "Confortável",
    styles: ["Gastronomia", "Cultura", "Natureza"],
    is_solo: false,
    is_public: false,
  };
}

const SAMPLE_MEMBERS: Member[] = [
  { id: "s1", trip_id: "sample", name: "Ana", is_organizer: true, color: "#4ade80" },
  { id: "s2", trip_id: "sample", name: "Bruno", is_organizer: false, color: "#22d3ee" },
];

const SAMPLE_PREFS: Record<string, Preference> = {
  s1: {
    id: "p1",
    member_id: "s1",
    interests: ["Gastronomia", "Cultura"],
    restrictions: [],
    daily_budget: null,
    present_from: null,
    present_to: null,
  },
  s2: {
    id: "p2",
    member_id: "s2",
    interests: ["Natureza", "Caminhada"],
    restrictions: ["Vegetariano"],
    daily_budget: null,
    present_from: null,
    present_to: null,
  },
};
