import type { SupabaseClient } from "@supabase/supabase-js";
import { logError, logInfo } from "./logger";
import { resendClient, resendFromEmail, resendReplyTo } from "./resend";
import { absoluteUrl } from "./site";

/**
 * E-mails automaticos do ciclo de vida da viagem.
 *
 * Ate aqui o unico e-mail do produto era o convite. Quem criava a viagem
 * e fechava a aba nao ouvia mais nada; quem estava no teste gratis
 * descobria que acabou quando o Cofre trancava; quem pagava nao recebia
 * nem recibo. Cada funcao aqui cobre um desses silencios.
 *
 * Todos sao transacionais — nascem de algo que a pessoa fez ou de um prazo
 * da viagem dela — e dizem no rodape por que chegaram. Nenhum carrega
 * conteudo que a pessoa nao escreveu ou nao comprou.
 *
 * Falha de envio nunca derruba a acao principal: criar viagem ou liberar
 * pagamento continua valendo mesmo se o Resend estiver fora do ar.
 */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Bloco = {
  etiqueta: string;
  titulo: string;
  paragrafos: string[];
  botao: { texto: string; url: string };
  porque: string;
};

function montarHtml({ etiqueta, titulo, paragrafos, botao, porque }: Bloco) {
  const corpo = paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#4b5b56;">${escapeHtml(p)}</p>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(titulo)}</title></head>
  <body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#17201d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e3e9e6;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#0e9c6b;font-weight:700;">${escapeHtml(etiqueta)}</div>
            <h1 style="margin:14px 0 16px;font-size:26px;line-height:1.2;color:#17201d;">${escapeHtml(titulo)}</h1>
            ${corpo}
          </td></tr>
          <tr><td style="padding:8px 32px 28px;">
            <a href="${botao.url}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0e9c6b;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(botao.texto)}</a>
          </td></tr>
          <tr><td style="padding:18px 32px 26px;border-top:1px solid #e3e9e6;color:#84918d;font-size:12px;line-height:1.7;">
            ${escapeHtml(porque)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function montarTexto({ titulo, paragrafos, botao, porque }: Bloco) {
  return [titulo, "", ...paragrafos, "", `${botao.texto}: ${botao.url}`, "", porque].join("\n");
}

async function enviar(para: string, assunto: string, bloco: Bloco, tipo: string) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const { error } = await resendClient().emails.send({
      from: resendFromEmail(),
      to: [para],
      replyTo: resendReplyTo(),
      subject: assunto,
      html: montarHtml(bloco),
      text: montarTexto(bloco),
    });
    if (error) throw new Error(error.message);
    logInfo({ event: "email_enviado", route: "lifecycle-email", tipo });
    return true;
  } catch (e) {
    logError({ event: "email_falhou", route: "lifecycle-email", tipo, error: e });
    return false;
  }
}

/** E-mail da conta, lido pelo servidor. Nunca vem do navegador. */
export async function emailDoUsuario(db: SupabaseClient, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

function dataBR(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
}

/** Primeira viagem criada: o que fazer em seguida. */
export function emailPrimeiraViagem(para: string, trip: { destination: string; slug: string; is_solo: boolean }) {
  return enviar(
    para,
    `Sua viagem para ${trip.destination} está criada`,
    {
      etiqueta: "Bem-vindo ao Planvoro",
      titulo: `${trip.destination} já tem um lugar para tudo`,
      paragrafos: [
        "Três coisas deixam a viagem pronta mais rápido:",
        trip.is_solo
          ? "1. Revise o roteiro e troque o que não tem a sua cara — dá para editar item por item."
          : "1. Mande o link para o grupo: cada pessoa marca o que quer e a IA remonta o roteiro equilibrando todo mundo.",
        "2. Guarde voo e hospedagem no Cofre — cole o e-mail da reserva e o Planvoro preenche.",
        "3. Registre os primeiros gastos para o acerto do grupo ficar claro desde o começo.",
      ],
      botao: { texto: "Abrir a viagem", url: absoluteUrl(`/v/${trip.slug}`) },
      porque: "Você recebeu este e-mail porque criou sua primeira viagem no Planvoro.",
    },
    "primeira_viagem"
  );
}

/** Recibo do pagamento confirmado. */
export function emailRecibo(
  para: string,
  compra: { plano: "trip_pass" | "pro_annual"; valorCentavos: number | null; destino?: string | null; slug?: string | null }
) {
  const valor =
    compra.valorCentavos != null
      ? (compra.valorCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;
  const passe = compra.plano === "trip_pass";
  return enviar(
    para,
    passe ? `Pagamento confirmado: ${compra.destino ?? "sua viagem"} está liberada` : "Pagamento confirmado: seu Pro está ativo",
    {
      etiqueta: "Recibo",
      titulo: passe ? `${compra.destino ?? "Sua viagem"} está liberada` : "Seu Planvoro Pro está ativo",
      paragrafos: [
        passe
          ? "Cofre, gastos, checklist, modo viagem e agente estão liberados para todo o grupo desta viagem, até 90 dias depois da volta."
          : "Todas as viagens que você organizar ficam liberadas por um ano, sem renovação automática.",
        valor ? `Valor pago: ${valor}. Pagamento processado pela AbacatePay.` : "Pagamento processado pela AbacatePay.",
        "Guarde este e-mail como comprovante. Qualquer problema, é só responder.",
      ],
      botao: {
        texto: passe ? "Abrir a viagem" : "Ver minhas viagens",
        url: absoluteUrl(passe && compra.slug ? `/v/${compra.slug}` : "/app"),
      },
      porque: "Você recebeu este e-mail porque fez uma compra no Planvoro.",
    },
    "recibo"
  );
}

/** Teste gratis acaba nas proximas 24 horas. */
export function emailTesteAcabando(para: string, trip: { destination: string; slug: string; expira: string }) {
  return enviar(
    para,
    `Seu teste grátis em ${trip.destination} acaba amanhã`,
    {
      etiqueta: "Teste grátis",
      titulo: `O teste de ${trip.destination} acaba em ${dataBR(trip.expira)}`,
      paragrafos: [
        "Depois disso, Cofre, gastos, checklist, modo viagem e agente voltam a ficar trancados nesta viagem. Nada do que foi salvo é apagado: continua visível para o grupo.",
        "Para seguir usando, libere a viagem com o Passe — pagamento único, sem mensalidade, e vale para o grupo todo.",
      ],
      botao: { texto: "Liberar a viagem", url: absoluteUrl(`/planos?viagem=${encodeURIComponent(trip.slug)}`) },
      porque: `Você recebeu este e-mail porque começou um teste grátis na viagem ${trip.destination}.`,
    },
    "teste_acabando"
  );
}

/** Tres dias depois de criar, o grupo ainda nao entrou todo. */
export function emailChamarGrupo(para: string, trip: { destination: string; slug: string; faltam: number }) {
  return enviar(
    para,
    `Faltam ${trip.faltam} ${trip.faltam === 1 ? "pessoa" : "pessoas"} na viagem para ${trip.destination}`,
    {
      etiqueta: "Lembrete",
      titulo: `O grupo de ${trip.destination} ainda não está completo`,
      paragrafos: [
        `${trip.faltam === 1 ? "Falta 1 pessoa entrar" : `Faltam ${trip.faltam} pessoas entrarem`} na viagem. Quanto mais gente marca o que quer, melhor o roteiro fica para todo mundo.`,
        "O jeito mais rápido é mandar o link no grupo do WhatsApp — o botão abaixo abre a viagem com o convite pronto para copiar.",
      ],
      botao: { texto: "Chamar o grupo", url: absoluteUrl(`/v/${trip.slug}#grupo`) },
      porque: `Você recebeu este e-mail porque organiza a viagem ${trip.destination} no Planvoro.`,
    },
    "chamar_grupo"
  );
}
