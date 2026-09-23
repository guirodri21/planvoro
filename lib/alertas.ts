import { legalSupportEmail } from "./legal";
import { resendClient, resendFromEmail } from "./resend";
import { absoluteUrl } from "./site";
import { supabaseAdmin } from "./supabase";

/**
 * Alerta de erro em producao, por e-mail.
 *
 * Toda falha do servidor vira uma linha em `erros_producao`. A primeira de
 * cada tipo (evento + rota) numa janela de uma hora manda e-mail na hora;
 * as seguintes so contam, e aparecem no resumo diario do cron. Assim um
 * banco fora do ar gera um e-mail por hora, e nao mil.
 *
 * So roda na producao da Vercel: preview e maquina local nao alertam.
 *
 * Nao importa o logger de proposito: se o alerta falhar e chamar
 * `logError`, o `logError` chamaria o alerta de novo, em circulo.
 */

const JANELA_MS = 60 * 60 * 1000;

export type ErroParaAlerta = {
  evento: string;
  rota?: string | null;
  mensagem: string;
};

function destinatario() {
  return process.env.ALERTA_EMAIL?.trim() || legalSupportEmail;
}

function alertaLigado() {
  return (
    process.env.VERCEL_ENV === "production" &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function alertarErro({ evento, rota, mensagem }: ErroParaAlerta) {
  if (!alertaLigado()) return;

  try {
    const db = supabaseAdmin();
    const texto = mensagem.slice(0, 500);

    const { data: recente } = await db
      .from("erros_producao")
      .select("id")
      .eq("evento", evento)
      .eq("rota", rota ?? "")
      .eq("alertado", true)
      .gte("criado_em", new Date(Date.now() - JANELA_MS).toISOString())
      .limit(1);

    const avisar = !recente?.length && Boolean(process.env.RESEND_API_KEY);

    await db.from("erros_producao").insert({
      evento,
      rota: rota ?? "",
      mensagem: texto,
      alertado: avisar,
    });

    if (!avisar) return;

    const onde = rota ? `${evento} em ${rota}` : evento;
    const { error } = await resendClient().emails.send({
      from: resendFromEmail(),
      to: [destinatario()],
      subject: `[Planvoro] Erro em produção: ${onde}`,
      text: [
        `Evento: ${evento}`,
        `Rota: ${rota || "-"}`,
        `Mensagem: ${texto}`,
        `Quando: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        "",
        "Repetições deste mesmo erro na próxima hora não geram outro e-mail; entram no resumo diário.",
        `Logs: https://vercel.com (projeto planvoro-app) · Site: ${absoluteUrl("/")}`,
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#17201d">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c2410c;font-weight:700;margin:0 0 8px">Erro em produção</p>
<p style="margin:0 0 4px"><b>Evento:</b> ${escapeHtml(evento)}</p>
<p style="margin:0 0 4px"><b>Rota:</b> ${escapeHtml(rota || "-")}</p>
<p style="margin:0 0 12px"><b>Mensagem:</b> <code>${escapeHtml(texto)}</code></p>
<p style="color:#84918d;font-size:12px;margin:0">Repetições deste mesmo erro na próxima hora não geram outro e-mail; entram no resumo diário.</p>
</div>`,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        event: "alerta_falhou",
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    );
  }
}

/**
 * Resumo das ultimas 24 horas, para o cron diario. Tambem apaga o que
 * passou de 30 dias. Devolve quantos erros houve.
 */
export async function resumoDiarioDeErros() {
  if (!alertaLigado()) return 0;
  const db = supabaseAdmin();

  await db
    .from("erros_producao")
    .delete()
    .lt("criado_em", new Date(Date.now() - 30 * 24 * JANELA_MS).toISOString());

  const { data, error } = await db
    .from("erros_producao")
    .select("evento, rota, mensagem")
    .gte("criado_em", new Date(Date.now() - 24 * JANELA_MS).toISOString())
    .limit(5000);
  if (error) throw error;
  if (!data?.length || !process.env.RESEND_API_KEY) return data?.length ?? 0;

  const grupos = new Map<string, { vezes: number; mensagem: string }>();
  for (const linha of data) {
    const chave = `${linha.evento}${linha.rota ? ` em ${linha.rota}` : ""}`;
    const atual = grupos.get(chave);
    grupos.set(chave, { vezes: (atual?.vezes ?? 0) + 1, mensagem: atual?.mensagem ?? String(linha.mensagem ?? "") });
  }
  const linhas = [...grupos.entries()]
    .sort((a, b) => b[1].vezes - a[1].vezes)
    .map(([onde, g]) => `${g.vezes}× ${onde} — ${g.mensagem.slice(0, 160)}`);

  const { error: erroEnvio } = await resendClient().emails.send({
    from: resendFromEmail(),
    to: [destinatario()],
    subject: `[Planvoro] Resumo: ${data.length} ${data.length === 1 ? "erro" : "erros"} nas últimas 24h`,
    text: ["Erros em produção nas últimas 24 horas:", "", ...linhas].join("\n"),
  });
  if (erroEnvio) throw new Error(erroEnvio.message);
  return data.length;
}
