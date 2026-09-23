/**
 * Conversao do Google Ads — so existe quando ha verba rodando.
 *
 * Mesmo acordo do Pixel da Meta em lib/meta-pixel.ts: sem
 * NEXT_PUBLIC_GOOGLE_ADS_ID nada e carregado, nenhum script de terceiro,
 * nenhuma requisicao ao Google. Quem visita o site fora de campanha nao e
 * rastreado por anuncio, e desligar e apagar a variavel.
 *
 * Por que Google e nao so Meta: busca e intencao declarada. Quem digita
 * "roteiro 2 dias em Gramado quanto custa" ja decidiu viajar, e e
 * exatamente a pergunta que o produto responde. O Meta interrompe quem
 * nao pediu nada — e, em 21/09/2026, a conta de anuncios ainda estava
 * bloqueada.
 *
 * O ID da conversao e o rotulo sao separados de proposito. O ID
 * (AW-XXXXXXXXX) identifica a conta e sobe o gtag; o rotulo identifica
 * *qual* conversao, e so aparece depois que a acao de conversao e criada
 * no painel. Da para subir o gtag e medir cliques antes de existir
 * rotulo nenhum.
 */
"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

/** Rotulo da acao de conversao "amostra entregue". Formato: "abcDEFghi". */
const ROTULO_AMOSTRA = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_AMOSTRA;

let pronto = false;

export function initGoogleAds() {
  if (pronto || !GOOGLE_ADS_ID || typeof window === "undefined") return;

  // Outro script pode ter subido o gtag antes (Analytics, Tag Manager).
  // Reaproveitar evita duas copias brigando pelo mesmo dataLayer.
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
    document.head.appendChild(s);

    window.gtag("js", new Date());
  }

  window.gtag("config", GOOGLE_ADS_ID);
  pronto = true;
}

/**
 * Conversao: a amostra ficou pronta na tela.
 *
 * Nao e disparada na chegada. Clique que nao vira roteiro foi dinheiro
 * perdido, e e isso que o Google precisa aprender a evitar — do mesmo
 * jeito que o "Lead" da Meta.
 *
 * Sem rotulo configurado nao dispara nada: mandar conversao sem rotulo
 * suja o relatorio com evento que o painel nao sabe atribuir.
 */
export function googleAdsAmostraEntregue(destino?: string) {
  if (!GOOGLE_ADS_ID || !ROTULO_AMOSTRA) return;
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${ROTULO_AMOSTRA}`,
    ...(destino ? { destino } : {}),
  });
}
