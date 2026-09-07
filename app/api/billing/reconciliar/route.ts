import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buscarCheckout } from "@/lib/abacatepay";
import { liberarAcesso, type Pedido } from "@/lib/billing-grant";
import { logError, logInfo, logWarn, startTimer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Rede de seguranca do pagamento.
 *
 * Hoje o unico caminho do dinheiro virar acesso e o webhook chegar. Se ele
 * falhar — rede, deploy no meio, erro transitorio — nao ha segunda chance:
 * a AbacatePay NAO reenvia sozinha, e entregas com erro ficam paradas ate
 * alguem clicar "Reenviar" no painel. Isso foi verificado em producao.
 *
 * Esta rota fecha esse buraco. Roda de tempos em tempos, pega as cobrancas
 * que estao pendentes ha um tempo, e pergunta a AbacatePay o que aconteceu
 * de verdade com cada uma. Quem foi paga, libera.
 *
 * Ela nao adivinha: usa a mesma consulta a fonte que o webhook usa antes de
 * liberar qualquer coisa. O banco do Planvoro nao sabe se o Pix caiu —
 * "pendente" e tanto webhook perdido quanto checkout abandonado, e so a
 * AbacatePay sabe a diferenca.
 */

/** Tempo antes de desconfiar. Menos que isso pega gente ainda pagando. */
const MINUTOS_DE_ESPERA = 30;

/** Teto por execucao: cada pedido e uma chamada HTTP, e a funcao tem 60s. */
const MAXIMO_POR_RODADA = 40;

/**
 * Segredo proprio, e nao o do webhook.
 *
 * Sao superficies diferentes: o do webhook viaja na URL a cada pagamento e
 * ja passou por varios lugares. Este aqui libera acesso pago direto —
 * merece um segredo que so o agendador conhece, para que vazar um nao
 * entregue o outro.
 */
function segredoConfere(recebido: string | null) {
  const esperado = process.env.PLANVORO_RECONCILIACAO_SECRET;
  if (!esperado) throw new Error("PLANVORO_RECONCILIACAO_SECRET não configurado.");
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const elapsed = startTimer();

  try {
    const url = new URL(req.url);

    // Aceita nos dois lugares: header para chamada de servidor, query para
    // agendador que so sabe montar URL.
    const recebido =
      req.headers.get("x-reconciliacao-secret") ?? url.searchParams.get("secret");

    if (!segredoConfere(recebido)) {
      logWarn({ event: "reconciliacao_nao_autorizada", route: "billing/reconciliar" });
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const db = supabaseAdmin();
    const limite = new Date(Date.now() - MINUTOS_DE_ESPERA * 60_000).toISOString();

    const { data: pendentes, error } = await db
      .from("billing_checkouts")
      .select("id, plan, user_id, trip_id, status, provider_checkout_id")
      .eq("status", "pending")
      .not("provider_checkout_id", "is", null)
      .lt("created_at", limite)
      .order("created_at", { ascending: true })
      .limit(MAXIMO_POR_RODADA);

    if (error) throw error;

    const fila = pendentes ?? [];
    let liberadas = 0;
    let abandonadas = 0;
    let seguemPendentes = 0;

    for (const pedido of fila) {
      const naFonte = await buscarCheckout(pedido.provider_checkout_id as string);

      if (!naFonte) {
        // A AbacatePay nao reconheceu a cobranca. Nao mexe: apagar aqui
        // esconderia um problema de configuracao em vez de mostrar.
        seguemPendentes += 1;
        logWarn({
          event: "reconciliacao_cobranca_desconhecida",
          route: "billing/reconciliar",
          pedidoId: pedido.id,
        });
        continue;
      }

      if (naFonte.status === "PAID") {
        /**
         * O acesso que o webhook nao entregou.
         *
         * `liberarAcesso` e a mesma funcao do webhook, e ja e idempotente:
         * marca a linha pendente daquela viagem e nada mais. Se por acaso
         * o webhook chegar depois, encontra tudo feito.
         */
        await liberarAcesso(
          pedido as Pedido,
          naFonte.id,
          naFonte.paidAmount ?? naFonte.amount,
          "reconciliacao"
        );

        liberadas += 1;
        logInfo({
          event: "reconciliacao_liberou_acesso",
          route: "billing/reconciliar",
          pedidoId: pedido.id,
          plano: pedido.plan,
        });
        continue;
      }

      // Expirada ou devolvida: encerra, senao ela e conferida para sempre a
      // cada rodada, de hora em hora, para nunca mudar de estado.
      if (["EXPIRED", "CANCELLED", "REFUNDED"].includes(naFonte.status)) {
        await db
          .from("billing_checkouts")
          .update({ status: "expired" })
          .eq("id", pedido.id);
        abandonadas += 1;
        continue;
      }

      // Ainda PENDING na fonte: a pessoa abriu o checkout e nao pagou. Nao
      // e erro nenhum, e o caso mais comum de todos.
      seguemPendentes += 1;
    }

    const resumo = {
      conferidas: fila.length,
      liberadas,
      abandonadas,
      seguem_pendentes: seguemPendentes,
      /** Verdadeiro quando a fila encheu: vale rodar de novo mais cedo. */
      truncado: fila.length === MAXIMO_POR_RODADA,
    };

    logInfo({
      event: "reconciliacao_concluida",
      route: "billing/reconciliar",
      durationMs: elapsed(),
      ...resumo,
    });

    return NextResponse.json(resumo);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na reconciliação.";
    logError({ event: "reconciliacao_falhou", route: "billing/reconciliar", error: e });

    const status = msg.includes("PLANVORO_RECONCILIACAO_SECRET") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
