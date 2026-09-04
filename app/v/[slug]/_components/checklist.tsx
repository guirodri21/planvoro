"use client";

/**
 * Aba Checklist: tarefas da viagem, com sugestoes a partir do que falta.
 */

import { useState } from "react";
import {
  TRIP_CHECKLIST_CATEGORIES,
  type Member,
  type Preference,
  type Trip,
  type TripChecklistCategory,
  type TripChecklistItem,
  type TripChecklistStatus,
  type TripVaultItem,
  type TripVaultKind,
} from "@/lib/types";
import { authJsonHeaders, readApiJson } from "../_lib/api";
import { checklistCategoryLabel, checklistStatusLabel, formatDueDate } from "../_lib/format";

export function TripChecklistView({
  accessToken,
  slug,
  trip,
  items,
  vaultItems,
  preferences,
  members,
  me,
  locked,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  items: TripChecklistItem[];
  vaultItems: TripVaultItem[];
  preferences: Preference[];
  members: Member[];
  me: Member;
  locked: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    title: "",
    category: "planning" as TripChecklistCategory,
    due_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const openItems = items.filter((item) => item.status === "open");
  const doneItems = items.filter((item) => item.status === "done");
  const progress = items.length ? Math.round((doneItems.length / items.length) * 100) : 0;
  const statusOrder: Record<TripChecklistStatus, number> = { open: 0, done: 1, skipped: 2 };
  const sortedItems = [...items].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  const hasVaultKind = (kinds: TripVaultKind[]) =>
    vaultItems.some((item) => kinds.includes(item.kind) && item.status !== "canceled");
  const hasExistingTask = (title: string) =>
    items.some((item) => item.title.toLowerCase() === title.toLowerCase());

  const suggestions = [
    !hasVaultKind(["flight", "transport"]) && {
      title: "Guardar passagens ou transporte de chegada no Cofre",
      category: "transport" as TripChecklistCategory,
      notes: "Salve localizador, horários, terminal/aeroporto e link da reserva.",
    },
    !hasVaultKind(["lodging"]) && {
      title: "Guardar hospedagem no Cofre",
      category: "booking" as TripChecklistCategory,
      notes: "Inclua endereço, check-in, check-out, código da reserva e regras de cancelamento.",
    },
    !hasVaultKind(["insurance"]) && {
      title: "Conferir seguro viagem",
      category: "health" as TripChecklistCategory,
      notes: "Guarde apolice, contato de emergência e cobertura principal.",
    },
    !hasVaultKind(["document", "visa"]) && {
      title: "Conferir documentos e requisitos de entrada",
      category: "documents" as TripChecklistCategory,
      notes: "Verifique passaporte, visto, vacinas, autorizações e comprovantes necessarios.",
    },
    preferences.length < members.length && {
      title: "Chamar quem ainda não preencheu preferências",
      category: "group" as TripChecklistCategory,
      notes: `${members.length - preferences.length} pessoa(s) ainda faltam preencher preferências.`,
    },
    vaultItems.some((item) => item.status === "attention") && {
      title: "Resolver itens marcados como precisa conferir",
      category: "planning" as TripChecklistCategory,
      notes: "Revise o Cofre e atualize status, códigos ou links pendentes.",
    },
  ].filter((item): item is { title: string; category: TripChecklistCategory; notes: string } =>
    Boolean(item && !hasExistingTask(item.title))
  );

  function updateForm(next: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function createItem(input?: {
    title: string;
    category: TripChecklistCategory;
    notes?: string;
    due_date?: string;
    source?: "manual" | "suggested";
  }) {
    if (!accessToken || saving) return;

    const payload = input ?? { ...form, source: "manual" as const };
    if (!payload.title.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify(payload),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar a tarefa.");

      if (!input) {
        setForm({ title: "", category: "planning", due_date: "", notes: "" });
      }
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar tarefa.");
    } finally {
      setSaving(false);
    }
  }

  async function setItemStatus(itemId: string, status: TripChecklistStatus) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist/${itemId}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar a tarefa.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar tarefa.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeItem(itemId: string) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist/${itemId}`, {
        method: "DELETE",
        headers: authJsonHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível remover a tarefa.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover tarefa.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="checklist-layout">
      {locked ? (
        <div className="card checklist-control locked-form">
          <span className="badge b-warn">recursos do Passe</span>
          <h2>O checklist precisa do Passe</h2>
          <p className="sub">
            Criar e marcar tarefa fazem parte do Passe desta viagem. O que já está na lista
            continua visível, e você pode remover à vontade.
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
      <div className="card checklist-control">
        <span className="badge b-ok">planejamento vivo</span>
        <h2>Checklist da viagem</h2>
        <p className="sub">
          Aqui ficam as pendências reais antes de viajar. O Planvoro cruza roteiro, Cofre e grupo
          para sugerir o que ainda precisa ser resolvido.
        </p>

        <div className="checklist-meter">
          <div>
            <span className="stat-label">Progresso</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-line">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="tiny">
            {doneItems.length} feita{doneItems.length === 1 ? "" : "s"} · {openItems.length} pendente
            {openItems.length === 1 ? "" : "s"}
          </p>
        </div>

        <label>Nova tarefa</label>
        <input
          value={form.title}
          onChange={(event) => updateForm({ title: event.target.value })}
          placeholder="Ex: confirmar horário do check-in"
        />

        <div className="grid2 tight">
          <div>
            <label>Categoria</label>
            <select
              value={form.category}
              onChange={(event) => updateForm({ category: event.target.value as TripChecklistCategory })}
            >
              {TRIP_CHECKLIST_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Prazo</label>
            <input
              type="date"
              value={form.due_date}
              min={trip.start_date}
              max={trip.end_date}
              onChange={(event) => updateForm({ due_date: event.target.value })}
            />
          </div>
        </div>

        <label>Notas</label>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => updateForm({ notes: event.target.value })}
          placeholder="Detalhes, link, pessoa responsável ou contexto..."
        />

        {error && <div className="err">{error}</div>}

        <button className="btn full" onClick={() => createItem()} disabled={saving || !form.title.trim()}>
          {saving ? "Salvando tarefa..." : "Adicionar tarefa"}
        </button>
      </div>
      )}

      <div className="checklist-stack">
        {suggestions.length > 0 && (
          <div className="card">
            <h3>Sugestões do Planvoro</h3>
            <p className="sub">Atalhos baseados no que ainda não aparece no Cofre ou no grupo.</p>
            <div className="checklist-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  className="option-card"
                  onClick={() => createItem({ ...suggestion, source: "suggested" })}
                  disabled={saving}
                >
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.notes}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="dashboard-head">
            <div>
              <h3>Tarefas da viagem</h3>
              <p className="sub">Marque como feito, ignore o que não se aplica ou remova tarefas antigas.</p>
            </div>
            <span className="badge b-ok">{items.length} total</span>
          </div>

          {items.length === 0 ? (
            <div className="note">
              <b>Nenhuma tarefa ainda</b>
              <br />
              Adicione tarefas manuais ou aceite uma sugestão para comecar.
            </div>
          ) : (
            <div className="checklist-items">
              {sortedItems.map((item) => (
                <div className={`checklist-item ${item.status}`} key={item.id}>
                  <button
                    type="button"
                    className="check-toggle"
                    onClick={() => setItemStatus(item.id, item.status === "done" ? "open" : "done")}
                    disabled={workingId === item.id}
                    aria-label={item.status === "done" ? "Reabrir tarefa" : "Marcar tarefa como feita"}
                  >
                    {item.status === "done" ? "✓" : ""}
                  </button>
                  <div className="check-body">
                    <div className="check-title">
                      <strong>{item.title}</strong>
                      <span className={`badge ${item.status === "open" ? "b-warn" : "b-ok"}`}>
                        {checklistStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="tiny">
                      {checklistCategoryLabel(item.category)} · {formatDueDate(item.due_date)}
                      {item.source === "suggested" ? " · sugerido" : ""}
                    </p>
                    {item.notes && <p className="item-d">{item.notes}</p>}
                    <div className="check-actions">
                      {item.status !== "skipped" && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setItemStatus(item.id, "skipped")}
                          disabled={workingId === item.id}
                        >
                          Ignorar
                        </button>
                      )}
                      {item.status === "skipped" && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setItemStatus(item.id, "open")}
                          disabled={workingId === item.id}
                        >
                          Reabrir
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => removeItem(item.id)}
                        disabled={workingId === item.id}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
