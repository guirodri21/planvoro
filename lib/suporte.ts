/**
 * Canais de suporte. Mora fora de lib/legal.ts porque roda no navegador
 * (botao "Ajuda") e no servidor (rota /api/suporte).
 */

/** WhatsApp do suporte, no formato do wa.me: pais + DDD + numero. */
export const SUPORTE_WHATSAPP = "5571993898278";

export const SUPORTE_TIPOS = ["ajuda", "sugestao"] as const;
export type SuporteTipo = (typeof SUPORTE_TIPOS)[number];

export const SUPORTE_MIN = 10;
export const SUPORTE_MAX = 2000;

/** Conversa no WhatsApp do suporte com a primeira mensagem ja escrita. */
export function whatsappSuporteUrl(texto: string) {
  return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

/** Slug da viagem quando a pessoa esta dentro de uma (/v/<slug>). */
export function slugDaPagina(pagina: string) {
  const m = /^\/v\/([a-z0-9-]{1,80})(?:[/?#]|$)/i.exec(pagina);
  return m ? m[1] : null;
}
