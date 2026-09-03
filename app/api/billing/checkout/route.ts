import { NextResponse } from "next/server";
import { criarCheckout, criarCliente, type BillingPlan } from "@/lib/abacatepay";
import { getUserFromRequest } from "@/lib/auth";
import { betaBlocksCheckoutFor } from "@/lib/beta";
import { billingOrigin } from "@/lib/billing";
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
        { error: "A beta gratis esta ativa. Voce ja pode testar o Planvoro sem pagar agora." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const plan = String(body.plan ?? "") as BillingPlan;
    if (!PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano invalido." }, { status: 400 });
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
        return NextResponse.json({ error: "Sua conta ja esta no Pro." }, { status: 400 });
      }
    } else {
      const slug = String(body.trip_slug ?? "").trim();
      if (!slug) {
        return NextResponse.json({ error: "Escolha uma viagem para liberar." }, { status: 400 });
      }

      const membership = await memberForUserInTrip(db, slug, user.id);
      if (!membership) {
        return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
      }
      if (!membership.isOrganizer) {
        return NextResponse.json(
          { error: "So o organizador pode liberar a viagem." },
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
        return NextResponse.json({ error: "Essa viagem ja esta liberada." }, { status: 400 });
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

    if (erroPedido || !pedido) throw erroPedido ?? new Error("Nao consegui registrar o pedido.");

    const customerId =
      subscription?.provider_customer_id ??
      (user.email ? await criarCliente(user.email, null) : null);

    const checkout = await criarCheckout({
      plan,
      externalId: pedido.id,
      completionUrl: `${voltarPara}?billing=success`,
      returnUrl: `${voltarPara}?billing=cancel`,
      customerId,
    });

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
    const msg = e instanceof Error ? e.message : "Erro ao iniciar pagamento.";
    // Falta de configuracao e problema nosso, nao do cliente: 503 deixa
    // isso claro no monitoramento em vez de virar mais um 500 generico.
    const status = msg.includes("ABACATEPAY_") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
