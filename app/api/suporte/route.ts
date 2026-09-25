import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { legalSupportEmail } from "@/lib/legal";
import { logError, logInfo } from "@/lib/logger";
import { resendClient, resendFromEmail } from "@/lib/resend";
import { absoluteUrl } from "@/lib/site";
import { SUPORTE_MAX, SUPORTE_MIN, SUPORTE_TIPOS, slugDaPagina, type SuporteTipo } from "@/lib/suporte";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveTripAccess } from "@/lib/trip-access";

/** Por pessoa (conta ou e-mail), por hora. Bastante para conversar, pouco para spam. */
const LIMITE_POR_HORA = 5;
/** Mensagens sem conta, somando todo mundo, por hora. */
const LIMITE_ANONIMO_POR_HORA = 30;

const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function texto(valor: unknown, max: number) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

/**
 * Mensagem do botao "Ajuda" (ou do formulario em /contato).
 *
 * Vai para o e-mail do suporte com o e-mail do cliente no reply-to:
 * responder no Gmail ja responde a pessoa. Junto vai o contexto que ela
 * nunca lembra de mandar — pagina, viagem, plano da viagem, aparelho.
 *
 * O e-mail de quem esta logado vem da sessao, nunca do corpo: senao
 * qualquer um mandaria mensagem "em nome" de outra conta.
 */
export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const tipo = (SUPORTE_TIPOS as readonly string[]).includes(String(body.tipo))
      ? (body.tipo as SuporteTipo)
      : "ajuda";
    const mensagem = texto(body.mensagem, SUPORTE_MAX);
    const paginaBruta = texto(body.pagina, 300);
    const pagina = paginaBruta.startsWith("/") ? paginaBruta : "";
    const dispositivo = texto(body.dispositivo, 200);
    const email = user?.email ?? texto(body.email, 254).toLowerCase();

    if (mensagem.length < SUPORTE_MIN) {
      return NextResponse.json(
        { error: `Conte um pouco mais (pelo menos ${SUPORTE_MIN} caracteres).` },
        { status: 400 }
      );
    }
    if (!EMAIL_VALIDO.test(email)) {
      return NextResponse.json(
        { error: "Informe um e-mail válido para a gente conseguir responder." },
        { status: 400 }
      );
    }

    const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString();
    const recentes = user
      ? db.from("mensagens_suporte").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      : db.from("mensagens_suporte").select("id", { count: "exact", head: true }).eq("email", email);
    const { count } = await recentes.gte("criado_em", umaHoraAtras);
    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return NextResponse.json(
        { error: "Recebemos várias mensagens suas na última hora. Aguarde nossa resposta ou chame no WhatsApp." },
        { status: 429 }
      );
    }
    if (!user) {
      const { count: anonimos } = await db
        .from("mensagens_suporte")
        .select("id", { count: "exact", head: true })
        .is("user_id", null)
        .gte("criado_em", umaHoraAtras);
      if ((anonimos ?? 0) >= LIMITE_ANONIMO_POR_HORA) {
        return NextResponse.json(
          { error: "Muitas mensagens agora. Tente de novo em alguns minutos ou chame no WhatsApp." },
          { status: 429 }
        );
      }
    }

    // Viagem so entra no contexto se a pessoa participa dela: o slug vem
    // da pagina, que o navegador manda e qualquer um pode trocar.
    const slug = slugDaPagina(pagina);
    let viagem: { destino: string; acesso: string; organizador: boolean } | null = null;
    if (user && slug) {
      const membro = await memberForUserInTrip(db, slug, user.id);
      if (membro) {
        const [{ data: trip }, acesso] = await Promise.all([
          db.from("trips").select("destination").eq("id", membro.tripId).maybeSingle(),
          resolveTripAccess(db, membro.tripId),
        ]);
        viagem = {
          destino: String(trip?.destination ?? slug),
          acesso: acesso.unlocked ? acesso.reason : "trancada (grátis)",
          organizador: membro.isOrganizer,
        };
      }
    }

    const { data: salva, error: erroSalvar } = await db
      .from("mensagens_suporte")
      .insert({
        user_id: user?.id ?? null,
        email,
        tipo,
        mensagem,
        pagina: pagina || null,
        viagem_slug: viagem ? slug : null,
        dispositivo: dispositivo || null,
      })
      .select("id")
      .single();
    if (erroSalvar) throw erroSalvar;

    const nome =
      (typeof user?.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
      email.split("@")[0];
    const rotulo = tipo === "sugestao" ? "Sugestão" : "Ajuda";
    const contexto: Array<[string, string]> = [
      ["De", `${nome} <${email}>${user ? "" : " (sem conta)"}`],
      ["Página", pagina ? absoluteUrl(pagina) : "-"],
      [
        "Viagem",
        viagem
          ? `${viagem.destino} (${slug}) · ${viagem.organizador ? "organizador" : "convidado"} · acesso: ${viagem.acesso}`
          : "-",
      ],
      ["Aparelho", dispositivo || "-"],
      ["Conta criada em", user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "-"],
    ];

    let enviado = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const { error } = await resendClient().emails.send({
          from: resendFromEmail(),
          to: [legalSupportEmail],
          replyTo: [email],
          subject: `[${rotulo}] ${mensagem.replace(/\s+/g, " ").slice(0, 70)}`,
          text: [mensagem, "", "—", ...contexto.map(([k, v]) => `${k}: ${v}`), "", "Responda este e-mail para responder o cliente."].join("\n"),
          html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#17201d">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#087a59;font-weight:700;margin:0 0 10px">${rotulo} pelo app</p>
<p style="white-space:pre-wrap;margin:0 0 18px">${escapeHtml(mensagem)}</p>
<table style="font-size:13px;color:#5d6b66;border-top:1px solid #e3e9e6;padding-top:10px">${contexto
            .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;white-space:nowrap"><b>${k}</b></td><td>${escapeHtml(v)}</td></tr>`)
            .join("")}</table>
<p style="font-size:12px;color:#84918d;margin-top:14px">Responda este e-mail para responder o cliente.</p>
</div>`,
        });
        if (error) throw new Error(error.message);
        enviado = true;
        await db.from("mensagens_suporte").update({ enviado_por_email: true }).eq("id", salva.id);
      } catch (e) {
        // A mensagem ja esta salva; o alerta de erro avisa que o e-mail falhou.
        logError({ event: "suporte_email_falhou", route: "/api/suporte", error: e });
      }
    }

    logInfo({ event: "suporte_recebido", route: "/api/suporte", tipo, logado: Boolean(user), enviado });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError({ event: "api_falhou", route: "/api/suporte", error: e });
    return NextResponse.json(
      { error: "Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp." },
      { status: 500 }
    );
  }
}
