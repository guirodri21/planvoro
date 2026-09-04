"use client";

/**
 * Aba Gastos: lancamento, saldo do grupo, acerto por Pix e orcamento.
 */

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { budgetTone, summarizeBudget } from "@/lib/budget";
import { PIX_DEFAULT_CITY, buildPixPayload, detectPixKey, pixKeyLabel } from "@/lib/pix";
import type { Expense, Member, Trip } from "@/lib/types";
import { authHeaders, authJsonHeaders, readApiJson } from "../_lib/api";
import {
  calculateExpenseBalances,
  calculateSettlements,
  roundMoney,
  type ExpenseSettlement,
} from "../_lib/expenses";
import { formatExpenseDate, formatMoney } from "../_lib/format";
import { Confirmar } from "@/components/confirmar";

/**
 * Alerta de orcamento.
 *
 * O teto e por pessoa e multiplicado pelo tamanho do grupo, porque e
 * assim que as pessoas pensam: ninguem combina "vamos gastar 6 mil",
 * combina "mil e duzentos cada um".
 */
export function BudgetAlert({
  accessToken,
  slug,
  trip,
  members,
  expenses,
  isOrganizer,
  onSaved,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  isOrganizer: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    trip.budget_per_person == null ? "" : String(trip.budget_per_person)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headcount = trip.is_solo ? 1 : Math.max(members.length, trip.party_size);
  const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const budget = summarizeBudget({
    budgetPerPerson: trip.budget_per_person,
    headcount,
    totalSpent,
  });

  async function save() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ budget_per_person: value.trim() }),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar o orçamento.");

      setOpen(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o orçamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`budget-alert ${budgetTone(budget.status)}`}>
      <div className="budget-alert-head">
        <div className="budget-alert-title">
          <span className="stat-label">Orçamento</span>
          <strong>{budget.headline}</strong>
        </div>
        {isOrganizer && (
          <button className="btn ghost sm" type="button" onClick={() => setOpen((v) => !v)}>
            {trip.budget_per_person == null ? "Definir" : "Ajustar"}
          </button>
        )}
      </div>

      <p className="tiny">{budget.detail}</p>

      {budget.status !== "sem_orcamento" && (
        <div className="budget-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(budget.ratio * 100, 100)}%` }} />
        </div>
      )}

      {open && (
        <div className="budget-form">
          <label>Quanto cada pessoa pretende gastar</label>
          <input
            type="number"
            min="0"
            step="10"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="1200"
          />
          <span className="tiny">
            Some tudo que sai do bolso: passagem, hospedagem, comida e passeios. Deixe em branco
            para desligar o alerta.
          </span>
          {error && <div className="err">{error}</div>}
          <div className="budget-form-actions">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => {
                setOpen(false);
                setValue(trip.budget_per_person == null ? "" : String(trip.budget_per_person));
                setError("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="btn sm" type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Uma transferencia do acerto, com o Pix pronto.
 *
 * Sem chave cadastrada nao ha botao: mostrar "copiar Pix" e entregar um
 * codigo quebrado seria pior do que dizer que falta a chave.
 */
export function PixSettlementRow({
  settlement,
  tripName,
}: {
  settlement: ExpenseSettlement;
  tripName: string;
}) {
  const [copied, setCopied] = useState(false);
  const pixKey = settlement.to.pix_key ?? "";

  async function copyPix() {
    const payload = buildPixPayload({
      key: pixKey,
      amount: settlement.amount,
      receiverName: settlement.to.name,
      city: settlement.to.pix_city,
      reference: tripName,
    });
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      track("pix_copiado", { valor: settlement.amount });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pix-row">
      <span>
        Voce paga {formatMoney(settlement.amount)} para {settlement.to.name}
      </span>
      {pixKey ? (
        <button className="btn ghost sm" type="button" onClick={copyPix}>
          {copied ? "Código copiado" : "Copiar Pix"}
        </button>
      ) : (
        <span className="tiny">{settlement.to.name} ainda nao cadastrou a chave Pix.</span>
      )}
    </div>
  );
}

/** Chave Pix da propria pessoa. Cada um cuida da sua. */
export function MyPixKey({
  accessToken,
  slug,
  me,
  onSaved,
}: {
  accessToken: string | null;
  slug: string;
  me: Member;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(me.pix_key ?? "");
  const [city, setCity] = useState(me.pix_city ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const detected = detectPixKey(me.pix_key ?? "");

  async function save() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/pix`, {
        method: "PUT",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ pix_key: value.trim(), pix_city: city.trim() }),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar a chave.");

      setOpen(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pix-key-box">
      {!open ? (
        <div className="pix-key-state">
          <span className="tiny">
            {me.pix_key
              ? `Sua chave Pix: ${pixKeyLabel(detected.type)} cadastrada`
              : "Cadastre sua chave Pix para o grupo te pagar em um toque."}
          </span>
          <button className="btn ghost sm" type="button" onClick={() => setOpen(true)}>
            {me.pix_key ? "Trocar" : "Cadastrar chave"}
          </button>
        </div>
      ) : (
        <div className="pix-key-form">
          <label>Sua chave Pix</label>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="CPF, e-mail, telefone ou chave aleatoria"
            autoComplete="off"
          />
          <label>Sua cidade</label>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder={`Salvador, Recife... (padrão: ${PIX_DEFAULT_CITY})`}
            autoComplete="address-level2"
          />
          <span className="tiny">
            Fica visível para quem participa desta viagem. O Planvoro não move dinheiro: o código
            abre o app do seu banco, que confirma tudo antes. A cidade é campo obrigatório do
            padrão Pix e alguns bancos mostram na tela.
          </span>
          {error && <div className="err">{error}</div>}
          <div className="pix-key-actions">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => {
                setOpen(false);
                setValue(me.pix_key ?? "");
                setCity(me.pix_city ?? "");
                setError("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="btn sm" type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpensesView({
  accessToken,
  expenses,
  members,
  me,
  slug,
  trip,
  locked,
  onSaved,
}: {
  accessToken: string | null;
  expenses: Expense[];
  members: Member[];
  me: Member;
  slug: string;
  trip: Trip;
  locked: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const tripName = trip.destination;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(me.id);
  const [splitIds, setSplitIds] = useState<string[]>(members.map((member) => member.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");
  /** Gasto aguardando confirmacao. Vazio quando nao ha dialogo aberto. */
  const [confirmarRemocao, setConfirmarRemocao] = useState("");

  useEffect(() => {
    setPayerId((current) => (current ? current : me.id));
    setSplitIds((current) => {
      const valid = current.filter((id) => members.some((member) => member.id === id));
      return valid.length ? valid : members.map((member) => member.id);
    });
  }, [members, me.id]);

  const totalsByMember = calculateExpenseBalances(expenses, members)
    .sort((a, b) => {
      if (a.member.id === me.id) return -1;
      if (b.member.id === me.id) return 1;
      return b.balance - a.balance;
    });

  const myTotals = totalsByMember.find((entry) => entry.member.id === me.id) ?? {
    member: me,
    paid: 0,
    share: 0,
    balance: 0,
  };
  const totalSpent = roundMoney(expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0));
  const settlementPlan = calculateSettlements(totalsByMember);
  const creditors = totalsByMember.filter((entry) => entry.balance > 0.009);
  const debtors = totalsByMember.filter((entry) => entry.balance < -0.009);
  const settledMembers = totalsByMember.filter((entry) => Math.abs(entry.balance) <= 0.009).length;
  const splitPreview = Number(amount) > 0 && splitIds.length ? roundMoney(Number(amount) / splitIds.length) : 0;
  const payerName = members.find((member) => member.id === payerId)?.name ?? "quem pagou";
  const mySettlementsToPay = settlementPlan.filter((settlement) => settlement.from.id === me.id);
  const mySettlementsToReceive = settlementPlan.filter((settlement) => settlement.to.id === me.id);

  function resetForm() {
    setDescription("");
    setAmount("");
    setPayerId(me.id);
    setSplitIds(members.map((member) => member.id));
  }

  function toggleSplit(id: string) {
    setSplitIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((value) => value !== id);
      }
      return [...current, id];
    });
  }

  async function removeExpense(expenseId: string) {
    if (!accessToken || removingId) return;

    setConfirmarRemocao("");
    setRemovingId(expenseId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/expenses/${expenseId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível remover o gasto.");

      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover o gasto.");
    } finally {
      setRemovingId("");
    }
  }

  async function saveExpense() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/expenses`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          payer_member_id: payerId,
          split_member_ids: splitIds,
          description,
          amount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      resetForm();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar o gasto.");
    }

    setSaving(false);
  }

  return (
    <>
      <div className="expense-command">
        <div className="expense-command-main">
          <span className="badge b-ok">financeiro do grupo</span>
          <h2>Gastos e acertos</h2>
          <p className="sub">
            Registre pagamentos compartilhados e o Planvoro mostra quem pagou demais, quem ficou
            devendo e como zerar tudo com o menor número de transferências.
          </p>
          <div className="expense-command-grid">
            <div>
              <span className="stat-label">Total registrado</span>
              <strong>{formatMoney(totalSpent)}</strong>
              <small>{expenses.length} lançamento{expenses.length === 1 ? "" : "s"}</small>
            </div>
            <div>
              <span className="stat-label">Você pagou</span>
              <strong>{formatMoney(myTotals.paid)}</strong>
              <small>Saiu do seu bolso</small>
            </div>
            <div>
              <span className="stat-label">Sua parte</span>
              <strong>{formatMoney(myTotals.share)}</strong>
              <small>O que você consumiu no rateio</small>
            </div>
            <div className={myTotals.balance >= 0 ? "positive" : "negative"}>
              <span className="stat-label">Seu saldo</span>
              <strong>
                {myTotals.balance >= 0
                  ? `+${formatMoney(myTotals.balance)}`
                  : `-${formatMoney(Math.abs(myTotals.balance))}`}
              </strong>
              <small>
                {myTotals.balance > 0.009
                  ? "Você tem a receber"
                  : myTotals.balance < -0.009
                    ? "Você deve ao grupo"
                    : "Você está zerado"}
              </small>
            </div>
          </div>
        </div>

        <BudgetAlert
          accessToken={accessToken}
          slug={slug}
          trip={trip}
          members={members}
          expenses={expenses}
          isOrganizer={me.is_organizer}
          onSaved={onSaved}
        />

        <div className="expense-command-side">
          <span className="stat-label">Estado do acerto</span>
          <strong>
            {settlementPlan.length
              ? `${settlementPlan.length} transferencia${settlementPlan.length === 1 ? "" : "s"} sugerida${settlementPlan.length === 1 ? "" : "s"}`
              : expenses.length
                ? "Tudo equilibrado"
                : "Ainda sem gastos"}
          </strong>
          <p className="tiny">
            {creditors.length} recebe{creditors.length === 1 ? "" : "m"} · {debtors.length} deve
            {debtors.length === 1 ? "" : "m"} · {settledMembers} zerado
            {settledMembers === 1 ? "" : "s"}
          </p>
          {(mySettlementsToPay.length > 0 || mySettlementsToReceive.length > 0) && (
            <div className="expense-my-actions">
              {mySettlementsToPay.map((settlement) => (
                <PixSettlementRow
                  key={`pay-${settlement.to.id}`}
                  settlement={settlement}
                  tripName={tripName}
                />
              ))}
              {mySettlementsToReceive.map((settlement) => (
                <span key={`receive-${settlement.from.id}`}>
                  {settlement.from.name} te paga {formatMoney(settlement.amount)}
                </span>
              ))}
            </div>
          )}

          <MyPixKey accessToken={accessToken} slug={slug} me={me} onSaved={onSaved} />
        </div>
      </div>

      <div className="grid2 expense-grid">
        {locked ? (
          <div className="card locked-form">
            <span className="badge b-warn">recursos do Passe</span>
            <h2>Dividir gastos precisa do Passe</h2>
            <p className="sub">
              Lançar despesa e acertar as contas fazem parte do Passe desta viagem. O que já foi
              lançado continua visível, e você pode remover à vontade.
            </p>
            {me.is_organizer ? (
              <a className="btn full" href={`/app?liberar=${slug}`}>
                Liberar esta viagem
              </a>
            ) : (
              <p className="tiny">Você não precisa pagar nada: só quem organiza libera.</p>
            )}
          </div>
        ) : (
        <div className="card">
          <h2>Lançar gasto</h2>
          <p className="sub">
            Registre o que já foi pago e deixe o saldo do grupo transparente sem sair do
            planejamento.
          </p>

          <label>Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Uber do aeroporto"
          />

          <div className="grid2 tight">
            <div>
              <label>Valor</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="89.90"
              />
            </div>
            <div>
              <label>Quem pagou</label>
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ marginBottom: 0 }}>Dividir com quem</label>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setSplitIds(members.map((member) => member.id))}
            >
              Selecionar todos
            </button>
          </div>
          <div className="chips">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`chip ${splitIds.includes(member.id) ? "on" : ""}`}
                onClick={() => toggleSplit(member.id)}
              >
                {member.name}
              </button>
            ))}
          </div>

          {splitPreview > 0 && (
            <div className="expense-preview">
              <span className="stat-label">Previa do rateio</span>
              <strong>{formatMoney(splitPreview)} por pessoa</strong>
              <p>
                {payerName} registra {formatMoney(Number(amount))} dividido com {splitIds.length}{" "}
                {splitIds.length === 1 ? "pessoa" : "pessoas"}.
              </p>
            </div>
          )}

          {error && <div className="err">{error}</div>}

          <button
            className="btn full"
            onClick={saveExpense}
            disabled={saving || !description.trim() || !amount || !splitIds.length || !accessToken}
          >
            {saving ? "Salvando..." : "Registrar gasto"}
          </button>
        </div>
        )}

        <div className="card">
          <div className="expense-panel-head">
            <div>
              <span className="badge b-ok">balanco</span>
              <h2>Saldo por pessoa</h2>
            </div>
            <span className="tiny">Positivo recebe · negativo paga</span>
          </div>

          {totalsByMember.map((entry) => (
            <div
              className={`balance-person ${
                entry.balance > 0.009 ? "positive" : entry.balance < -0.009 ? "negative" : "settled"
              }`}
              key={entry.member.id}
            >
              <div className="balance-person-main">
                <div className="av" style={{ background: entry.member.color }}>
                  {entry.member.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <b>
                    {entry.member.name}
                    {entry.member.id === me.id && <span className="badge b-ok">você</span>}
                  </b>
                  <div className="tiny">
                    {formatMoney(entry.paid)} pagos · {formatMoney(entry.share)} de parte
                  </div>
                </div>
              </div>
              <div className="balance-person-side">
                <b
                  className={`balance-value ${
                    entry.balance > 0.009 ? "pos" : entry.balance < -0.009 ? "neg" : ""
                  }`}
                >
                  {entry.balance >= 0
                    ? `+${formatMoney(entry.balance)}`
                    : `-${formatMoney(Math.abs(entry.balance))}`}
                </b>
                <span>
                  {entry.balance > 0.009
                    ? "recebe"
                    : entry.balance < -0.009
                      ? "paga"
                      : "zerado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2 expense-settlement-grid">
        <div className="card expense-settlement-card">
          <div className="expense-panel-head">
            <div>
              <span className="badge b-warn">acerto sugerido</span>
              <h2>Quem paga quem</h2>
            </div>
            <span className="tiny">Baseado nos saldos atuais</span>
          </div>

          {expenses.length === 0 ? (
            <div className="note">
              <b>Sem acerto ainda</b>
              <br />
              Lance algum gasto dividido para o Planvoro montar o plano de pagamento.
            </div>
          ) : settlementPlan.length === 0 ? (
            <div className="note">
              <b>Tudo zerado</b>
              <br />
              Pelos gastos atuais, ninguém precisa transferir nada para ninguém.
            </div>
          ) : (
            <div className="settlement-list">
              {settlementPlan.map((settlement) => (
                <div className="settlement-row" key={`${settlement.from.id}-${settlement.to.id}-${settlement.amount}`}>
                  <div className="settlement-person">
                    <div className="av" style={{ background: settlement.from.color }}>
                      {settlement.from.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span>{settlement.from.name}</span>
                  </div>
                  <div className="settlement-arrow">
                    <strong>{formatMoney(settlement.amount)}</strong>
                    <span>paga para</span>
                  </div>
                  <div className="settlement-person right">
                    <div className="av" style={{ background: settlement.to.color }}>
                      {settlement.to.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span>{settlement.to.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card expense-insights-card">
          <span className="badge b-ok">leitura rápida</span>
          <h2>Radar financeiro</h2>
          <div className="expense-insight-list">
            <div>
              <strong>{creditors.length || "Ninguém"}</strong>
              <span>com saldo a receber</span>
            </div>
            <div>
              <strong>{debtors.length || "Ninguém"}</strong>
              <span>com saldo a pagar</span>
            </div>
            <div>
              <strong>{expenses.length ? formatMoney(totalSpent / Math.max(1, members.length)) : formatMoney(0)}</strong>
              <span>media registrada por pessoa no grupo</span>
            </div>
          </div>
          <p className="sub small" style={{ marginTop: 14, marginBottom: 0 }}>
            Dica: registre pagamentos reais aqui e use o Cofre para reservas/documentos. Quando a
            reserva for paga pelo grupo, lance também em Gastos para entrar no acerto.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Últimos gastos</h2>
        <p className="sub">
          Cada lançamento mostra quem pagou, com quantas pessoas foi dividido e o valor por
          pessoa.
        </p>

        {expenses.length === 0 ? (
          <div className="note">
            <b>Nenhum gasto ainda</b>
            <br />
            Comece registrando transporte, hospedagem, mercado ou reservas que o grupo já pagou.
          </div>
        ) : (
          <div className="expense-list">
            {expenses.map((expense) => {
              const total = Number(expense.amount ?? 0);
              const splitCount = expense.split_member_ids.length;
              const perPerson = splitCount ? total / splitCount : total;
              const payerName =
                members.find((member) => member.id === expense.payer_member_id)?.name ?? "alguém";

              return (
                <div className="row expense-row" key={expense.id}>
                  <div>
                    <b>{expense.description}</b>
                    <div className="tiny expense-meta">
                      {payerName} pagou · dividido com {splitCount}{" "}
                      {splitCount === 1 ? "pessoa" : "pessoas"} · {formatMoney(perPerson)}/pessoa ·{" "}
                      {formatExpenseDate(expense.created_at)}
                    </div>
                  </div>
                  <div className="expense-row-end">
                    <b>{formatMoney(total)}</b>
                    {(me.is_organizer || expense.payer_member_id === me.id) && (
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => setConfirmarRemocao(expense.id)}
                        disabled={removingId === expense.id}
                        aria-label={`Remover ${expense.description}`}
                      >
                        {removingId === expense.id ? "Removendo..." : "Remover"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/*
        Gasto tambem some sem volta, e some da divisao de todo mundo: o
        acerto do grupo inteiro muda de valor. O Cofre ja perguntava antes
        de remover; aqui nao perguntava nada, e um toque errado no celular
        apagava um lancamento em silencio.
      */}
      {confirmarRemocao && (
        <Confirmar
          titulo="Remover este gasto?"
          descricao={`"${
            expenses.find((item) => item.id === confirmarRemocao)?.description ?? "Este lançamento"
          }" sai da lista e a divisão do grupo é recalculada sem ele. Não dá para desfazer.`}
          acao="Remover gasto"
          trabalhando={removingId === confirmarRemocao}
          onConfirmar={() => removeExpense(confirmarRemocao)}
          onCancelar={() => setConfirmarRemocao("")}
        />
      )}
    </>
  );
}
