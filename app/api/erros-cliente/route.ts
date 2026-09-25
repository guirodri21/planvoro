import { NextResponse } from "next/server";
import { alertarErro } from "@/lib/alertas";
import { supabaseAdmin } from "@/lib/supabase";

/** Mais que isso numa hora e tempestade (ou abuso): o resto so e descartado. */
const MAXIMO_POR_HORA = 200;

/**
 * Ruido que nao e bug do Planvoro: extensao do navegador, aviso benigno
 * do ResizeObserver, erro de script de outro dominio sem detalhe.
 */
const IGNORAR = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /extension:\/\//i,
  /Non-Error promise rejection captured/i,
  /AbortError/i,
  /Load failed$/i,
  /Failed to fetch$/i,
  /NetworkError when attempting to fetch/i,
];

/**
 * Agrupa por tela, e nao por endereco: /v/abc e /v/xyz sao a mesma tela,
 * e contar separado mandaria um e-mail de alerta por viagem.
 */
function tela(pagina: string) {
  const caminho = pagina.split(/[?#]/)[0] || "/";
  return caminho
    .replace(/^\/v\/[^/]+/, "/v/[slug]")
    .replace(/^\/r\/[^/]+/, "/r/[slug]")
    .replace(/^\/roteiro\/[^/]+/, "/roteiro/[destino]")
    .replace(/^\/convite\/[^/]+/, "/convite/[token]")
    .slice(0, 120);
}

/**
 * Erro que aconteceu no navegador da pessoa (components/erros-navegador.tsx
 * e app/error.tsx). Entra no mesmo alerta dos erros do servidor.
 *
 * Aberta, porque o erro acontece com quem esta ou nao logado. Por isso
 * so aceita texto curto, descarta ruido conhecido e tem teto por hora.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mensagem = typeof body.mensagem === "string" ? body.mensagem.trim().slice(0, 400) : "";
    const bruto = typeof body.pagina === "string" ? body.pagina : "";
    const caminho = bruto.startsWith("/") ? bruto.slice(0, 300) : "/";
    if (!mensagem || IGNORAR.some((r) => r.test(mensagem))) {
      return NextResponse.json({ ok: true, ignorado: true });
    }

    if (process.env.VERCEL_ENV === "production") {
      const { count } = await supabaseAdmin()
        .from("erros_producao")
        .select("id", { count: "exact", head: true })
        .eq("evento", "erro_navegador")
        .gte("criado_em", new Date(Date.now() - 3_600_000).toISOString());
      if ((count ?? 0) >= MAXIMO_POR_HORA) return NextResponse.json({ ok: true, ignorado: true });
    }

    await alertarErro({ evento: "erro_navegador", rota: tela(caminho), mensagem });
    return NextResponse.json({ ok: true });
  } catch {
    // Relatorio de erro nunca pode virar outro erro na tela da pessoa.
    return NextResponse.json({ ok: true });
  }
}
