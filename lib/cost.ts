/**
 * Como o custo de um item do roteiro aparece na tela.
 *
 * Vive em lib/ porque duas rotas mostram a mesma coisa: o workspace da
 * viagem e a pagina publica. Duas copias divergiriam, e divergencia em
 * numero de dinheiro e o tipo de erro que ninguem percebe olhando.
 */

const moedaBR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function emReais(valor: number) {
  return moedaBR.format(Number.isFinite(valor) ? valor : 0);
}

/**
 * Moeda qualquer. Codigo desconhecido cai em "JPY 1.200" em vez de
 * quebrar: numero legivel com o codigo ao lado vale mais que erro.
 */
function naMoeda(valor: number, codigo: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: codigo }).format(valor);
  } catch {
    return `${codigo} ${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)}`;
  }
}

/**
 * Custo de um item do roteiro, dito com honestidade.
 *
 * Converter e inevitavel: orcamento de brasileiro e em real. O que nao
 * pode e apresentar a conversao como preco. Um almoco em Roma aparecia
 * "R$ 120" — sem euro, sem taxa, e sem como conferir num site italiano.
 *
 * A conta deixou de ser da IA em 08/09/2026: ela usava uma taxa diferente
 * por item no mesmo roteiro. Hoje a conversao vem de lib/fx.ts, com uma
 * taxa unica por geracao, e o til aqui marca o arredondamento — nao mais
 * uma cotacao inventada.
 *
 * Regra: no Brasil, so o real. Fora, a moeda local primeiro, porque e ela
 * que vai estar no cardapio, com o real entre parenteses e um til
 * assumindo a aproximacao.
 */
export function formatItemCost(
  cost: number | null,
  local: number | null,
  currency: string | null
) {
  if (!cost && !local) return "grátis";

  const moeda = (currency ?? "BRL").toUpperCase();
  const emReal = `~${emReais(cost ?? 0)}`;

  if (moeda === "BRL" || local === null) return emReal;

  return `${naMoeda(local, moeda)} (${emReal})`;
}

/**
 * Total de um dia, na mesma linguagem dos itens.
 *
 * Os itens passaram a mostrar "€ 18,00 (~R$ 110,00)" e o cabecalho do dia
 * continuou "~R$ 440,00". Ler as duas coisas juntas obriga a pessoa a
 * somar euros de cabeca para conferir o total — ou a acreditar num numero
 * que ela nao consegue reconstruir.
 *
 * Se o dia mistura moedas, cai no real sozinho: somar euro com iene daria
 * um numero que nao existe em lugar nenhum.
 */
export function formatDayTotal(
  itens: ReadonlyArray<{
    cost_estimate: number | null;
    cost_local?: number | null;
    cost_currency?: string | null;
  }>
) {
  const emReal = itens.reduce((soma, item) => soma + (item.cost_estimate ?? 0), 0);
  const total = `~${emReais(emReal)}`;

  const moedas = new Set(
    itens
      .map((item) => (item.cost_currency ?? "BRL").toUpperCase())
      .filter((moeda) => moeda !== "BRL")
  );

  if (moedas.size !== 1) return total;

  const moeda = [...moedas][0];
  const temTodos = itens.every((item) => item.cost_local !== null && item.cost_local !== undefined);
  if (!temTodos) return total;

  const local = itens.reduce((soma, item) => soma + (item.cost_local ?? 0), 0);
  return `${naMoeda(local, moeda)} (${total})`;
}
