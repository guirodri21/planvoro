/**
 * Alertas de orcamento.
 *
 * Compara o que o grupo ja lancou em gastos com o teto que o organizador
 * definiu. Trabalha so com gastos lancados: somar tambem o Cofre parece
 * mais completo, mas quem paga o hotel costuma lancar o mesmo valor como
 * gasto do grupo, e a soma dobraria sem ninguem perceber.
 */

export type BudgetStatus = "sem_orcamento" | "tranquilo" | "atencao" | "no_limite" | "estourado";

export type BudgetSummary = {
  status: BudgetStatus;
  /** Teto do grupo inteiro, em BRL. */
  total: number;
  spent: number;
  remaining: number;
  /** 0 a 1, sem teto: passa de 1 quando estoura. */
  ratio: number;
  perPerson: number;
  spentPerPerson: number;
  headline: string;
  detail: string;
};

const EMPTY: BudgetSummary = {
  status: "sem_orcamento",
  total: 0,
  spent: 0,
  remaining: 0,
  ratio: 0,
  perPerson: 0,
  spentPerPerson: 0,
  headline: "Sem orçamento definido",
  detail: "Defina quanto cada pessoa pretende gastar para acompanhar o quanto já foi.",
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function summarizeBudget({
  budgetPerPerson,
  headcount,
  totalSpent,
}: {
  budgetPerPerson?: number | null;
  headcount: number;
  totalSpent: number;
}): BudgetSummary {
  const perPerson = Number(budgetPerPerson ?? 0);
  const people = Math.max(1, headcount);

  if (!Number.isFinite(perPerson) || perPerson <= 0) return EMPTY;

  const total = perPerson * people;
  const spent = Math.max(0, Number(totalSpent) || 0);
  const remaining = total - spent;
  const ratio = spent / total;
  const spentPerPerson = spent / people;

  if (ratio >= 1) {
    return {
      status: "estourado",
      total,
      spent,
      remaining,
      ratio,
      perPerson,
      spentPerPerson,
      headline: `Passou ${money(Math.abs(remaining))} do orçamento`,
      detail: `O grupo previu ${money(total)} e já lançou ${money(spent)}. Vale revisar o que ainda falta pagar.`,
    };
  }

  if (ratio >= 0.85) {
    return {
      status: "no_limite",
      total,
      spent,
      remaining,
      ratio,
      perPerson,
      spentPerPerson,
      headline: `Restam ${money(remaining)} do orçamento`,
      detail: `Vocês usaram ${Math.round(ratio * 100)}% do previsto. O que ainda não foi pago cabe nesse resto?`,
    };
  }

  if (ratio >= 0.6) {
    return {
      status: "atencao",
      total,
      spent,
      remaining,
      ratio,
      perPerson,
      spentPerPerson,
      headline: `${Math.round(ratio * 100)}% do orçamento usado`,
      detail: `${money(remaining)} ainda disponíveis, ou ${money(remaining / people)} por pessoa.`,
    };
  }

  return {
    status: "tranquilo",
    total,
    spent,
    remaining,
    ratio,
    perPerson,
    spentPerPerson,
    headline: `${money(remaining)} disponíveis`,
    detail: `De ${money(total)} previstos, ${money(spent)} já foram lançados.`,
  };
}

export function budgetTone(status: BudgetStatus): "ok" | "warn" | "neutral" {
  if (status === "estourado" || status === "no_limite") return "warn";
  if (status === "atencao") return "neutral";
  return "ok";
}
