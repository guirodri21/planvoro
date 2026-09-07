/**
 * Analytics — funil de convite (PostHog)
 *
 * A metrica que decide o rumo do produto e "% de convidados que entram".
 * Abaixo de 40%, nenhuma funcionalidade nova salva. Por isso o funil e
 * instrumentado ponta a ponta, e nao so pageview.
 *
 * Se NEXT_PUBLIC_POSTHOG_KEY nao estiver configurada, tudo aqui vira
 * no-op silencioso: dev local e deploy sem PostHog continuam funcionando.
 */
"use client";

import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let pronto = false;

export function initAnalytics() {
  if (pronto || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    // capturamos pageview na mao, porque o App Router nao dispara
    // navegacao completa entre rotas
    capture_pageview: false,
    // LGPD: nada de gravacao de tela nem coleta automatica de cliques
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage",
  });
  pronto = true;
  vigiarChamadas();
}

/**
 * Toda falha da nossa API vira evento, uma vez so.
 *
 * Ha 26 lugares no app que capturam erro e mostram mensagem na tela.
 * Nenhum deles avisava ninguem: o cliente via o erro, fechava a aba, e o
 * defeito nao existia para nós. Instrumentar os 26 na mao seria muita
 * edicao para pouca garantia — o 27º nasceria sem instrumentacao.
 *
 * Envolver o fetch pega todos de uma vez, inclusive os que ainda nao
 * existem. Registra rota e status, nunca o corpo: a resposta carrega nome,
 * e-mail e localizador de reserva, e analytics nao e lugar para isso.
 */
function vigiarChamadas() {
  if (typeof window === "undefined" || !KEY) return;

  const original = window.fetch;

  window.fetch = async (...args) => {
    const alvo = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
    const nossa = alvo.startsWith("/api/") || alvo.includes("/api/");

    try {
      const res = await original(...args);

      // 401 e 402 sao respostas de negocio, nao falhas: "entre na conta" e
      // "isso faz parte do Passe" acontecem o tempo todo e por bom motivo.
      if (nossa && !res.ok && res.status !== 401 && res.status !== 402) {
        posthog.capture("erro_api", { rota: rotaLimpa(alvo), status: res.status });
      }

      return res;
    } catch (erro) {
      if (nossa) {
        posthog.capture("erro_api", {
          rota: rotaLimpa(alvo),
          status: 0,
          motivo: erro instanceof Error ? erro.name : "desconhecido",
        });
      }
      throw erro;
    }
  };
}

/** Tira ids e slugs, senao cada viagem vira uma rota diferente no relatorio. */
function rotaLimpa(url: string) {
  const caminho = url.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
  return caminho
    .replace(/\/trips\/[^/]+/, "/trips/[slug]")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/[id]");
}

export const analyticsAtivo = Boolean(KEY);

type Props = Record<string, unknown>;

export function track(evento: Evento, props?: Props) {
  if (!KEY || typeof window === "undefined") return;
  posthog.capture(evento, props);
}

export function pageview(rota: string) {
  if (!KEY || typeof window === "undefined") return;
  posthog.capture("$pageview", { $current_url: window.location.href, rota });
}

/**
 * Amarra os eventos a pessoa. Hoje existe Supabase Auth, entao o ideal e
 * passar o id do usuario; o member_id continua aceito para o caso de
 * telas que so conhecem a participacao na viagem.
 */
export function identificar(id: string, props?: Props) {
  if (!KEY || typeof window === "undefined") return;
  posthog.identify(id, props);
}

/**
 * Os eventos do funil. Tipado de proposito: evento com nome errado
 * nao compila, e nome errado em analytics so aparece semanas depois,
 * quando o dado ja se perdeu.
 */
export type Evento =
  // entrada
  | "conta_criada"
  | "viagem_criada"
  | "convite_aberto"
  | "convite_copiado"
  // o funil que decide tudo
  | "convidado_entrou"
  | "preferencias_salvas"
  // o momento "aha"
  | "roteiro_gerado"
  | "roteiro_falhou"
  // decisao em grupo
  | "voto_registrado"
  | "comentario_enviado"
  // central da viagem
  | "cofre_item_salvo"
  | "cofre_anexo_enviado"
  | "cofre_importacao_usada"
  | "agente_pergunta_feita"
  // amostra sem conta
  | "amostra_pedida"
  | "amostra_entregue"
  // saida viral
  | "roteiro_compartilhado"
  | "viagem_duplicada"
  | "pix_copiado"
  // limites e falhas que o usuario sente
  | "limite_atingido"
  | "erro_api"
  // dinheiro
  | "planos_abertos"
  | "teste_gratis_iniciado"
  | "checkout_iniciado"
  | "checkout_voltou";
