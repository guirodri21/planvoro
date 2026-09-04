"use client";

/**
 * Aba Ideias: o quadro onde o grupo sugere e vota antes do roteiro.
 */

import { useState } from "react";
import { REACTIONS, type Idea, type IdeaStatus, type IdeaVote, type Member } from "@/lib/types";
import { authJsonHeaders } from "../_lib/api";
import { formatMoney, formatScore } from "../_lib/format";
import { IDEA_CATEGORIES } from "../_lib/workspace-types";

export function IdeasView({
  accessToken,
  ideas,
  ideaVotes,
  members,
  me,
  slug,
  onChange,
  onGoToRoute,
}: {
  accessToken: string | null;
  ideas: Idea[];
  ideaVotes: IdeaVote[];
  members: Member[];
  me: Member;
  slug: string;
  onChange: () => Promise<void> | void;
  onGoToRoute: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(IDEA_CATEGORIES[0]);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function scoreFor(ideaId: string) {
    return ideaVotes
      .filter((vote) => vote.idea_id === ideaId)
      .reduce((sum, vote) => sum + vote.value, 0);
  }

  const orderedIdeas = [...ideas].sort((a, b) => {
    const statusRank: Record<IdeaStatus, number> = { open: 0, planned: 1, dismissed: 2 };
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus) return byStatus;

    const byScore = scoreFor(b.id) - scoreFor(a.id);
    if (byScore) return byScore;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const openCount = ideas.filter((idea) => idea.status === "open").length;
  const plannedCount = ideas.filter((idea) => idea.status === "planned").length;
  const topIdea =
    [...ideas]
      .filter((idea) => idea.status !== "dismissed")
      .sort((a, b) => scoreFor(b.id) - scoreFor(a.id))[0] ?? null;

  async function createIdea() {
    if (!accessToken || !title.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          title,
          notes,
          category,
          estimated_cost: estimatedCost || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setTitle("");
      setNotes("");
      setCategory(IDEA_CATEGORIES[0]);
      setEstimatedCost("");
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a ideia.");
    }

    setSaving(false);
  }

  return (
    <>
      <div className="grid3">
        <div className="card stat-card">
          <span className="stat-label">Ideias abertas</span>
          <strong className="stat-value">{openCount}</strong>
          <span className="tiny">Sugestões para o grupo lapidar</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Separadas</span>
          <strong className="stat-value">{plannedCount}</strong>
          <span className="tiny">Prontas para virar plano</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Mais quente</span>
          <strong className="stat-value">{topIdea ? formatScore(scoreFor(topIdea.id)) : "0"}</strong>
          <span className="tiny">{topIdea ? topIdea.title : "Nenhuma votação ainda"}</span>
        </div>
      </div>

      <div className="grid2 idea-grid">
        <div className="card">
          <h2>Nova ideia</h2>
          <p className="sub">
            Jogue aqui restaurantes, passeios, bairros e planos soltos antes de travar o
            roteiro.
          </p>

          <label>Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Jantar no mercado central"
          />

          <div className="grid2 tight">
            <div>
              <label>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {IDEA_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Custo estimado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>

          <label>Detalhes</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Por que vale entrar, horários bons, link, restrições..."
          />

          {error && <div className="err">{error}</div>}

          <button
            className="btn full"
            onClick={createIdea}
            disabled={saving || !title.trim() || !accessToken}
          >
            {saving ? "Salvando..." : "Adicionar ideia"}
          </button>
        </div>

        <div className="card">
          <h2>Como decidir</h2>
          <p className="sub">
            Votos deixam o grupo comparar desejo, dúvida e veto antes de mexer no roteiro final.
          </p>
          <div className="note">
            <b>Fluxo recomendado</b>
            <br />
            1. Todo mundo sugere sem editar o roteiro. 2. O grupo vota. 3. As melhores ideias sao
            separadas para entrar na próxima versão.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Quadro de ideias</h2>
        <p className="sub">Ordenado por status, votos e criação mais recente.</p>

        {orderedIdeas.length === 0 ? (
          <div className="note">
            <b>Nenhuma ideia ainda</b>
            <br />
            Comece com aquilo que sempre aparece no grupo: restaurantes, passeios imperdiveis,
            planos de chuva ou coisas que alguém quer muito evitar.
          </div>
        ) : (
          <div className="idea-list">
            {orderedIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                accessToken={accessToken}
                idea={idea}
                votes={ideaVotes.filter((vote) => vote.idea_id === idea.id)}
                members={members}
                me={me}
                slug={slug}
                onChange={onChange}
                onGoToRoute={onGoToRoute}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function IdeaCard({
  accessToken,
  idea,
  votes,
  members,
  me,
  slug,
  onChange,
  onGoToRoute,
}: {
  accessToken: string | null;
  idea: Idea;
  votes: IdeaVote[];
  members: Member[];
  me: Member;
  slug: string;
  onChange: () => Promise<void> | void;
  onGoToRoute: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const myVote = votes.find((vote) => vote.member_id === me.id)?.value ?? null;
  const score = votes.reduce((sum, vote) => sum + vote.value, 0);
  const author = members.find((member) => member.id === idea.member_id)?.name ?? "alguém";
  const statusLabel: Record<IdeaStatus, string> = {
    open: "aberta",
    planned: "separada",
    dismissed: "descartada",
  };
  const statusBadge: Record<IdeaStatus, string> = {
    open: "b-vote",
    planned: "b-ok",
    dismissed: "b-warn",
  };
  const nameById = (id: string) => members.find((member) => member.id === id)?.name ?? "alguém";

  async function vote(value: number) {
    if (!accessToken) return;

    setWorking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas/${idea.id}/vote`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao votar na ideia.");
    }

    setWorking(false);
  }

  async function changeStatus(status: IdeaStatus) {
    if (!accessToken) return;

    setWorking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas/${idea.id}/status`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar a ideia.");
    }

    setWorking(false);
  }

  return (
    <div className={`idea-card ${idea.status}`}>
      <div className="idea-main">
        <div>
          <div className="item-t">
            {idea.title}
            <span className={`badge ${statusBadge[idea.status]}`}>{statusLabel[idea.status]}</span>
          </div>
          <div className="tiny">
            Sugerida por {author}
            {idea.category ? ` · ${idea.category}` : ""}
            {idea.estimated_cost != null ? ` · ${formatMoney(Number(idea.estimated_cost))}` : ""}
          </div>
          {idea.notes && <p className="item-d idea-notes">{idea.notes}</p>}
        </div>
        <div className="idea-score">
          <span>{formatScore(score)}</span>
          <small>saldo</small>
        </div>
      </div>

      <div className="idea-footer">
        <div className="reactions idea-reactions">
          {REACTIONS.map((reaction) => {
            const voters = votes.filter((voteItem) => voteItem.value === reaction.value);
            const active = myVote === reaction.value;

            return (
              <button
                key={reaction.value}
                type="button"
                className={`react ${active ? "on" : ""}`}
                onClick={() => vote(reaction.value)}
                disabled={working || !accessToken}
                title={
                  voters.length
                    ? voters.map((voteItem) => nameById(voteItem.member_id)).join(", ")
                    : `Ninguem marcou "${reaction.label}" ainda`
                }
              >
                <span>{reaction.emoji}</span>
                {voters.length > 0 && <b>{voters.length}</b>}
              </button>
            );
          })}
        </div>

        <div className="idea-actions">
          {idea.status === "planned" ? (
            <>
              <button type="button" className="btn ghost sm" onClick={onGoToRoute}>
                Ver roteiro
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => changeStatus("open")}
                disabled={working}
              >
                Reabrir
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn sm"
              onClick={() => changeStatus("planned")}
              disabled={working || idea.status === "dismissed"}
            >
              Separar para roteiro
            </button>
          )}

          {idea.status === "dismissed" ? (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => changeStatus("open")}
              disabled={working}
            >
              Reabrir
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => changeStatus("dismissed")}
              disabled={working}
            >
              Descartar
            </button>
          )}
        </div>
      </div>

      {error && <div className="err">{error}</div>}
    </div>
  );
}
