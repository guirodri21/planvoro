import { after, NextResponse } from "next/server";
import { processarEmailDoCofre } from "@/lib/cofre-email";
import { logError } from "@/lib/logger";
import { resendClient } from "@/lib/resend";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook do Resend para e-mails recebidos (evento `email.received`).
 *
 * Confere a assinatura (RESEND_WEBHOOK_SECRET), registra o e-mail e
 * responde na hora; a leitura pela IA roda em `after`, depois da
 * resposta. Se o Resend mandar o mesmo e-mail de novo, a chave primaria
 * de `cofre_emails` barra a segunda vez.
 */
export async function POST(req: Request) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ error: "Não configurado." }, { status: 404 });

  const corpo = await req.text();
  let evento: { type: string; data: Record<string, unknown> };
  try {
    evento = resendClient().webhooks.verify({
      payload: corpo,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: segredo,
    }) as unknown as { type: string; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  if (evento.type !== "email.received") return NextResponse.json({ ok: true });

  const dados = evento.data as {
    email_id: string;
    from: string;
    to: string[];
    received_for?: string[];
    subject: string;
  };

  const db = supabaseAdmin();
  const { error } = await db.from("cofre_emails").insert({
    email_id: dados.email_id,
    remetente: String(dados.from ?? "").slice(0, 200),
    assunto: String(dados.subject ?? "").slice(0, 200),
  });
  if (error) {
    // 23505: ja recebido antes (nova tentativa do Resend). Nada a fazer.
    if (error.code === "23505") return NextResponse.json({ ok: true, repetido: true });
    logError({ event: "api_falhou", route: "/api/cofre/email", error });
    return NextResponse.json({ error: "Falha ao registrar." }, { status: 500 });
  }

  after(async () => {
    try {
      await processarEmailDoCofre(db, dados);
    } catch (e) {
      await db.from("cofre_emails").update({ situacao: "falhou" }).eq("email_id", dados.email_id);
      logError({ event: "cofre_email_falhou", route: "/api/cofre/email", error: e });
    }
  });

  return NextResponse.json({ ok: true });
}
