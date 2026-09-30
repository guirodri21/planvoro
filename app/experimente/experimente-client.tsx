"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { googleAdsAmostraEntregue } from "@/lib/google-ads";
import { metaTrack, novoEventId } from "@/lib/meta-pixel";
import { tiktokAmostraEntregue } from "@/lib/tiktok-pixel";
import { formatDayTotal, formatItemCost } from "@/lib/cost";
import { EXEMPLO_SALVADOR, type DiaExemplo } from "@/lib/exemplo-salvador";
import { RevelarAoRolar } from "@/components/revelar-ao-rolar";

type SampleItem = {
  start_time: string;
  title: string;
  description: string;
  cost_estimate: number;
  /** Valor na moeda do destino. Ausente em amostra guardada antes de 06/09. */
  cost_local?: number | null;
  cost_currency?: string | null;
  needs_vote?: boolean;
};

type SampleDay = {
  day_date: string;
  title: string;
  note: string;
  items: SampleItem[];
};

export type SampleResponse = {
  destination?: string;
  itinerary?: { rationale: string; days: SampleDay[] };
  error?: string;
};

/** Destinos brasileiros primeiro: quase todo o trafego do anuncio e daqui. */
const SUGESTOES = ["Salvador", "Rio de Janeiro", "Gramado", "Porto de Galinhas", "Ouro Preto"];

/**
 * Variacao do texto de cima.
 *
 * O anuncio fala da dor do grupo ("ninguem monta o roteiro", "14 abas
 * abertas"); quem vem dele (utm_campaign=dor ou utm_source comecando
 * com "meta") ve o
 * titulo que continua a mesma conversa. Sem UTM, fica o texto de antes —
 * as duas versoes convivem para comparar no PostHog (propriedade
 * `variante` em todo evento desta pagina).
 *
 * A pagina e estatica, entao a escolha acontece no navegador. Para quem
 * vem do anuncio nao ver o titulo antigo piscar, este script roda antes da
 * primeira pintura e marca <html data-exp="dor">; o CSS mostra so o
 * titulo certo. O React so le a marca depois.
 */
const SCRIPT_VARIANTE = `(function(){try{var q=new URLSearchParams(location.search);if(q.get("utm_campaign")==="dor"||(q.get("utm_source")||"").toLowerCase().indexOf("meta")===0){document.documentElement.setAttribute("data-exp","dor")}}catch(e){}})();`;

/**
 * O link do anuncio chega como utm_source="metautm_medium=paid" (falta um
 * "&" no link da Meta). Tudo que comeca com "meta" e o anuncio da Meta;
 * `canal` guarda o valor normalizado para filtrar no PostHog sem depender
 * de o link estar certo.
 */
function canalDe(utmSource: string | null) {
  if (!utmSource) return null;
  return utmSource.toLowerCase().startsWith("meta") ? "meta" : utmSource.toLowerCase();
}

type Variante = "dor" | "padrao";

type EventoDaPagina =
  | "campo_destino_focado"
  | "destino_digitado"
  | "sugestao_clicada"
  | "botao_montar_clicado"
  | "exemplo_rolado_50"
  | "experimente_visto"
  | "exemplo_visto"
  | "exemplo_dia2_aberto"
  | "exemplo_cta_clicado";

/** Um dia do exemplo fixo, no mesmo visual dos dias da amostra. */
function DiaDoExemplo({ numero, dia }: { numero: number; dia: DiaExemplo }) {
  const total = formatDayTotal(dia.paradas.map((p) => ({ cost_estimate: p.custo })));
  return (
    <div className="day">
      <div className="day-h">
        <b>
          Dia {numero} · {dia.titulo}
        </b>
        <span className="muted">total {total}</span>
      </div>
      {dia.paradas.map((parada) => (
        <div className="item" key={parada.hora}>
          <div className="time">{parada.hora}</div>
          <div className="item-b">
            <div className="item-t">{parada.titulo}</div>
          </div>
          <div className="cost">{formatItemCost(parada.custo, null, null)}</div>
        </div>
      ))}
    </div>
  );
}

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
/** De onde a pessoa veio. Vai junto em todo evento desta pagina. */
type Origem = { utm_source: string | null; utm_campaign: string | null; canal: string | null; variante: Variante };

function lerOrigem(params: URLSearchParams): Origem {
  const limpo = (valor: string | null) => (valor ? valor.trim().slice(0, 60) || null : null);
  const variante: Variante = document.documentElement.getAttribute("data-exp") === "dor" ? "dor" : "padrao";
  const utmSource = limpo(params.get("utm_source"));
  return { utm_source: utmSource, utm_campaign: limpo(params.get("utm_campaign")), canal: canalDe(utmSource), variante };
}

export default function ExperimenteClient({ exemplo }: { exemplo: SampleResponse | null }) {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SampleResponse | null>(null);

  /**
   * Origem e ?d= sao lidos aqui, e nao no servidor: ler a URL no servidor
   * deixava a pagina dinamica (ver page.tsx).
   *
   * As paginas de destino mandam gente para ca com ?d=Foz do Iguacu. Quem
   * chegou lendo um roteiro de Foz ja disse qual e o destino dele. Preenche
   * o campo mas nao gera sozinho: geracao automatica faria o rastreador do
   * Google e cada link compartilhado gastarem uma chamada da IA.
   */
  const origem = useRef<Origem>({ utm_source: null, utm_campaign: null, canal: null, variante: "padrao" });
  const jaMarcou = useRef(new Set<string>());
  const meioDoExemplo = useRef<HTMLDivElement | null>(null);
  const exemploPronto = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const [dia2Aberto, setDia2Aberto] = useState(false);

  /** Evento desta pagina, com a origem. `umaVez` evita repetir por visita. */
  function marcar(
    evento: EventoDaPagina,
    props: Record<string, unknown> = {},
    umaVez = false
  ) {
    if (umaVez) {
      if (jaMarcou.current.has(evento)) return;
      jaMarcou.current.add(evento);
    }
    track(evento, { ...origem.current, ...props });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    origem.current = lerOrigem(params);
    const d = params.get("d");
    if (d) setDestination(d.slice(0, 60));
    marcar("experimente_visto", { com_exemplo: Boolean(exemplo), com_destino: Boolean(d) }, true);
    // So na montagem: e a "visita".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * "Leu o exemplo": o meio do bloco do exemplo entrou na tela. Um
   * marcador no meio do bloco, e nao 50% do bloco visivel, porque no
   * celular o exemplo e mais alto que duas telas — metade dele nunca cabe
   * visivel ao mesmo tempo, e o evento nunca dispararia.
   */
  useEffect(() => {
    const alvo = meioDoExemplo.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting || e.boundingClientRect.top < 0)) {
        marcar("exemplo_rolado_50", {}, true);
        observador.disconnect();
      }
    });
    observador.observe(alvo);
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exemplo]);

  /**
   * "Viu o exemplo pronto" (variacao dor): o cartao de Salvador entrou na
   * tela. Na versao padrao ele fica com display:none e nunca intercepta,
   * entao o evento so existe para quem veio do anuncio.
   */
  useEffect(() => {
    const alvo = exemploPronto.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        if (!jaMarcou.current.has("exemplo_visto")) metaTrack("ViewContent");
        marcar("exemplo_visto", { destino_exemplo: "salvador" }, true);
        observador.disconnect();
      }
    });
    observador.observe(alvo);
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Do exemplo para o campo. O foco vem antes da rolagem e dentro do
   * proprio toque: o Safari do iPhone so abre o teclado quando o foco
   * acontece no gesto do usuario, nao depois de uma animacao.
   */
  function irParaOCampo() {
    marcar("exemplo_cta_clicado");
    const alvo = campo.current;
    if (!alvo) return;
    alvo.focus({ preventScroll: true });
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /**
   * O que a pessoa ve antes de digitar qualquer coisa.
   *
   * A home promete "Ver um roteiro agora" e esta pagina entregava um campo
   * vazio. Medido no PostHog entre 07 e 16/09/2026: 32 visitantes reais
   * chegaram ate aqui e nenhum pediu amostra. Quem clica para VER nao
   * quer preencher formulario — quer ver.
   *
   * Entao a tela abre com um roteiro de verdade, vindo do cache, e o
   * campo passa a ser o segundo passo: "agora faca com o seu destino".
   */
  const mostrando = result ?? exemplo;
  const ehExemplo = !result && !!exemplo;

  async function gerar(destino: string) {
    const alvo = destino.trim();
    if (alvo.length < 3 || loading) return;

    setLoading(true);
    setError("");
    // O roteiro anterior fica na tela ate o novo chegar.
    // Limpar aqui punia quem tentava um segundo destino: se o pedido
    // falhasse, a pessoa perdia tambem o roteiro que ja tinha conseguido,
    // e ficava com a tela vazia depois de esperar.
    // Mesma origem dos outros eventos da pagina (canal, variante, UTMs):
    // sem ela, o funil filtrado por canal = meta perdia as duas ultimas etapas.
    track("amostra_pedida", { ...origem.current, destino: alvo.toLowerCase() });

    // O mesmo id vai para o servidor, que manda o Lead pela API de
    // Conversoes: quem bloqueia o Pixel ainda conta, e quem nao bloqueia
    // nao conta duas vezes.
    const eventoLead = novoEventId("amostra");

    try {
      const res = await fetch("/api/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: alvo, evento_id: eventoLead }),
      });
      const json = (await res.json().catch(() => ({}))) as SampleResponse;
      if (!res.ok) throw new Error(json.error ?? "Não consegui montar a amostra agora.");

      setResult(json);
      track("amostra_entregue", { ...origem.current, destino: alvo.toLowerCase() });
      // Para a Meta, este e o evento que vale: clique que virou roteiro.
      // Sem o destino — a Politica de Privacidade promete isso.
      metaTrack("Lead", {}, eventoLead);
      // Mesma acao, o outro leilao. Os dois medem a mesma coisa — amostra
      // na tela — para as campanhas serem comparaveis pelo mesmo criterio.
      googleAdsAmostraEntregue(alvo.toLowerCase());
      tiktokAmostraEntregue(alvo.toLowerCase());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao montar a amostra.");
    } finally {
      setLoading(false);
    }
  }

  const dias = mostrando?.itinerary?.days ?? [];

  return (
    <div className="sample-shell">
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_VARIANTE }} />
      <RevelarAoRolar />
      <header className="sample-head">
        {/* Variacao "dor": quem veio do anuncio. */}
        <div className="exp-dor">
          <h1 className="exp-titulo-dor">
            <span>Chega de 14 abas.</span> Digite o destino e receba o roteiro do grupo, com o preço de
            cada parada, em 1 minuto.
          </h1>
          <p className="sub">Sem conta, sem cartão.</p>

          {/*
            Exemplo pronto antes do formulario. 43 pessoas vieram do
            anuncio, 1 tocou no campo: quem chega do Reels nao sabe ainda o
            que vai receber. Salvador fixo no codigo (lib/exemplo-salvador.ts),
            sem fetch nem IA, para aparecer ja na primeira pintura.
          */}
          <div className="exp-exemplo" role="region" aria-label="Exemplo de roteiro pronto">
            <p className="exp-exemplo-intro">Assim fica o seu roteiro — com o preço de cada parada.</p>
            <div className="card sample-dias exp-exemplo-card" ref={exemploPronto}>
              <span className="badge b-ok">exemplo · {EXEMPLO_SALVADOR.destino}, 2 dias</span>
              <DiaDoExemplo numero={1} dia={EXEMPLO_SALVADOR.dias[0]} />
              {dia2Aberto ? (
                <DiaDoExemplo numero={2} dia={EXEMPLO_SALVADOR.dias[1]} />
              ) : (
                <button
                  type="button"
                  className="exp-ver-dia2"
                  aria-expanded={false}
                  onClick={() => {
                    setDia2Aberto(true);
                    marcar("exemplo_dia2_aberto", {}, true);
                  }}
                >
                  ver dia 2 ▾
                </button>
              )}
            </div>
            <button type="button" className="btn lg full" onClick={irParaOCampo}>
              Montar o meu destino →
            </button>
          </div>
        </div>

        {/* Texto de antes, para quem chega sem UTM. */}
        <div className="exp-padrao">
          <p className="exp-selo">Sem conta, sem cartão</p>
          <h1>
            {ehExemplo
              ? `Dois dias em ${exemplo?.destination ?? "Buenos Aires"}, como o Planvoro monta`
              : "Veja um roteiro antes de decidir qualquer coisa"}
          </h1>
          <p className="sub">
            {ehExemplo
              ? "Este roteiro abaixo é real, com horário e custo estimado de cada parada. Troque pelo seu destino e a IA monta o seu em cerca de um minuto — sem conta, sem cartão."
              : "Diga o destino e a IA monta dois dias, equilibrando gente que quer coisas diferentes — que é o problema de viajar em grupo. O roteiro completo, com o grupo inteiro, é grátis também; só precisa de conta para salvar."}
          </p>
        </div>

        <div className="sample-form">
          <input
            ref={campo}
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              // So o fato de ter digitado: o texto nao vai para o analytics.
              marcar("destino_digitado", {}, true);
            }}
            onFocus={() => marcar("campo_destino_focado", {}, true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                marcar("botao_montar_clicado", { via: "enter", pronto: destination.trim().length >= 3 });
                void gerar(destination);
              }
            }}
            placeholder="Para onde vocês vão? Ex.: Salvador"
            aria-label="Destino"
            maxLength={60}
          />
          <button
            className="btn"
            type="button"
            onClick={() => {
              marcar("botao_montar_clicado", { via: "botao", pronto: true });
              void gerar(destination);
            }}
            disabled={loading || destination.trim().length < 3}
          >
            {loading ? "Montando..." : "Montar meu roteiro grátis"}
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
                  marcar("sugestao_clicada", { destino: sugestao });
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

      {mostrando?.itinerary && (
        <>
          {/* Um cartao so, com o dia 1 logo no topo: e o que responde "isso serve para mim?". O "por que ficou assim" do exemplo passa de quatro linhas para no maximo duas. */}
          {/* O exemplo guardado surge ao rolar; o roteiro que a pessoa acabou
              de pedir entra dia a dia (classe "surgir", ver o CSS). */}
          <div
            className={`card sample-dias ${ehExemplo ? "" : "surgir"}`}
            key={ehExemplo ? "exemplo" : `resultado-${mostrando.destination ?? ""}`}
            {...(ehExemplo ? { "data-revelar": "" } : {})}
          >
            {ehExemplo && <div ref={meioDoExemplo} className="sample-meio" aria-hidden="true" />}
            <div className="sample-dias-topo">
              <span className="badge b-ok">
                {ehExemplo ? `exemplo real · ${mostrando.destination}` : `seu roteiro · ${mostrando.destination ?? ""}`}
              </span>
              {mostrando.itinerary.rationale && (
                <p className={`sub sample-porque ${ehExemplo ? "curto" : ""}`}>{mostrando.itinerary.rationale}</p>
              )}
            </div>
            {dias.map((dia, indice) => {
              const soma = formatDayTotal(dia.items);
              return (
                <div
                  className="day"
                  key={dia.day_date}
                  style={ehExemplo ? undefined : ({ "--surgir-atraso": `${indice * 140}ms` } as React.CSSProperties)}
                >
                  <div className="day-h">
                    <b>{dia.title || dia.day_date}</b>
                    <span className="muted">{soma}</span>
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
                      {/*
                        Esta tela ficou de fora quando o custo passou a
                        mostrar a moeda do destino: eu troquei o workspace
                        e a pagina publica, e nao esta. Era a mais visivel
                        das tres — e a unica que alguem sem conta ve.
                      */}
                      <div className="cost">
                        {formatItemCost(
                          item.cost_estimate,
                          item.cost_local ?? null,
                          item.cost_currency ?? null
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="card cta-box" data-revelar data-revelar-atraso="1">
            <h2 style={{ margin: "0 0 6px" }}>
              {ehExemplo ? "Agora faça com o seu destino" : "Isso foi só a amostra"}
            </h2>
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
