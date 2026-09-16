/**
 * Pixel da Meta — so existe quando ha verba rodando.
 *
 * Sem NEXT_PUBLIC_META_PIXEL_ID nada e carregado: nenhum script de
 * terceiro, nenhuma requisicao para a Meta. Quem visita o site fora de
 * campanha nao e rastreado por anuncio, e desligar e apagar a variavel.
 *
 * Existe por um motivo so: sem ele, dinheiro em anuncio compra clique e
 * nao compra aprendizado — nao da para remarketing, nem publico
 * semelhante, nem otimizacao por quem de fato usou o produto.
 */
"use client";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

let pronto = false;

export function initMetaPixel() {
  if (pronto || !META_PIXEL_ID || typeof window === "undefined") return;
  if (window.fbq) {
    pronto = true;
    return;
  }

  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);

  fbq("init", META_PIXEL_ID);
  pronto = true;
}

/** Visita de pagina. O App Router nao recarrega, entao e chamado na mao. */
export function metaPageview() {
  if (!META_PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}

/**
 * Evento de intencao.
 *
 * "Lead" e disparado quando a amostra fica pronta na tela — nao quando a
 * pessoa chega. Clique que nao vira roteiro foi dinheiro perdido, e e
 * isso que a Meta precisa aprender a evitar.
 */
export function metaTrack(evento: string, props?: Record<string, unknown>) {
  if (!META_PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", evento, props);
}
