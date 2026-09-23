import { AuthScreen, type AuthMode } from "@/components/auth-screen";

/**
 * Destino depois do login, so dentro do proprio site.
 *
 * Barrar "//" nao bastava: o navegador trata "/\evil.com" igual a
 * "//evil.com", e `router.replace` levava a pessoa para fora do Planvoro
 * logo depois de ela digitar a senha — o formato classico de phishing
 * com link legitimo. A checagem agora resolve a URL de verdade e exige a
 * mesma origem.
 */
function safeNextPath(next?: string) {
  if (!next || !next.startsWith("/")) return "/app";
  // Barra invertida e caractere de controle nao tem uso legitimo aqui.
  if (/[\\\u0000-\u001f]/.test(next) || next.startsWith("//")) return "/app";

  const base = "https://planvoro.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/app";
  }
  if (url.origin !== base) return "/app";
  if (url.pathname.startsWith("/entrar") || url.pathname.startsWith("/api")) return "/app";

  return `${url.pathname}${url.search}${url.hash}`;
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next, mode } = await searchParams;
  const initialMode: AuthMode =
    mode === "signup" || mode === "forgot" || mode === "reset" ? mode : "signin";

  return (
    <AuthScreen
      initialMode={initialMode}
      nextPath={safeNextPath(next)}
    />
  );
}
