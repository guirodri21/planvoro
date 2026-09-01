"use client";

/**
 * Aba Agente: pergunta livre sobre a viagem, com o contexto ja cadastrado.
 */

import { useState } from "react";
import { track } from "@/lib/analytics";
import type {
  Expense,
  Idea,
  Itinerary,
  Member,
  Preference,
  Trip,
  TripChecklistCategory,
  TripChecklistItem,
  TripVaultItem,
} from "@/lib/types";
import { authJsonHeaders, readApiJson } from "../_lib/api";
import { formatMoney } from "../_lib/format";
import { AGENT_PROMPTS, type AgentReply } from "../_lib/workspace-types";

export function TravelAgentView({
  accessToken,
  slug,
  trip,
  members,
  preferences,
  itinerary,
  ideas,
  expenses,
  vaultItems,
  checklistItems,
  onChange,
  onOpenChecklist,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  ideas: Idea[];
  expenses: Expense[];
  vaultItems: TripVaultItem[];
  checklistItems: TripChecklistItem[];
  onChange: () => Promise<void> | void;
  onOpenChecklist: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AgentReply | null>(null);
  const [asking, setAsking] = useState(false);
  const [savingTaskKey, setSavingTaskKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  async function askAgent(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!accessToken || !cleanQuestion || asking) return;

    setQuestion(cleanQuestion);
    setAsking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/agent`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const json = await readApiJson<AgentReply & { error?: string }>(res);
      if (!res.ok) {
        if (res.status === 429) track("limite_atingido", { acao: "agente" });
        throw new Error(json.error ?? "Não foi possível falar com o agente.");
      }

      track("agente_pergunta_feita");
      setReply(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao falar com o agente.");
    } finally {
      setAsking(false);
    }
  }

  const hasTask = (title: string) =>
    checklistItems.some((item) => item.title.trim().toLowerCase() === title.trim().toLowerCase());

  async function createAgentTask(title: string, category: TripChecklistCategory, key = title) {
    if (!accessToken || savingTaskKey || !title.trim()) return false;
    if (hasTask(title)) {
      setActionMessage("Essa tarefa já esta no Checklist.");
      return false;
    }

    setSavingTaskKey(key);
    setActionMessage("");
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          title,
          category,
          notes: `Criado pelo Agente a partir da pergunta: ${question || "pergunta sugerida"}`,
          source: "suggested",
        }),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar para o Checklist.");

      await onChange();
      setActionMessage("Tarefa enviada para o Checklist.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar tarefa pelo Agente.");
      return false;
    } finally {
      setSavingTaskKey("");
    }
  }

  async function saveAllNextSteps() {
    if (!reply?.next_steps.length || savingTaskKey) return;

    setSavingTaskKey("all-next-steps");
    setActionMessage("");
    setError("");

    let created = 0;
    try {
      for (const step of reply.next_steps) {
        if (hasTask(step)) continue;
        const res = await fetch(`/api/trips/${slug}/checklist`, {
          method: "POST",
          headers: authJsonHeaders(accessToken),
          body: JSON.stringify({
            title: step,
            category: categorizeAgentTask(step),
            notes: `Criado pelo Agente a partir da pergunta: ${question || "pergunta sugerida"}`,
            source: "suggested",
          }),
        });
        const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
        if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar os passos para o Checklist.");
        created += 1;
      }

      await onChange();
      setActionMessage(
        created
          ? `${created} tarefa${created === 1 ? "" : "s"} enviada${created === 1 ? "" : "s"} para o Checklist.`
          : "Todos esses passos já estavam no Checklist."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar passos no Checklist.");
    } finally {
      setSavingTaskKey("");
    }
  }

  const donePreferences = preferences.length;
  const routeDays = itinerary?.itinerary_days.length ?? 0;
  const openIdeas = ideas.filter((idea) => idea.status === "open").length;
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const attentionItems = vaultItems.filter((item) => item.status === "attention").length;
  const checklistOpen = checklistItems.filter((item) => item.status === "open").length;

  return (
    <div className="agent-layout">
      <div className="card agent-hero-card">
        <span className="badge b-ok">agente ativo</span>
        <h2>Seu agente de viagem dentro do Planvoro</h2>
        <p className="sub">
          Pergunte sobre roteiro, orçamento, reservas, decisões do grupo ou próximos passos. Ele
          responde usando o que já existe nesta viagem, sem fingir disponibilidade em tempo real.
        </p>

        <div className="agent-stats">
          <div>
            <span className="stat-label">Viagem</span>
            <strong>{trip.destination}</strong>
          </div>
          <div>
            <span className="stat-label">Roteiro</span>
            <strong>{routeDays ? `${routeDays} dia${routeDays === 1 ? "" : "s"}` : "a gerar"}</strong>
          </div>
          <div>
            <span className="stat-label">Preferencias</span>
            <strong>
              {donePreferences}/{members.length}
            </strong>
          </div>
          <div>
            <span className="stat-label">Cofre</span>
            <strong>{vaultItems.length ? `${vaultItems.length} item${vaultItems.length === 1 ? "" : "s"}` : "vazio"}</strong>
          </div>
          <div>
            <span className="stat-label">Checklist</span>
            <strong>{checklistOpen ? `${checklistOpen} pendente${checklistOpen === 1 ? "" : "s"}` : "em dia"}</strong>
          </div>
          <div>
            <span className="stat-label">Gastos</span>
            <strong>{formatMoney(totalExpenses)}</strong>
          </div>
        </div>

        <label>Pergunte para o agente</label>
        <textarea
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex: o que eu deveria reservar primeiro para essa viagem?"
        />
        <button
          className="btn full"
          type="button"
          onClick={() => askAgent()}
          disabled={asking || !question.trim() || !accessToken}
        >
          {asking ? "Agente analisando a viagem..." : "Perguntar ao agente"}
        </button>

        {error && <div className="err">{error}</div>}
      </div>

      <div className="card">
        <h3>Perguntas boas para agora</h3>
        <p className="sub">
          Use uma sugestão ou escreva do seu jeito. Quanto mais concreta a pergunta, melhor a
          resposta.
        </p>
        <div className="agent-question-grid">
          {AGENT_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="option-card"
              onClick={() => askAgent(prompt)}
              disabled={asking || !accessToken}
            >
              <strong>{prompt}</strong>
            </button>
          ))}
        </div>
        {openIdeas > 0 && (
          <div className="note" style={{ marginTop: 16 }}>
            <b>Insight do agente</b>
            <br />
            Existem {openIdeas} ideia{openIdeas === 1 ? "" : "s"} aberta
            {openIdeas === 1 ? "" : "s"} no quadro. Vale separar as melhores para o roteiro antes
            de regerar.
          </div>
        )}
        {attentionItems > 0 && (
          <div className="note" style={{ marginTop: 16 }}>
            <b>Item para conferir</b>
            <br />
            O Cofre tem {attentionItems} item{attentionItems === 1 ? "" : "s"} marcado
            {attentionItems === 1 ? "" : "s"} como "precisa conferir".
          </div>
        )}
      </div>

      <div className="card agent-answer-card">
        {reply ? (
          <>
            <div className="agent-answer-head">
              <div>
                <span className="badge b-ok">resposta acionavel</span>
                <h3>Resposta do agente</h3>
              </div>
              <div className="agent-answer-actions">
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={saveAllNextSteps}
                  disabled={savingTaskKey === "all-next-steps" || !reply.next_steps.length || !accessToken}
                >
                  {savingTaskKey === "all-next-steps" ? "Enviando..." : "Salvar passos no Checklist"}
                </button>
                <button className="btn ghost sm" type="button" onClick={onOpenChecklist}>
                  Abrir Checklist
                </button>
              </div>
            </div>
            <p className="agent-answer-text">{reply.answer}</p>
            {actionMessage && <div className="note tight agent-action-note">{actionMessage}</div>}
            <div className="grid2 tight">
              <AgentList
                title="Próximos passos"
                items={reply.next_steps}
                checklistItems={checklistItems}
                savingKey={savingTaskKey}
                categoryForItem={categorizeAgentTask}
                onCreateTask={createAgentTask}
              />
              <AgentList
                title="Cuidados"
                items={reply.watchouts}
                checklistItems={checklistItems}
                savingKey={savingTaskKey}
                categoryForItem={() => "planning"}
                onCreateTask={createAgentTask}
              />
            </div>
          </>
        ) : (
          <>
            <h3>Como eu atuo aqui</h3>
            <p className="sub">
              Penso como um agente de viagem: organizo prioridades, aponto riscos, sugiro decisões
              e transformo o roteiro em plano executável. Para preços, horários e disponibilidade,
              eu sempre vou te lembrar de confirmar no canal oficial antes de fechar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function categorizeAgentTask(text: string): TripChecklistCategory {
  const value = text.toLowerCase();
  if (/(hotel|hosped|airbnb|booking|reserva|ingresso|passeio|restaurante)/.test(value)) return "booking";
  if (/(passagem|voo|aeroporto|trem|transfer|onibus|ônibus|carro|transporte)/.test(value)) return "transport";
  if (/(passaporte|visto|document|cpf|rg|autoriz|comprovante)/.test(value)) return "documents";
  if (/(seguro|vacina|saude|saúde|remedio|remédio|medic)/.test(value)) return "health";
  if (/(orcamento|orçamento|dinheiro|cambio|câmbio|cartao|cartão|pagar|pago|custo)/.test(value)) return "money";
  if (/(grupo|pessoa|confirmar|alinhar|mensagem|preferencia|preferência)/.test(value)) return "group";
  if (/(mala|bagagem|levar|arrumar)/.test(value)) return "packing";
  return "planning";
}

export function AgentList({
  title,
  items,
  checklistItems,
  savingKey,
  categoryForItem,
  onCreateTask,
}: {
  title: string;
  items: string[];
  checklistItems: TripChecklistItem[];
  savingKey: string;
  categoryForItem: (item: string) => TripChecklistCategory;
  onCreateTask: (title: string, category: TripChecklistCategory, key?: string) => Promise<boolean>;
}) {
  const hasTask = (item: string) =>
    checklistItems.some((task) => task.title.trim().toLowerCase() === item.trim().toLowerCase());

  return (
    <div className="agent-list">
      <span className="stat-label">{title}</span>
      {items.length ? (
        items.map((item) => {
          const key = `${title}:${item}`;
          const saved = hasTask(item);
          return (
            <div className="agent-action-item" key={item}>
              <p>{item}</p>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => onCreateTask(item, categoryForItem(item), key)}
                disabled={Boolean(savingKey) || saved}
              >
                {savingKey === key ? "Salvando..." : saved ? "Já no Checklist" : "Virar tarefa"}
              </button>
            </div>
          );
        })
      ) : (
        <p>Nada critico por enquanto.</p>
      )}
    </div>
  );
}
