"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type SampleItem = {
  start_time: string;
  title: string;
  description: string;
  cost_estimate: number;
  needs_vote?: boolean;
};

type SampleDay = {
  day_date: string;
  title: string;
  note: string;
  items: SampleItem[];
};

type SampleResponse = {
  destination?: string;
  itinerary?: { rationale: string; days: SampleDay[] };
  error?: string;
};

const SUGESTOES = ["Lisboa", "Buenos Aires", "Rio de Janeiro", "Santiago", "Cidade do Cabo"];

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Amostra sem conta.
 *
 * A pessoa digita o destino e vê dois dias de roteiro antes de decidir se
 * cria conta. Quem chega aqui ainda não confia no produto, então o pedido
 * de cadastro só aparece depois que ela já tem algo na tela.
 */
export default function ExperimentePage() {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SampleResponse | null>(null);

  async function gerar(destino: string) {
    const alvo = destino.trim();
    if (alvo.length < 3 || loading) return;

    setLoading(true);
    setError("");
    // O roteiro anterior fica na tela ate o novo chegar.
    // Limpar aqui punia quem tentava um segundo destino: se o pedido
    // falhasse, a pessoa perdia tambem o roteiro que ja tinha conseguido,
    // e ficava com a tela vazia depois de esperar.
    track("amostra_pedida", { destino: alvo.toLowerCase() });

    try {
      const res = await fetch("/api/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: alvo }),
      });
      const json = (await res.json().catch(() => ({}))) as SampleResponse;
      if (!res.ok) throw new Error(json.error ?? "Não consegui montar a amostra agora.");

      setResult(json);
      track("amostra_entregue", { destino: alvo.toLowerCase() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao montar a amostra.");
    } finally {
      setLoading(false);
    }
  }

  const dias = result?.itinerary?.days ?? [];

  return (
    <div className="sample-shell">
      <header className="sample-head">
        <p className="eyebrow">Sem conta, sem cartão</p>
        <h1>Veja um roteiro antes de decidir qualquer coisa</h1>
        <p className="sub">
          Diga o destino e a IA monta dois dias, equilibrando gente que quer coisas diferentes —
          que é o problema de viajar em grupo. O roteiro completo, com o grupo inteiro, é grátis
          também; só precisa de conta para salvar.
        </p>

        <div className="sample-form">
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void gerar(destination);
            }}
            placeholder="Lisboa, Buenos Aires, Salvador..."
            aria-label="Destino"
            maxLength={60}
          />
          <button
            className="btn"
            type="button"
            onClick={() => void gerar(destination)}
            disabled={loading || destination.trim().length < 3}
          >
            {loading ? "Montando..." : "Montar roteiro"}
          </button>
        </div>

        {!result && !loading && (
          <div className="sample-chips">
            <span className="tiny">Ou comece por:</span>
            {SUGESTOES.map((sugestao) => (
              <button
                key={sugestao}
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  setDestination(sugestao);
                  void gerar(sugestao);
                }}
              >
                {sugestao}
              </button>
            ))}
          </div>
        )}

        {error && <div className="err">{error}</div>}
      </header>

      {loading && (
        <div className="card sample-loading">
          <p className="sub">
            Montando dois dias em {destination.trim()}. Leva alguns segundos — a IA confere se cada
            lugar existe de verdade antes de colocar no roteiro.
          </p>
        </div>
      )}

      {result?.itinerary && (
        <>
          {result.itinerary.rationale && (
            <div className="card">
              <span className="badge b-ok">por que ficou assim</span>
              <p className="sub" style={{ marginTop: 8 }}>
                {result.itinerary.rationale}
              </p>
            </div>
          )}

          <div className="card">
            {dias.map((dia) => {
              const soma = dia.items.reduce((s, item) => s + (item.cost_estimate ?? 0), 0);
              return (
                <div className="day" key={dia.day_date}>
                  <div className="day-h">
                    <b>{dia.title || dia.day_date}</b>
                    <span className="muted">~{formatMoney(soma)}</span>
                  </div>
                  {dia.note && <p className="item-d">{dia.note}</p>}
                  {dia.items.map((item, index) => (
                    <div className="item" key={`${dia.day_date}-${index}`}>
                      <div className="time">{item.start_time}</div>
                      <div className="item-b">
                        <div className="item-t">
                          {item.title}
                          {item.needs_vote && <span className="badge b-warn">o grupo decide</span>}
                        </div>
                        <div className="item-d">{item.description}</div>
                      </div>
                      <div className="cost">
                        {item.cost_estimate ? formatMoney(item.cost_estimate) : "grátis"}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="card cta-box">
            <h2 style={{ margin: "0 0 6px" }}>Isso foi só a amostra</h2>
            <p className="sub">
              Com uma conta grátis você gera a viagem inteira, convida o grupo para dizer o que
              cada um quer, e a IA remonta o roteiro equilibrando todo mundo. Convidado nunca paga
              nada.
            </p>
            <a className="btn" href="/entrar?mode=signup&next=%2Fnova">
              Criar minha viagem
            </a>
            <p className="tiny" style={{ marginTop: 12 }}>
              Roteiros e horários são gerados por IA e podem conter erros. Confira preços e
              funcionamento na fonte antes de ir.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
