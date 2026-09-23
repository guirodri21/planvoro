import { NextResponse } from "next/server";
import {
  emailChamarGrupo,
  emailDoUsuario,
  emailTesteAcabando,
} from "@/lib/lifecycle-email";
import { resumoDiarioDeErros } from "@/lib/alertas";
import { logError, logInfo } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HORA = 3_600_000;
const DIA = 24 * HORA;

/**
 * Lembretes diarios e resumo de erros, chamados pelo cron da Vercel (vercel.json).
 *
 * Roda uma vez por dia e cada consulta olha uma janela de exatamente 24
 * horas. E isso que evita e-mail repetido sem precisar de tabela de
 * controle: cada viagem cai na janela de "3 dias depois de criada" uma vez
 * so, e cada teste cai na janela de "acaba nas proximas 24h" uma vez so.
 *
 * Protegida pelo CRON_SECRET: a Vercel manda o segredo no cabecalho, e
 * qualquer outra chamada leva 401 — senao qualquer um dispararia e-mails
 * para os organizadores.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = supabaseAdmin();
  const agora = Date.now();
  let testes = 0;
  let grupos = 0;

  try {
    // 1. Teste gratis que acaba nas proximas 24 horas.
    const { data: trials, error: erroTrials } = await db
      .from("trip_entitlements")
      .select("purchaser_user_id, access_expires_at, trips(destination, slug)")
      .eq("status", "trial")
      .gt("access_expires_at", new Date(agora).toISOString())
      .lte("access_expires_at", new Date(agora + DIA).toISOString());
    if (erroTrials) throw erroTrials;

    for (const linha of trials ?? []) {
      const trip = linha.trips as unknown as { destination: string; slug: string } | null;
      if (!trip || !linha.purchaser_user_id) continue;
      const para = await emailDoUsuario(db, linha.purchaser_user_id as string);
      if (!para) continue;
      if (
        await emailTesteAcabando(para, {
          destination: trip.destination,
          slug: trip.slug,
          expira: linha.access_expires_at as string,
        })
      ) {
        testes += 1;
      }
    }

    // 2. Viagem de grupo criada ha 3 dias com gente faltando.
    const { data: viagens, error: erroViagens } = await db
      .from("trips")
      .select("id, slug, destination, party_size, start_date, members(user_id, is_organizer)")
      .eq("is_solo", false)
      .gte("created_at", new Date(agora - 4 * DIA).toISOString())
      .lt("created_at", new Date(agora - 3 * DIA).toISOString());
    if (erroViagens) throw erroViagens;

    const hoje = new Date(agora).toISOString().slice(0, 10);
    for (const viagem of viagens ?? []) {
      const membros = (viagem.members ?? []) as { user_id: string | null; is_organizer: boolean }[];
      const faltam = Number(viagem.party_size) - membros.length;
      // Viagem que ja comecou nao precisa mais de convite.
      if (faltam <= 0 || String(viagem.start_date) < hoje) continue;

      const organizador = membros.find((m) => m.is_organizer && m.user_id);
      if (!organizador?.user_id) continue;
      const para = await emailDoUsuario(db, organizador.user_id);
      if (!para) continue;
      if (
        await emailChamarGrupo(para, {
          destination: viagem.destination as string,
          slug: viagem.slug as string,
          faltam,
        })
      ) {
        grupos += 1;
      }
    }

    // 3. Resumo dos erros de producao das ultimas 24h. Separado: falha
    // aqui nao pode derrubar os lembretes, que ja sairam.
    let erros = 0;
    try {
      erros = await resumoDiarioDeErros();
    } catch (e) {
      logError({ event: "resumo_erros_falhou", route: "cron/lembretes", error: e });
    }

    logInfo({ event: "lembretes_enviados", route: "cron/lembretes", testes, grupos, erros });
    return NextResponse.json({ ok: true, testes, grupos, erros });
  } catch (e) {
    logError({ event: "lembretes_falharam", route: "cron/lembretes", error: e });
    return NextResponse.json({ error: "Falha nos lembretes." }, { status: 500 });
  }
}
