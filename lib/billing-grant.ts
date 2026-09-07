import { tripAccessExpiresAt } from "@/lib/billing";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Pagamento confirmado vira acesso liberado.
 *
 * Morava dentro da rota do webhook. Saiu de la quando a reconciliacao
 * passou a precisar da mesma coisa: existe um segundo caminho para o
 * dinheiro virar acesso, e duas copias desta funcao divergiriam — uma
 * liberando o que a outra nao libera e o pior defeito possivel aqui.
 *
 * `origem` so muda o log. Saber depois se um acesso veio da entrega
 * normal ou da rede de seguranca e o que diz se o webhook esta confiavel.
 */
export type Pedido = {
  id: string;
  plan: string;
  user_id: string;
  trip_id: string | null;
  status: string;
};

/** Um ano a partir de agora, para a assinatura anual. */
function umAnoAdiante() {
  const fim = new Date();
  fim.setFullYear(fim.getFullYear() + 1);
  return fim.toISOString();
}

/**
 * Transforma pagamento confirmado em acesso liberado.
 *
 * Cada escrita e conferida. Antes nenhuma era: a atualizacao do direito de
 * acesso foi recusada pelo banco, o erro caiu no chao, e o webhook
 * respondeu "handled" — cobranca paga, Passe trancado, e nada no log
 * dizendo por que.
 */
export async function liberarAcesso(
  pedido: Pedido,
  checkoutId: string | null,
  valor: number | null,
  origem: "webhook" | "reconciliacao" = "webhook"
) {
  const db = supabaseAdmin();
  const agora = new Date().toISOString();

  if (pedido.plan === "trip_pass" && pedido.trip_id) {
    const { data: trip } = await db
      .from("trips")
      .select("end_date")
      .eq("id", pedido.trip_id)
      .maybeSingle();

    /**
     * Libera UMA linha, a desta cobranca — nao todas as da viagem.
     *
     * A versao anterior filtrava por `trip_id` + `checkout_pending`. Como
     * cada tentativa de compra cria a sua linha, tres tentativas viraram
     * tres pendentes na mesma viagem, e o update tentou marcar as tres
     * como paga de uma vez. Existe um indice unico que permite so um
     * `paid` por viagem — e com razao, senao a mesma viagem seria vendida
     * duas vezes. O Postgres recusou a instrucao inteira.
     *
     * Pegar a mais recente resolve os dois lados: uma linha so, e a que
     * corresponde ao checkout que a pessoa acabou de pagar.
     */
    const { data: pendente } = await db
      .from("trip_entitlements")
      .select("id")
      .eq("trip_id", pedido.trip_id)
      .eq("status", "checkout_pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pendente) {
      logWarn({
        event: "abacate_sem_direito_pendente",
        route: `billing/${origem}`,
        tripId: pedido.trip_id,
      });
    } else {
      const { error } = await db
        .from("trip_entitlements")
        .update({
          status: "paid",
          provider: "abacatepay",
          provider_checkout_id: checkoutId,
          amount_total: valor,
          currency: "brl",
          paid_at: agora,
          access_expires_at: tripAccessExpiresAt(trip?.end_date),
          updated_at: agora,
        })
        .eq("id", pendente.id);

      if (error) {
        logError({ event: "abacate_direito_nao_gravado", route: `billing/${origem}`, error });
        throw error;
      }

      logInfo({
        event: "abacate_direito_liberado",
        route: `billing/${origem}`,
        tripId: pedido.trip_id,
      });
    }

    // As outras tentativas da mesma viagem nao viram nada: encerram como
    // abandonadas, senao continuam pendentes para sempre e a proxima
    // compra tropeca nelas de novo.
    await db
      .from("trip_entitlements")
      .update({ status: "expired", updated_at: agora })
      .eq("trip_id", pedido.trip_id)
      .eq("status", "checkout_pending");
  }

  if (pedido.plan === "pro_annual") {
    const { error } = await db.from("user_subscriptions").upsert(
      {
        user_id: pedido.user_id,
        status: "active",
        provider: "abacatepay",
        provider_subscription_id: checkoutId,
        current_period_end: umAnoAdiante(),
        cancel_at_period_end: false,
        updated_at: agora,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logError({ event: "abacate_assinatura_nao_gravada", route: `billing/${origem}`, error });
      throw error;
    }
  }

  const { error: erroPedido } = await db
    .from("billing_checkouts")
    .update({ status: "paid", paid_at: agora, provider_checkout_id: checkoutId })
    .eq("id", pedido.id);

  if (erroPedido) {
    logError({ event: "abacate_pedido_nao_gravado", route: `billing/${origem}`, error: erroPedido });
    throw erroPedido;
  }
}

/**
 * O corpo do webhook da AbacatePay.
 *
 * O campo do evento chama-se `type`. A documentacao e o painel mostram
 * `event`, e o que a entrega manda e `type` — foi essa diferenca que fez
 * o primeiro pagamento de verdade ser descartado em silencio. `event`
 * fica como alternativa para o dia em que eles alinharem os dois.
 */
