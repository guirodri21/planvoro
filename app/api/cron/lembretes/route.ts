import { NextResponse } from "next/server";
import {
  emailBoasVindas,
  emailChamarGrupo,
  emailDoUsuario,
  emailPosViagemConvidado,
  emailTesteAcabando,
} from "@/lib/lifecycle-email";
import { userDisplayName } from "@/lib/user-name";
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

    // 3 e 4 ficam cada um no seu try: um erro aqui nao pode impedir os
    // outros e-mails do dia.
    let boasVindas = 0;
    try {
      boasVindas = await enviarBoasVindas(db, agora);
    } catch (e) {
      logError({ event: "boas_vindas_falharam", route: "cron/lembretes", error: e });
    }

    let posViagem = 0;
    try {
      posViagem = await enviarPosViagem(db, agora);
    } catch (e) {
      logError({ event: "pos_viagem_falhou", route: "cron/lembretes", error: e });
    }

    // 5. Resumo dos erros de producao das ultimas 24h. Separado: falha
    // aqui nao pode derrubar os lembretes, que ja sairam.
    let erros = 0;
    try {
      erros = await resumoDiarioDeErros();
    } catch (e) {
      logError({ event: "resumo_erros_falhou", route: "cron/lembretes", error: e });
    }

    logInfo({ event: "lembretes_enviados", route: "cron/lembretes", testes, grupos, boasVindas, posViagem, erros });
    return NextResponse.json({ ok: true, testes, grupos, boasVindas, posViagem, erros });
  } catch (e) {
    logError({ event: "lembretes_falharam", route: "cron/lembretes", error: e });
    return NextResponse.json({ error: "Falha nos lembretes." }, { status: 500 });
  }
}

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * 3. Conta criada ha 1 dia (etapa 1) ou 3 dias (etapa 2) sem nenhuma
 * viagem — nem organizada, nem como convidado. Mesma janela de 24h dos
 * outros lembretes: cada conta cai em cada etapa uma vez so.
 */
async function enviarBoasVindas(db: Db, agora: number) {
  const etapas = [
    { etapa: 1 as const, de: agora - 2 * DIA, ate: agora - DIA },
    { etapa: 2 as const, de: agora - 4 * DIA, ate: agora - 3 * DIA },
  ];

  const candidatos: Array<{ id: string; email: string; nome: string; etapa: 1 | 2 }> = [];
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (!u.email || !u.email_confirmed_at) continue;
      const criado = new Date(u.created_at).getTime();
      const alvo = etapas.find((e) => criado >= e.de && criado < e.ate);
      if (alvo) candidatos.push({ id: u.id, email: u.email, nome: userDisplayName(u), etapa: alvo.etapa });
    }
    if (data.users.length < 1000) break;
  }
  if (!candidatos.length) return 0;

  const { data: participacoes, error } = await db
    .from("members")
    .select("user_id")
    .in("user_id", candidatos.map((c) => c.id));
  if (error) throw error;
  const comViagem = new Set((participacoes ?? []).map((m) => m.user_id as string));

  let enviados = 0;
  for (const c of candidatos) {
    if (comViagem.has(c.id)) continue;
    if (await emailBoasVindas(c.email, { nome: c.nome.split(" ")[0], etapa: c.etapa })) enviados += 1;
  }
  return enviados;
}

/**
 * 4. Viagem que terminou ontem: convite para os convidados organizarem a
 * proxima. Quem ja organiza alguma viagem fica de fora — esse ja sabe.
 */
async function enviarPosViagem(db: Db, agora: number) {
  const ontem = new Date(agora - DIA).toISOString().slice(0, 10);
  const { data: viagens, error } = await db
    .from("trips")
    .select("destination, members(user_id, is_organizer, name)")
    .eq("end_date", ontem)
    .eq("is_solo", false);
  if (error) throw error;

  let enviados = 0;
  const avisados = new Set<string>();
  for (const viagem of viagens ?? []) {
    const convidados = ((viagem.members ?? []) as { user_id: string | null; is_organizer: boolean; name: string }[])
      .filter((m) => !m.is_organizer && m.user_id && !avisados.has(m.user_id));
    if (!convidados.length) continue;

    const { data: organizam } = await db
      .from("members")
      .select("user_id")
      .eq("is_organizer", true)
      .in("user_id", convidados.map((m) => m.user_id as string));
    const jaOrganizam = new Set((organizam ?? []).map((m) => m.user_id as string));

    for (const m of convidados) {
      const userId = m.user_id as string;
      avisados.add(userId);
      if (jaOrganizam.has(userId)) continue;
      const para = await emailDoUsuario(db, userId);
      if (!para) continue;
      if (
        await emailPosViagemConvidado(para, {
          nome: (m.name || "").split(" ")[0] || "viajante",
          destino: viagem.destination as string,
        })
      ) {
        enviados += 1;
      }
    }
  }
  return enviados;
}
