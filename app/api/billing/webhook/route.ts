import { NextResponse } from "next/server";
import { assinaturaConfere, webhookSecretConfere } from "@/lib/abacatepay";
import { tripAccessExpiresAt } from "@/lib/billing";
import { logError, logInfo, startTimer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

type Pedido = {
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

async function liberarAcesso(pedido: Pedido, checkoutId: string | null, valor: number | null) {
  const db = supabaseAdmin();
  const agora = new Date().toISOString();

  if (pedido.plan === "trip_pass" && pedido.trip_id) {
    const { data: trip } = await db
      .from("trips")
      .select("end_date")
      .eq("id", pedido.trip_id)
      .maybeSingle();

    await db
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
      .eq("trip_id", pedido.trip_id)
      .eq("status", "checkout_pending");
  }

  if (pedido.plan === "pro_annual") {
    await db.from("user_subscriptions").upsert(
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
  }

  await db
    .from("billing_checkouts")
    .update({ status: "paid", paid_at: agora, provider_checkout_id: checkoutId })
    .eq("id", pedido.id);
}

export async function POST(req: Request) {
  const elapsed = startTimer();
  let evento = "unknown";

  try {
    const url = new URL(req.url);
    const raw = await req.text();

    /**
     * Duas conferencias, com pesos bem diferentes.
     *
     * O segredo da query string e so nosso, e e o que de fato autentica a
     * chamada. A assinatura HMAC usa uma chave publicada na documentacao
     * da AbacatePay, entao qualquer pessoa consegue forjar uma valida —
     * ela serve para detectar corpo corrompido no caminho, nao remetente
     * falso. Por isso as duas sao exigidas, e nunca uma no lugar da outra.
     */
    if (!webhookSecretConfere(url.searchParams.get("webhookSecret"))) {
      return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    }

    if (!assinaturaConfere(raw, req.headers.get("x-webhook-signature"))) {
      return NextResponse.json({ error: "Assinatura invalida." }, { status: 401 });
    }

    /**
     * Leitura solta de proposito.
     *
     * A propria AbacatePay recomenda nao validar o payload inteiro: um
     * campo novo do lado deles nao pode derrubar a confirmacao de um
     * pagamento que ja aconteceu.
     */
    const payload = JSON.parse(raw) as {
      event?: string;
      data?: {
        checkout?: { id?: string; externalId?: string; paidAmount?: number; amount?: number };
      };
    };

    evento = payload.event ?? "unknown";

    if (evento !== "checkout.completed" && evento !== "transparent.completed") {
      return NextResponse.json({ received: true });
    }

    const checkout = payload.data?.checkout;
    const externalId = checkout?.externalId;
    if (!externalId) {
      return NextResponse.json({ received: true });
    }

    const db = supabaseAdmin();
    const { data: pedido } = await db
      .from("billing_checkouts")
      .select("id, plan, user_id, trip_id, status")
      .eq("id", externalId)
      .maybeSingle<Pedido>();

    if (!pedido) {
      // Cobranca que nao nasceu aqui. Responder 200 encerra a retentativa
      // do provedor; um 4xx faria ele insistir por dias sem chance de mudar.
      logInfo({
        event: "abacate_webhook_sem_pedido",
        route: "billing/webhook",
        abacateEvent: evento,
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    // Idempotencia: o provedor reenvia o mesmo evento ate receber 200, e
    // liberar duas vezes reescreveria a validade do acesso ja concedido.
    if (pedido.status !== "paid") {
      await liberarAcesso(
        pedido,
        checkout?.id ?? null,
        checkout?.paidAmount ?? checkout?.amount ?? null
      );
    }

    logInfo({
      event: "abacate_webhook_handled",
      route: "billing/webhook",
      abacateEvent: evento,
      durationMs: elapsed(),
    });

    return NextResponse.json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no webhook da AbacatePay.";
    logError({
      event: "abacate_webhook_failed",
      route: "billing/webhook",
      abacateEvent: evento,
      durationMs: elapsed(),
      error: e,
    });
    const status = msg.includes("ABACATEPAY_") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
