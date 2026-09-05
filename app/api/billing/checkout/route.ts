import { NextResponse } from "next/server";
import { criarCheckout, criarCliente, type BillingPlan } from "@/lib/abacatepay";
import { getUserFromRequest } from "@/lib/auth";
import { betaBlocksCheckoutFor } from "@/lib/beta";
import { billingOrigin } from "@/lib/billing";
import { traduzErroPagamento } from "@/lib/erros";
import { logError } from "@/lib/logger";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

const PLANS: BillingPlan[] = ["trip_pass", "pro_annual"];

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para assinar." }, { status: 401 });
    }

    if (betaBlocksCheckoutFor(user.email)) {
      return NextResponse.json(
        { error: "A beta grátis está ativa. Você já pode testar o Planvoro sem pagar agora." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const plan = String(body.plan ?? "") as BillingPlan;
    if (!PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    const origin = billingOrigin(req);
    let tripId: string | null = null;
    let voltarPara = `${origin}/app`;

    const { data: subscription } = await db
      .from("user_subscriptions")
      .select("status, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (plan === "pro_annual") {
      if (["active", "trialing"].includes(subscription?.status ?? "")) {
        return NextResponse.json({ error: "Sua conta já está no Pro." }, { status: 400 });
      }
    } else {
      const slug = String(body.trip_slug ?? "").trim();
      if (!slug) {
        return NextResponse.json({ error: "Escolha uma viagem para liberar." }, { status: 400 });
      }

      const membership = await memberForUserInTrip(db, slug, user.id);
      if (!membership) {
        return NextResponse.json({ error: "Você não participa desta viagem." }, { status: 403 });
      }
      if (!membership.isOrganizer) {
        return NextResponse.json(
          { error: "Só o organizador pode liberar a viagem." },
          { status: 403 }
        );
      }

      const { data: paid } = await db
        .from("trip_entitlements")
        .select("id")
        .eq("trip_id", membership.tripId)
        .eq("status", "paid")
        .maybeSingle();
      if (paid) {
        return NextResponse.json({ error: "Essa viagem já está liberada." }, { status: 400 });
      }

      tripId = membership.tripId;
      voltarPara = `${origin}/v/${slug}`;
    }

    /**
     * A linha nasce antes do checkout.
     *
     * O id dela e a unica coisa que viaja ate a AbacatePay e volta no
     * webhook (`externalId`). Mandar user_id e trip_id por ali seria mais
     * curto, mas colocaria identificadores internos numa carga que passa
     * por terceiro — e obrigaria a confiar no que voltasse. Assim o
     * webhook so traz um ponteiro, e quem responde o que ele libera e o
     * nosso banco.
     */
    const { data: pedido, error: erroPedido } = await db
      .from("billing_checkouts")
      .insert({ plan, user_id: user.id, trip_id: tripId, provider: "abacatepay" })
      .select("id")
      .single();

    if (erroPedido || !pedido) throw erroPedido ?? new Error("Não consegui registrar o pedido.");

    const customerId =
      subscription?.provider_customer_id ??
      (user.email ? await criarCliente(user.email, null) : null);

    /**
     * Se a AbacatePay recusar, a linha nao pode ficar para tras.
     *
     * O pedido nasce antes da chamada porque o id dele e o que viaja como
     * `externalId`. Quando a chamada falha — foi o que aconteceu no
     * primeiro checkout de verdade, recusado por cartao nao liberado — a
     * linha ficava `pending` para sempre. Tres tentativas frustradas
     * viraram tres registros que nunca vao virar pagamento, e que
     * contariam como abandono em qualquer relatorio de conversao.
     */
    let checkout;
    try {
      checkout = await criarCheckout({
        plan,
        externalId: pedido.id,
        completionUrl: `${voltarPara}?billing=success`,
        returnUrl: `${voltarPara}?billing=cancel`,
        customerId,
      });
    } catch (erro) {
      await db.from("billing_checkouts").delete().eq("id", pedido.id);
      throw erro;
    }

    await db
      .from("billing_checkouts")
      .update({ provider_checkout_id: checkout.id, amount: checkout.amount })
      .eq("id", pedido.id);

    if (plan === "trip_pass" && tripId) {
      const { error } = await db.from("trip_entitlements").insert({
        trip_id: tripId,
        purchaser_user_id: user.id,
        plan: "trip_pass",
        status: "checkout_pending",
        provider: "abacatepay",
        provider_checkout_id: checkout.id,
      });
      if (error) throw error;
    }

    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const bruto = e instanceof Error ? e.message : "Erro ao iniciar pagamento.";

    /**
     * O texto do provedor fica no log, nunca na tela.
     *
     * O primeiro checkout de verdade morreu com `CARD is not available for
     * this store` aparecendo cru para o cliente: ingles, no meio da compra,
     * falando de uma configuracao de loja que ele nao tem como resolver.
     * Aqui dentro esse texto e exatamente o que precisamos para depurar; do
     * outro lado ele so assusta.
     */
    logError({ event: "checkout_falhou", route: "billing/checkout", error: e });

    // Falta de configuracao e problema nosso, nao do cliente: 503 deixa
    // isso claro no monitoramento em vez de virar mais um 500 generico.
    const status = bruto.includes("ABACATEPAY_") ? 503 : 500;
    return NextResponse.json({ error: traduzErroPagamento(bruto) }, { status });
  }
}
