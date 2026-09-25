import { NextResponse } from "next/server";
import { logError, logInfo } from "@/lib/logger";
import { mesmaCidade } from "@/lib/roteiros-publicos";
import { destinationKey, writeSampleCache } from "@/lib/sample";
import { gerarAmostra } from "@/lib/sample-gerar";
import { supabaseAdmin } from "@/lib/supabase";
import { DESTINOS_VITRINE } from "@/lib/vitrine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Quantos destinos por execucao, no maximo. */
const POR_EXECUCAO = 4;
/** Nao comeca um destino novo depois disto: cada geracao leva de 8 a 20 s. */
const PARAR_DE_COMECAR_MS = 32_000;

/**
 * Vitrine de roteiros: gera, uma vez por dia, os proximos destinos de
 * lib/vitrine.ts que ainda nao tem pagina em /roteiro.
 *
 * Aos poucos de proposito: gerar a lista inteira de uma vez estouraria o
 * tempo da funcao, e pagina nova aparecer um pouco por dia e o ritmo que
 * o Google rastreia melhor. Quando a lista acaba, a rota so confere e sai.
 *
 * Protegida pelo CRON_SECRET, como os lembretes.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const inicio = Date.now();
  const db = supabaseAdmin();

  try {
    const { data, error } = await db.from("sample_itineraries").select("destination");
    if (error) throw error;
    const cidades = new Set((data ?? []).map((l) => mesmaCidade(String(l.destination))));

    const faltam = DESTINOS_VITRINE.filter((d) => !cidades.has(mesmaCidade(d)));
    const gerados: string[] = [];
    const falhas: string[] = [];

    for (const destino of faltam) {
      if (gerados.length + falhas.length >= POR_EXECUCAO || Date.now() - inicio > PARAR_DE_COMECAR_MS) break;
      try {
        const roteiro = await gerarAmostra(destino);
        if (!roteiro.days?.length) throw new Error("roteiro sem dias");
        await writeSampleCache(db, destinationKey(destino), destino, roteiro);
        gerados.push(destino);
      } catch (e) {
        // Um destino que falha nao para os outros; volta amanha, no mesmo lugar da fila.
        falhas.push(destino);
        logError({ event: "vitrine_destino_falhou", route: "cron/vitrine", destino, error: e });
      }
    }

    const restantes = faltam.length - gerados.length;
    logInfo({ event: "vitrine_gerada", route: "cron/vitrine", gerados: gerados.length, falhas: falhas.length, restantes });
    return NextResponse.json({ ok: true, gerados, falhas, restantes });
  } catch (e) {
    logError({ event: "api_falhou", route: "cron/vitrine", error: e });
    return NextResponse.json({ error: "Falha na vitrine." }, { status: 500 });
  }
}
