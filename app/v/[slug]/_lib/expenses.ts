/**
 * Saldo do grupo e plano de acerto.
 *
 * Separado da tela porque e a parte que decide quanto cada um deve, e
 * calculo de dinheiro merece um arquivo onde da para ler tudo de uma vez
 * sem rolar por componentes de interface.
 */

import type { Expense, Member } from "@/lib/types";

export type MemberExpenseBalance = {
  member: Member;
  paid: number;
  share: number;
  balance: number;
};

export type ExpenseSettlement = {
  from: Member;
  to: Member;
  amount: number;
};

/** Centavo e a menor unidade: arredondar antes evita resto de ponto flutuante. */
export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Quanto cada pessoa pagou e quanto deveria ter pago.
 *
 * `balance` positivo significa que a pessoa adiantou dinheiro do grupo e
 * tem a receber; negativo, que ela deve.
 */
export function calculateExpenseBalances(expenses: Expense[], members: Member[]) {
  return members.map((member) => {
    let paid = 0;
    let share = 0;

    for (const expense of expenses) {
      const value = Number(expense.amount ?? 0);
      if (expense.payer_member_id === member.id) {
        paid += value;
      }
      if (expense.split_member_ids.includes(member.id) && expense.split_member_ids.length > 0) {
        share += value / expense.split_member_ids.length;
      }
    }

    return {
      member,
      paid: roundMoney(paid),
      share: roundMoney(share),
      balance: roundMoney(paid - share),
    };
  });
}

/**
 * Quem paga quem, no menor numero de transferencias.
 *
 * Casa o maior devedor com o maior credor ate zerar. Nao e o minimo
 * teorico de transferencias, mas evita o caso ruim de todo mundo pagar
 * um pouco para todo mundo — que e o que acontece quando o grupo tenta
 * acertar na mao.
 *
 * A conta corre em centavos inteiros de proposito: somar e subtrair reais
 * em ponto flutuante deixa sobra de um centavo que ninguem consegue pagar.
 */
export function calculateSettlements(balances: MemberExpenseBalance[]) {
  const debtors = balances
    .filter((entry) => entry.balance < -0.009)
    .map((entry) => ({ ...entry, cents: Math.round(Math.abs(entry.balance) * 100) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((entry) => entry.balance > 0.009)
    .map((entry) => ({ ...entry, cents: Math.round(entry.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);

  const settlements: ExpenseSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const cents = Math.min(debtor.cents, creditor.cents);

    if (cents > 0) {
      settlements.push({
        from: debtor.member,
        to: creditor.member,
        amount: cents / 100,
      });
    }

    debtor.cents -= cents;
    creditor.cents -= cents;

    if (debtor.cents <= 0) debtorIndex += 1;
    if (creditor.cents <= 0) creditorIndex += 1;
  }

  return settlements;
}
