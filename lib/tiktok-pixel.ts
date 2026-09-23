/**
 * Pixel do TikTok — so existe quando ha verba rodando.
 *
 * Terceiro do mesmo acordo, depois de lib/meta-pixel.ts e lib/google-ads.ts:
 * sem NEXT_PUBLIC_TIKTOK_PIXEL_ID nada e carregado, nenhum script de
 * terceiro, nenhuma requisicao para o TikTok. Quem visita o site fora de
 * campanha nao e rastreado por anuncio, e desligar e apagar a variavel.
 *
 * Existe agora porque o plano e testar um canal por vez, e o custo de
 * deixar pronto e zero enquanto a variavel nao existir. Quando chegar a
 * vez do TikTok, e preencher um campo no Vercel — nao mexer em codigo com
 * campanha no ar.
 *
 * O evento e SubmitForm, nao CompleteRegistration: o que acontece na
 * amostra e alguem pedir um roteiro, nao criar conta. Chamar de cadastro
 * ensinaria o TikTok a procurar a pessoa errada.
 */
"use client";

type Ttq = {
  page: () => void;
  track: (evento: string, props?: Record<string, unknown>) => void;
  load: (id: string) => void;
  methods?: string[];
  [k: string]: unknown;
};

declare global {
  interface Window {
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
  }
}

export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

const METODOS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
];

let pronto = false;

export function initTikTokPixel() {
  if (pronto || !TIKTOK_PIXEL_ID || typeof window === "undefined") return;
  if (window.ttq) {
    pronto = true;
    return;
  }

  /**
   * Fila antes do script chegar.
   *
   * O snippet oficial do TikTok faz isto minificado; escrito assim da
   * para ler o que ele guarda. Sem a fila, um evento disparado no meio
   * segundo entre o init e o download some — e justamente a amostra, que
   * e rapida, cairia nessa janela.
   */
  const fila: unknown[] = [];
  const ttq = fila as unknown as Ttq;

  for (const metodo of METODOS) {
    (ttq as Record<string, unknown>)[metodo] = (...args: unknown[]) => {
      fila.push([metodo, ...args]);
    };
  }

  window.TiktokAnalyticsObject = "ttq";
  window.ttq = ttq;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_PIXEL_ID}&lib=ttq`;
  document.head.appendChild(s);

  ttq.page();
  pronto = true;
}

/** Visita de pagina. O App Router nao recarrega, entao e chamado na mao. */
export function tiktokPageview() {
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined" || !window.ttq) return;
  window.ttq.page();
}

/**
 * Conversao: a amostra ficou pronta na tela.
 *
 * Mesmo momento do "Lead" da Meta e da conversao do Google. Os tres
 * medindo a mesma coisa e o que torna os canais comparaveis — a ideia do
 * teste e um por vez, e comparar so vale se a regua for a mesma.
 */
export function tiktokAmostraEntregue(destino?: string) {
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined" || !window.ttq) return;
  window.ttq.track("SubmitForm", destino ? { content_name: destino } : undefined);
}
