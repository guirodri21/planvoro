/**
 * Conversao de moeda para real.
 *
 * Existe porque a IA fazia essa conta sozinha e errava de um jeito
 * especifico: ela usava uma taxa diferente por item. No mesmo roteiro de
 * Lisboa, o Castelo de Sao Jorge saiu a R$ 5,29 por euro, o Mosteiro dos
 * Jeronimos a R$ 7,00 e o Palacio da Ajuda a R$ 3,00 — com o euro real a
 * R$ 5,94. Nenhum usuario percebe isso olhando um item; percebe quando
 * chega no destino e o orcamento nao fecha.
 *
 * Converter e aritmetica, e aritmetica nao se pede para um modelo de
 * linguagem. A IA agora devolve so o preco na moeda local; a conta vem
 * daqui, com UMA taxa por geracao.
 */

/**
 * Rede de seguranca. Se a cotacao do dia nao vier, o roteiro nao pode
 * parar de ser gerado — mas tambem nao pode inventar. Estes valores sao
 * de referencia e ficam desatualizados de proposito devagar: erro de 10%
 * numa estimativa arredondada e aceitavel, erro de 100% nao.
 *
 * Atualizado em 2026-09-08 com a referencia do Banco Central Europeu.
 */
const FALLBACK: Record<string, number> = {
  BRL: 1,
  EUR: 5.94,
  USD: 5.07,
  GBP: 6.85,
  ARS: 0.0035,
  CLP: 0.0053,
  UYU: 0.13,
  JPY: 0.034,
  MXN: 0.27,
  CAD: 3.7,
  AUD: 3.35,
  CHF: 6.35,
};

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { taxas: Record<string, number>; validoAte: number } | null = null;

/**
 * Frankfurter serve a referencia do BCE, sem chave e sem limite pratico.
 * Timeout curto porque isto roda no caminho da geracao: cotacao boa nao
 * vale segurar um roteiro.
 */
async function buscarTaxas(): Promise<Record<string, number>> {
  const moedas = Object.keys(FALLBACK).filter((m) => m !== "BRL");
  const url = `https://api.frankfurter.app/latest?from=BRL&to=${moedas.join(",")}`;

  const controle = new AbortController();
  const corte = setTimeout(() => controle.abort(), 2500);
  try {
    const resposta = await fetch(url, { signal: controle.signal });
    if (!resposta.ok) return FALLBACK;
    const dados = (await resposta.json()) as { rates?: Record<string, number> };
    if (!dados.rates) return FALLBACK;

    // A API devolve quantas unidades da moeda valem 1 real. Queremos o
    // inverso: quantos reais vale 1 unidade da moeda.
    const taxas: Record<string, number> = { BRL: 1 };
    for (const [moeda, porReal] of Object.entries(dados.rates)) {
      if (porReal > 0) taxas[moeda] = 1 / porReal;
    }
    return { ...FALLBACK, ...taxas };
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(corte);
  }
}

export async function taxasDoDia(): Promise<Record<string, number>> {
  if (cache && Date.now() < cache.validoAte) return cache.taxas;
  const taxas = await buscarTaxas();
  cache = { taxas, validoAte: Date.now() + TTL_MS };
  return taxas;
}

/**
 * Arredonda com a granularidade que o numero merece. Uma estimativa nao
 * deve fingir precisao de centavo: "R$ 0,30" numa entrada gratuita foi um
 * caso real, e o centavo e o que faz o numero parecer conferido.
 */
export function arredondarEstimativa(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  if (valor < 20) return Math.round(valor);
  if (valor < 100) return Math.round(valor / 5) * 5;
  return Math.round(valor / 10) * 10;
}

/**
 * Preco na moeda local -> real. Moeda desconhecida devolve null em vez de
 * chutar: somar um numero errado ao orcamento e pior que somar nada.
 */
export function paraReais(
  local: number | null | undefined,
  moeda: string | null | undefined,
  taxas: Record<string, number>
): number | null {
  if (local == null || !Number.isFinite(local) || local <= 0) return 0;
  const codigo = (moeda ?? "BRL").toUpperCase().slice(0, 3);
  const taxa = taxas[codigo];
  if (!taxa) return null;
  return arredondarEstimativa(local * taxa);
}
