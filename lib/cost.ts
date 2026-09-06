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
 * A IA converte moeda sozinha, e converter e inevitavel: orcamento de
 * brasileiro e em real. O que nao pode e apresentar a conversao como
 * preco. Um almoco em Roma aparecia "R$ 120" — sem euro, sem taxa, e sem
 * como conferir num site italiano.
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
