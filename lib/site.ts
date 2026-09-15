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
