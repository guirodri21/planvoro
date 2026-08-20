"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUDGET_BANDS, STYLES } from "@/lib/types";

type Modo = "solo" | "grupo" | null;

export default function NovaViagem() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>(null);
  const [form, setForm] = useState({
    organizer_name: "",
    destination: "",
    start_date: "",
    end_date: "",
    party_size: 6,
    budget_band: BUDGET_BANDS[1],
  });
  const [styles, setStyles] = useState<string[]>(["Gastronomia", "Cultura"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleStyle(s: string) {
    setStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, styles, is_solo: modo === "solo" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      localStorage.setItem(`pv_member_${json.slug}`, json.member_id);
      router.push(`/v/${json.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      setLoading(false);
    }
  }

  // Passo 1 — a escolha que define o caminho.
  if (!modo) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
          Como vai ser essa viagem?
        </h1>
        <p className="sub">Dá pra mudar depois — inclusive convidar gente numa viagem que começou sozinha.</p>

        <div className="grid2">
          <button className="pick" onClick={() => setModo("solo")}>
            <span className="pick-emoji">🎒</span>
            <b>Vou sozinho</b>
            <span className="small">
              Você marca o que gosta e recebe o roteiro na hora. Leva uns 2 minutos.
            </span>
            <span className="badge b-ok" style={{ marginTop: 12, marginLeft: 0 }}>
              mais rápido
            </span>
          </button>

          <button className="pick" onClick={() => setModo("grupo")}>
            <span className="pick-emoji">👥</span>
            <b>Vou em grupo</b>
            <span className="small">
              Cada pessoa marca as preferências dela e a IA equilibra todo mundo no mesmo roteiro.
            </span>
            <span className="badge b-vote" style={{ marginTop: 12, marginLeft: 0 }}>
              o que ninguém faz
            </span>
          </button>
        </div>
      </div>
    );
  }

  const solo = modo === "solo";

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <button className="linkback" onClick={() => setModo(null)}>
        ← voltar
      </button>

      <div className="card">
        <h1 style={{ fontSize: 25, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
          {solo ? "Sua viagem" : "A viagem do grupo"}
        </h1>
        <p className="sub">
          {solo
            ? "Preencha e na próxima tela você marca seus interesses. O roteiro sai em seguida."
            : "Preencha e você recebe um link pra mandar no grupo. Quem entrar não precisa criar conta."}
        </p>

        <label>Seu nome</label>
        <input
          value={form.organizer_name}
          placeholder="Guilherme"
          onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
        />

        <label>Destino</label>
        <input
          value={form.destination}
          placeholder="Lisboa, Portugal"
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
        />

        <div className="grid2 tight">
          <div>
            <label>Ida</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <label>Volta</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="grid2 tight">
          {!solo && (
            <div>
              <label>Quantas pessoas</label>
              <input
                type="number"
                min={2}
                max={30}
                value={form.party_size}
                onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) })}
              />
            </div>
          )}
          <div>
            <label>Orçamento {solo ? "" : "por pessoa"} (sem passagem)</label>
            <select
              value={form.budget_band}
              onChange={(e) => setForm({ ...form, budget_band: e.target.value })}
            >
              {BUDGET_BANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <label>Estilo da viagem</label>
        <div className="chips">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${styles.includes(s) ? "on" : ""}`}
              onClick={() => toggleStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <div className="err">{error}</div>}

        <button className="btn full" onClick={submit} disabled={loading}>
          {loading ? "Criando..." : solo ? "Continuar" : "Criar e gerar link de convite"}
        </button>
      </div>
    </div>
  );
}
