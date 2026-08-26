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
  // saida viral
  | "roteiro_compartilhado"
  | "viagem_duplicada"
  | "pix_copiado"
  // limites e falhas que o usuario sente
  | "limite_atingido"
  // dinheiro
  | "checkout_iniciado";
