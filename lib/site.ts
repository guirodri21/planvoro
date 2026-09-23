/**
 * Endereco publico do Planvoro.
 *
 * Existia como a mesma linha copiada em quatro arquivos. Na troca de
 * dominio isso vira quatro chances de esquecer uma — e a que passar
 * despercebida nao quebra nada visivelmente: ela so vai continuar
 * mandando gente para o endereco velho no sitemap, no OpenGraph ou no
 * link compartilhado, que e o tipo de erro que so aparece semanas depois.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro-app.vercel.app"
).replace(/\/+$/, "");

/** Caminho absoluto no site. `absoluteUrl("/v/abc")` → "https://.../v/abc". */
export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * OpenGraph padrao do site.
 *
 * No Next, uma pagina que declara `openGraph` substitui o objeto inteiro
 * do layout — nao mistura. Quem so quer trocar a URL precisa repetir o
 * resto, e isto evita copiar titulo e descricao em cada lugar.
 */
export const DEFAULT_OPEN_GRAPH = {
  title: "Planvoro — roteiro de viagem com IA, pronto em 1 minuto",
  description:
    "Roteiro com IA em 1 minuto, sem conta. Depois, reservas, documentos, grupo e gastos no mesmo lugar.",
  siteName: "Planvoro",
  locale: "pt_BR",
  type: "website" as const,
};

/**
 * Imagem de compartilhamento para paginas que declaram o proprio
 * `openGraph`. A imagem gerada em app/opengraph-image.tsx so entra sozinha
 * onde ninguem sobrescreve o objeto; /experimente e os roteiros publicos
 * saiam no WhatsApp sem figura nenhuma.
 */
export const DEFAULT_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630 };
