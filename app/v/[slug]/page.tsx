"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import {
  DAILY_BUDGETS,
  INTERESTS,
  REACTIONS,
  RESTRICTIONS,
  type Comment,
  type Itinerary,
  type Item,
  type Member,
  type Preference,
  type Trip,
  type Vote,
} from "@/lib/types";

type Payload = {
  trip: Trip;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  votes: Vote[];
  comments: Comment[];
};

export default function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${slug}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    setData(json);
  }, [slug]);

  useEffect(() => {
    setMemberId(localStorage.getItem(`pv_member_${slug}`));
    load();
  }, [slug, load]);

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card muted">Carregando...</div>;

  const { trip, members, preferences, itinerary, votes, comments } = data;
  const me = members.find((m) => m.id === memberId) ?? null;
  const myPref = preferences.find((p) => p.member_id === memberId) ?? null;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/v/${slug}` : `/v/${slug}`;

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${slug}/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar.");
    }
    setGenerating(false);
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{trip.destination}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {trip.start_date} ate {trip.end_date} · {trip.party_size} pessoas ·{" "}
              {trip.budget_band ?? "orcamento livre"}
            </p>
          </div>
          <div className="avatars">
            {members.map((m) => (
              <div key={m.id} className="av" style={{ background: m.color }} title={m.name}>
                {m.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!me ? (
        <JoinCard slug={slug} onJoined={(id) => { setMemberId(id); load(); }} />
      ) : (
        <div className="grid2">
          <PreferencesCard slug={slug} me={me} pref={myPref} trip={trip} onSaved={load} />
          <div className="card">
            {trip.is_solo ? (
              <>
                <h3>Seu roteiro</h3>
                <p className="sub">
                  Marque seus interesses ao lado e gere. Leva menos de um minuto.
                </p>
              </>
            ) : (
              <>
                <h3>Convide o grupo</h3>
                <div className="copybox">{inviteUrl}</div>
                <button
                  className="btn ghost full"
                  onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                >
                  Copiar link
                </button>
                <h3 style={{ marginTop: 22 }}>
                  Preferencias preenchidas ({preferences.length} de {members.length})
                </h3>
                {members.map((m) => {
                  const done = preferences.some((p) => p.member_id === m.id);
                  return (
                    <div className="row" key={m.id}>
                      <span>
                        {m.name}
                        {m.is_organizer && <span className="badge b-ok">organizador</span>}
                      </span>
                      <span className={`small ${done ? "" : "muted"}`}>
                        {done ? "pronto" : "pendente"}
                      </span>
                    </div>
                  );
                })}
              </>
            )}

            <button
              className="btn full"
              onClick={generate}
              disabled={generating || preferences.length === 0}
            >
              {generating
                ? "A IA esta montando o roteiro..."
                : itinerary
                  ? "Regerar roteiro"
                  : trip.is_solo
                    ? "Gerar meu roteiro"
                    : "Gerar roteiro do grupo"}
            </button>
            {!trip.is_solo && preferences.length > 0 && preferences.length < members.length && (
              <p className="sub small" style={{ marginTop: 10, marginBottom: 0 }}>
                Da pra gerar agora, mas o roteiro fica melhor quando todo mundo preenche.
              </p>
            )}
          </div>
        </div>
      )}

      {error && <div className="err">{error}</div>}

      {itinerary && (
        <>
          <ItineraryView
            itinerary={itinerary}
            members={members}
            votes={votes}
            comments={comments}
            me={me}
            slug={slug}
            onChange={load}
          />
          <AfterItinerary trip={trip} slug={slug} inviteUrl={inviteUrl} />
        </>
      )}
    </>
  );
}

function JoinCard({ slug, onJoined }: { slug: string; onJoined: (id: string) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function join() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/trips/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      localStorage.setItem(`pv_member_${slug}`, json.member.id);
      onJoined(json.member.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao entrar.");
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h2>Entrar na viagem</h2>
      <p className="sub">Sem cadastro. So o seu nome para o grupo saber quem e quem.</p>
      <label>Seu nome</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana" />
      {err && <div className="err">{err}</div>}
      <button className="btn full" onClick={join} disabled={loading || !name.trim()}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </div>
  );
}

function PreferencesCard({
  slug,
  me,
  pref,
  trip,
  onSaved,
}: {
  slug: string;
  me: Member;
  pref: Preference | null;
  trip: Trip;
  onSaved: () => void;
}) {
  const [interests, setInterests] = useState<string[]>(pref?.interests ?? []);
  const [restrictions, setRestrictions] = useState<string[]>(pref?.restrictions ?? []);
  const [budget, setBudget] = useState(pref?.daily_budget ?? DAILY_BUDGETS[1]);
  const [from, setFrom] = useState(pref?.present_from ?? trip.start_date);
  const [to, setTo] = useState(pref?.present_to ?? trip.end_date);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function save() {
    setLoading(true);
    await fetch(`/api/trips/${slug}/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: me.id,
        interests,
        restrictions,
        daily_budget: budget,
        present_from: from,
        present_to: to,
      }),
    });
    setLoading(false);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="card">
      <h2>Suas preferencias, {me.name}</h2>
      <p className="sub">A IA usa isso para equilibrar o roteiro entre todo mundo do grupo.</p>

      <label>O que voce nao quer perder</label>
      <div className="chips">
        {INTERESTS.map((i) => (
          <button
            key={i}
            type="button"
            className={`chip ${interests.includes(i) ? "on" : ""}`}
            onClick={() => toggle(interests, setInterests, i)}
          >
            {i}
          </button>
        ))}
      </div>

      <label>Restricoes</label>
      <div className="chips">
        {RESTRICTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip ${restrictions.includes(r) ? "on" : ""}`}
            onClick={() => toggle(restrictions, setRestrictions, r)}
          >
            {r}
          </button>
        ))}
      </div>

      <label>Seu orcamento por dia</label>
      <select value={budget} onChange={(e) => setBudget(e.target.value)}>
        {DAILY_BUDGETS.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </select>

      <div className="grid2 tight">
        <div>
          <label>Voce chega em</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>Voce sai em</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <button className="btn full" onClick={save} disabled={loading}>
        {loading ? "Salvando..." : saved ? "Salvo ✓" : "Salvar preferencias"}
      </button>
    </div>
  );
}

function ItineraryView({
  itinerary,
  members,
  votes,
  comments,
  me,
  slug,
  onChange,
}: {
  itinerary: Itinerary;
  members: Member[];
  votes: Vote[];
  comments: Comment[];
  me: Member | null;
  slug: string;
  onChange: () => void;
}) {
  return (
    <div className="card">
      <h2>Roteiro</h2>
      <p className="sub">
        Versao {itinerary.version} · reaja e comente em qualquer item para o grupo decidir junto
      </p>
      {itinerary.rationale && (
        <div className="note" style={{ marginBottom: 18 }}>
          <b>Por que ficou assim</b>
          <br />
          {itinerary.rationale}
        </div>
      )}
      {itinerary.itinerary_days.map((day) => {
        const total = day.itinerary_items.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
        return (
          <div className="day" key={day.id}>
            <div className="day-h">
              <b>
                {day.day_date}
                {day.title ? ` · ${day.title}` : ""}
              </b>
              <span className="muted">~R$ {total.toFixed(0)}/pessoa</span>
            </div>
            {day.itinerary_items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                members={members}
                votes={votes.filter((v) => v.item_id === item.id)}
                comments={comments.filter((c) => c.item_id === item.id)}
                me={me}
                slug={slug}
                onChange={onChange}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  item,
  members,
  votes,
  comments,
  me,
  slug,
  onChange,
}: {
  item: Item;
  members: Member[];
  votes: Vote[];
  comments: Comment[];
  me: Member | null;
  slug: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(item.needs_vote);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const meuVoto = me ? votes.find((v) => v.member_id === me.id)?.value ?? null : null;
  const nomePor = (id: string) => members.find((m) => m.id === id)?.name ?? "alguem";
  const corPor = (id: string) => members.find((m) => m.id === id)?.color ?? "#8B9AAD";

  async function votar(value: number) {
    if (!me) return;
    setErro("");
    try {
      const res = await fetch(`/api/trips/${slug}/items/${item.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: me.id, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao votar.");
    }
  }

  async function comentar() {
    if (!me || !texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch(`/api/trips/${slug}/items/${item.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: me.id, body: texto }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTexto("");
      onChange();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao comentar.");
    }
    setEnviando(false);
  }

  return (
    <div className="item item-col">
      <div className="item-main">
        <div className="time">{item.start_time}</div>
        <div className="item-b">
          <div className="item-t">
            {item.title}
            {item.verified && <span className="badge b-ok">verificado</span>}
            {item.needs_vote && <span className="badge b-vote">o grupo decide</span>}
          </div>
          <div className="item-d">{item.description}</div>
        </div>
        <div className="cost">
          {item.cost_estimate ? `R$ ${item.cost_estimate.toFixed(0)}` : "gratis"}
        </div>
      </div>

      <div className="reactions">
        {REACTIONS.map((r) => {
          const quem = votes.filter((v) => v.value === r.value);
          const ativo = meuVoto === r.value;
          return (
            <button
              key={r.value}
              className={`react ${ativo ? "on" : ""}`}
              onClick={() => votar(r.value)}
              disabled={!me}
              title={
                quem.length
                  ? quem.map((v) => nomePor(v.member_id)).join(", ")
                  : `Ninguem marcou "${r.label}" ainda`
              }
            >
              <span>{r.emoji}</span>
              {quem.length > 0 && <b>{quem.length}</b>}
            </button>
          );
        })}

        <button className="react ghost" onClick={() => setOpen((o) => !o)}>
          {comments.length > 0 ? `${comments.length} comentario${comments.length > 1 ? "s" : ""}` : "comentar"}
        </button>
      </div>

      {open && (
        <div className="thread">
          {comments.map((c) => (
            <div className="cmt" key={c.id}>
              <div className="av sm" style={{ background: corPor(c.member_id) }}>
                {nomePor(c.member_id).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <b className="small">{nomePor(c.member_id)}</b>
                <div className="item-d">{c.body}</div>
              </div>
            </div>
          ))}

          {me ? (
            <div className="cmt-form">
              <input
                value={texto}
                placeholder={`Comentar como ${me.name}...`}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") comentar();
                }}
              />
              <button
                className="btn sm"
                onClick={comentar}
                disabled={enviando || !texto.trim()}
              >
                {enviando ? "..." : "Enviar"}
              </button>
            </div>
          ) : (
            <p className="tiny" style={{ margin: 0 }}>
              Entre na viagem para comentar.
            </p>
          )}

          {erro && <div className="err">{erro}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * O gatilho de crescimento: a pessoa acabou de ver valor sozinha.
 * E exatamente aqui que convidar o resto do grupo faz sentido pra ela --
 * e nao antes, quando ela ainda nao sabia se o produto era bom.
 */
function AfterItinerary({
  trip,
  slug,
  inviteUrl,
}: {
  trip: Trip;
  slug: string;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid2">
      {trip.is_solo && (
        <div className="card invite">
          <h3>Vai com mais alguém?</h3>
          <p className="sub">
            Mande esse link e cada pessoa marca o que quer fazer. A IA remonta o roteiro
            equilibrando o grupo inteiro — quem é vegetariano, quem odeia museu, quem chega
            depois.
          </p>
          <div className="copybox">{inviteUrl}</div>
          <button className="btn full" onClick={() => copy(inviteUrl)}>
            {copied ? "Copiado ✓" : "Copiar link do convite"}
          </button>
        </div>
      )}

      <div className="card">
        <h3>Compartilhar o roteiro</h3>
        <p className="sub">
          Link público, sem login. Qualquer pessoa consegue abrir e ver o roteiro pronto.
        </p>
        <div className="copybox">{publicUrl}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost full" onClick={() => copy(publicUrl)}>
            Copiar
          </button>
          <a className="btn ghost full" href={`/r/${slug}`} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      </div>
    </div>
  );
}
