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
 *
 * Nenhum evento leva destino, nome ou e-mail. O que a Meta recebe daqui e
 * o nome do evento, o valor da compra e o id que casa o evento do
 * navegador com o mesmo evento mandado pelo servidor (lib/meta-capi.ts).
 */
"use client";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export type EventoMeta = "PageView" | "ViewContent" | "Lead" | "CompleteRegistration" | "Purchase";

let fila = false;
let script = false;

/**
 * A fila do fbq, sem o script.
 *
 * E o mesmo truque do codigo oficial: `fbq` existe na hora e guarda os
 * eventos; quando o fbevents.js chega, ele esvazia a fila. Assim um
 * evento disparado antes do script carregar nao se perde.
 */
function garantirFila() {
  if (fila || !META_PIXEL_ID || typeof window === "undefined") return;
  fila = true;
  if (window.fbq) return;

  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
  };
  // Igual ao snippet oficial da Meta, inclusive o `push` (o fbevents.js
  // conta com ele).
  fbq.push = fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  fbq("init", META_PIXEL_ID);
}

/**
 * O script da Meta, so depois que a pagina ja esta de pe.
 *
 * Espera o `load` e mais um respiro do navegador: no 4G, os ~90 KB do
 * fbevents.js disputavam banda com o nosso proprio JS e atrasavam a
 * primeira tela da /experimente — que e para onde o anuncio aponta.
 */
export function initMetaPixel() {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  garantirFila();
  if (script) return;
  script = true;

  const carregar = () => {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  };
  const depoisDoRespiro = () => {
    const ocioso = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (ocioso) ocioso(carregar, { timeout: 3000 });
    else window.setTimeout(carregar, 1500);
  };

  if (document.readyState === "complete") depoisDoRespiro();
  else window.addEventListener("load", depoisDoRespiro, { once: true });
}

/** Visita de pagina. O App Router nao recarrega, entao e chamado na mao. */
export function metaPageview() {
  metaTrack("PageView");
}

/**
 * Evento padrao da Meta.
 *
 * `eventId` e o que evita contar duas vezes quando o servidor manda o
 * mesmo evento pela API de Conversoes.
 */
export function metaTrack(evento: EventoMeta, props?: Record<string, unknown>, eventId?: string) {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  garantirFila();
  if (!window.fbq) return;
  /**
   * So os argumentos que existem.
   *
   * A versao anterior sempre passava o terceiro argumento, e sem
   * parametros ele ia como `undefined`: fbq("track", "PageView",
   * undefined). O codigo oficial chama fbq("track", "PageView") — e o
   * PageView, o ViewContent e o CompleteRegistration (os eventos sem
   * parametro) pararam de aparecer no Gerenciador de Eventos. O Lead
   * escapava porque sempre leva {} e o eventID.
   */
  const argumentos: unknown[] = ["track", evento];
  if (props || eventId) argumentos.push(props ?? {});
  if (eventId) argumentos.push({ eventID: eventId });
  window.fbq(...argumentos);
}

/** Id novo para um evento que vai pelos dois caminhos (navegador e servidor). */
export function novoEventId(prefixo: string) {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefixo}-${aleatorio}`;
}
