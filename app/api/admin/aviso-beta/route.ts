import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailFimDaBeta } from "@/lib/lifecycle-email";
import { logError, logInfo } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveTripAccess } from "@/lib/trip-access";
import { userDisplayName } from "@/lib/user-name";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A cobranca foi ligada neste momento; viagem criada antes e "da beta". */
const FIM_DA_BETA = "2026-09-23T13:30:00Z";
const MARCA = "aviso_beta_enviado";

/**
 * Aviso unico de fim da beta. Temporaria: sai do codigo depois do envio.
 *
 * GET ?token=...&modo=simular|enviar. O token vem na query porque a
 * chamada e feita uma vez, a mao, por uma ferramenta que nao manda
 * cabecalho; sem AVISO_BETA_TOKEN configurado, a rota responde 404.
 *
 * Recebe: organizador de viagem criada na beta, que ainda nao acabou e
 * esta trancada (sem Passe, teste ou Pro). Um e-mail por pessoa, sobre a
 * viagem mais proxima. Quem ja recebeu fica marcado no app_metadata e
 * nao recebe de novo, mesmo que a rota rode duas vezes.
 */
export async function GET(req: Request) {
  const segredo = process.env.AVISO_BETA_TOKEN;
  if (!segredo) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const url = new URL(req.url);
  const token = Buffer.from(url.searchParams.get("token") ?? "");
  const esperado = Buffer.from(segredo);
  if (token.length !== esperado.length || !timingSafeEqual(token, esperado)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const enviarDeVerdade = url.searchParams.get("modo") === "enviar";

  const db = supabaseAdmin();
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    const { data: viagens, error } = await db
      .from("trips")
      .select("id, slug, destination, start_date, members(user_id, is_organizer)")
      .lt("created_at", FIM_DA_BETA)
      .gte("end_date", hoje)
      .order("start_date", { ascending: true });
    if (error) throw error;

    // Viagem mais proxima de cada organizador (a lista ja vem por data).
    const porUsuario = new Map<string, { destino: string; slug: string }>();
    for (const viagem of viagens ?? []) {
      const membros = (viagem.members ?? []) as { user_id: string | null; is_organizer: boolean }[];
      const organizadores = membros.filter((m) => m.is_organizer && m.user_id).map((m) => m.user_id as string);
      if (!organizadores.length || organizadores.every((id) => porUsuario.has(id))) continue;
      if ((await resolveTripAccess(db, viagem.id as string)).unlocked) continue;
      for (const id of organizadores) {
        if (!porUsuario.has(id)) {
          porUsuario.set(id, { destino: viagem.destination as string, slug: viagem.slug as string });
        }
      }
    }

    let jaAvisados = 0;
    let semEmail = 0;
    let enviados = 0;
    let falhas = 0;
    const amostra: string[] = [];

    for (const [userId, viagem] of porUsuario) {
      const { data } = await db.auth.admin.getUserById(userId);
      const user = data.user;
      if (!user?.email || !user.email_confirmed_at) {
        semEmail += 1;
        continue;
      }
      if (user.app_metadata?.[MARCA]) {
        jaAvisados += 1;
        continue;
      }
      if (amostra.length < 5) amostra.push(viagem.destino);
      if (!enviarDeVerdade) continue;

      const ok = await emailFimDaBeta(user.email, {
        nome: userDisplayName(user),
        destino: viagem.destino,
        slug: viagem.slug,
      });
      if (!ok) {
        falhas += 1;
        continue;
      }
      enviados += 1;
      await db.auth.admin.updateUserById(userId, {
        app_metadata: { ...user.app_metadata, [MARCA]: new Date().toISOString() },
      });
      // Folga para o limite de envio do Resend.
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const resumo = {
      modo: enviarDeVerdade ? "enviar" : "simular",
      destinatarios: porUsuario.size - jaAvisados - semEmail,
      ja_avisados: jaAvisados,
      sem_email_confirmado: semEmail,
      enviados,
      falhas,
      amostra_destinos: amostra,
    };
    logInfo({ event: "aviso_beta", route: "admin/aviso-beta", ...resumo });
    return NextResponse.json(resumo);
  } catch (e) {
    logError({ event: "aviso_beta_falhou", route: "admin/aviso-beta", error: e });
    return NextResponse.json({ error: "Falha no aviso." }, { status: 500 });
  }
}
