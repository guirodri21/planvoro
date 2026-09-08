import { NextResponse } from "next/server";
import { paraReais, taxasDoDia } from "@/lib/fx";
import { generateItinerary } from "@/lib/generate";
import { logError, logInfo, logWarn, startTimer } from "@/lib/logger";
import {
  SAMPLE_DAYS,
  checkSampleAllowance,
  clientIp,
  destinationKey,
  hashIp,
  readSampleCache,
  recordSampleRequest,
  sampleDates,
  writeSampleCache,
} from "@/lib/sample";
import { supabaseAdmin } from "@/lib/supabase";
import type { Member, Preference, Trip } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_DESTINATION = 60;

/**
 * Amostra de roteiro sem conta.
 *
 * A unica rota do produto que chama modelo sem saber quem esta pedindo.
 * O controle de custo vive em lib/sample.ts; aqui fica so o fluxo.
 *
 * Nada e gravado como viagem: a amostra existe para a pessoa ver o
 * formato e decidir se cria conta. Criar viagem de verdade sem
 * autenticacao encheria o banco de lixo que ninguem reivindica.
 */
export async function POST(req: Request) {
  const elapsed = startTimer();

  try {
    const body = await req.json().catch(() => ({}));
    const destination = String(body.destination ?? "").trim().slice(0, MAX_DESTINATION);

    if (destination.length < 3) {
      return NextResponse.json({ error: "Diga para onde você quer ir." }, { status: 400 });
    }

    const key = destinationKey(destination);
    if (!key) {
      return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const ipHash = hashIp(clientIp(req));

    const allowance = await checkSampleAllowance(db, ipHash);
    if (!allowance.allowed) {
      logWarn({ event: "sample_rate_limited", route: "sample", destinationKey: key });
      return NextResponse.json({ error: allowance.message }, { status: 429 });
    }

    const cached = await readSampleCache(db, key);
    if (cached) {
      await recordSampleRequest(db, ipHash, key, false);
      logInfo({
        event: "sample_served",
        route: "sample",
        destinationKey: key,
        fromCache: true,
        durationMs: elapsed(),
      });

      return NextResponse.json({
        destination: cached.destination,
        itinerary: cached.payload,
        days: SAMPLE_DAYS,
      });
    }

    if (!allowance.mayGenerate) {
      logWarn({ event: "sample_generation_capped", route: "sample", destinationKey: key });
      return NextResponse.json(
        {
          error:
            /**
             * A mensagem antiga dizia "muita gente experimentando agora,
             * tente um destino mais conhecido". Duas mentiras numa frase:
             * nao ha gente nenhuma, e o destino nao tem nada a ver — o
             * que acabou foi a cota de geracoes gratuitas por visitante.
             *
             * Mandar trocar de destino faz a pessoa tentar outro, falhar
             * de novo e concluir que o produto nao funciona.
             */
            "Você já gerou o máximo de amostras gratuitas de hoje. Crie uma conta grátis para montar o roteiro completo — lá o limite é bem maior.",
        },
        { status: 429 }
      );
    }

    const dates = sampleDates();
    /**
     * Configuracao propria da amostra.
     *
     * Sao dois dias, sem ideias do grupo e sem votacao — cabe numa fracao
     * do orcamento de um roteiro completo. Medido em producao, a mesma
     * chamada com a configuracao cheia levava de 29 a 42 segundos, e
     * quem esta decidindo se cria conta nao espera isso de pe.
     */
    const generated = await generateItinerary(
      buildSampleTrip(destination, dates),
      SAMPLE_MEMBERS,
      SAMPLE_PREFS,
      [],
      [],
      dates,
      { thinkingLevel: "MINIMAL", maxOutputTokens: 2500 }
    );

    /**
     * A amostra usa o mesmo gerador, entao converte do mesmo jeito.
     *
     * Sem isto a primeira tela que alguem ve — a unica sem conta — sairia
     * com custo vazio, porque a IA nao devolve mais valor em real.
     */
    const taxas = await taxasDoDia();
    for (const day of generated.days ?? []) {
      for (const item of day.items ?? []) {
        item.cost_estimate =
          paraReais(item.cost_local ?? 0, item.cost_currency ?? "BRL", taxas) ?? 0;
      }
    }

    await writeSampleCache(db, key, destination, generated);
    await recordSampleRequest(db, ipHash, key, true);

    logInfo({
      event: "sample_served",
      route: "sample",
      destinationKey: key,
      fromCache: false,
      days: generated.days?.length ?? 0,
      durationMs: elapsed(),
    });

    return NextResponse.json({ destination, itinerary: generated, days: SAMPLE_DAYS });
  } catch (e) {
    logError({ event: "sample_failed", route: "sample", durationMs: elapsed(), error: e });

    /**
     * Quando o motivo e o modelo sobrecarregado, dizer isso.
     *
     * "Nao consegui montar a amostra" faz a pessoa achar que o destino
     * dela e o problema — e ela tenta outro, que falha igual, e vai
     * embora. Saber que a falha e temporaria e nossa, e nao dela, e o que
     * faz alguem esperar um minuto e voltar.
     *
     * So esta mensagem passa: erro de banco ou de codigo continua
     * generico, porque detalhe interno em tela publica nao ajuda ninguem.
     */
    const sobrecarga =
      e instanceof Error && e.message.includes("sobrecarregado")
        ? e.message
        : null;

    return NextResponse.json(
      {
        error:
          sobrecarga ??
          "Não consegui montar a amostra agora. Tente de novo em instantes.",
      },
      { status: 500 }
    );
  }
}

/**
 * Viagem ficticia so para alimentar o gerador.
 *
 * Um grupo pequeno com interesses variados, que e o caso mais comum e o
 * que melhor mostra o que o Planvoro faz de diferente: equilibrar gente
 * que quer coisas diferentes.
 */
function buildSampleTrip(destination: string, dates: string[]): Trip {
  return {
    id: "sample",
    slug: "sample",
    destination,
    start_date: dates[0],
    end_date: dates[dates.length - 1],
    party_size: 4,
    budget_band: "Confortável",
    styles: ["Gastronomia", "Cultura", "Natureza"],
    is_solo: false,
    is_public: false,
  };
}

const SAMPLE_MEMBERS: Member[] = [
  { id: "s1", trip_id: "sample", name: "Ana", is_organizer: true, color: "#4ade80" },
  { id: "s2", trip_id: "sample", name: "Bruno", is_organizer: false, color: "#22d3ee" },
];

const SAMPLE_PREFS: Record<string, Preference> = {
  s1: {
    id: "p1",
    member_id: "s1",
    interests: ["Gastronomia", "Cultura"],
    restrictions: [],
    daily_budget: null,
    present_from: null,
    present_to: null,
  },
  s2: {
    id: "p2",
    member_id: "s2",
    interests: ["Natureza", "Caminhada"],
    restrictions: ["Vegetariano"],
    daily_budget: null,
    present_from: null,
    present_to: null,
  },
};
