import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getUserFromRequest } from "@/lib/auth";
import { betaBlocksCheckoutFor } from "@/lib/beta";
import { billingOrigin, checkoutMode, lineItemForPlan, type BillingPlan } from "@/lib/billing";
import { memberForUserInTrip } from "@/lib/guards";
import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

const PLANS: BillingPlan[] = ["trip_pass", "pro_annual"];

function stripeId(value: string | { id?: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para assinar." }, { status: 401 });
    }

    if (betaBlocksCheckoutFor(user.email)) {
      return NextResponse.json(
        {
          error:
            "A beta gratis esta ativa. Voce ja pode testar o Planvoro sem pagar agora.",
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const plan = String(body.plan ?? "") as BillingPlan;
    if (!PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano invalido." }, { status: 400 });
    }

    const origin = billingOrigin(req);
    const stripe = stripeClient();

    async function stripeCustomerAindaExiste(id: string) {
      try {
        const cliente = await stripe.customers.retrieve(id);
        return "deleted" in cliente && cliente.deleted ? null : id;
      } catch {
        return null;
      }
    }
    const metadata: Record<string, string> = {
      plan,
      user_id: user.id,
    };
    let tripId: string | null = null;
    let successUrl = `${origin}/app?billing=success`;
    let cancelUrl = `${origin}/app?billing=cancel`;

    const { data: subscription } = await db
      .from("user_subscriptions")
      .select("status, stripe_customer_id, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const savedCustomerId = stripeId(subscription?.stripe_customer_id);

    /**
     * Reusar o cliente da Stripe so vale se ele ainda existir la.
     *
     * Cliente apagado no painel deixa o id gravado aqui apontando para o
     * nada, e o checkout passa a responder "No such customer" para sempre
     * — a pessoa nunca mais consegue assinar, e o erro nao diz o que fazer.
     * Conferir antes custa uma chamada e transforma um beco sem saida em
     * um cliente novo.
     */
    const customerId = savedCustomerId
      ? await stripeCustomerAindaExiste(savedCustomerId)
      : null;

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
        return NextResponse.json({ error: "So o organizador pode liberar a viagem." }, { status: 403 });
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
      metadata.trip_id = tripId;
      metadata.trip_slug = slug;
      successUrl = `${origin}/v/${slug}?billing=success`;
      cancelUrl = `${origin}/v/${slug}?billing=cancel`;
    }

    if (savedCustomerId && !customerId) {
      await db
        .from("user_subscriptions")
        .update({ stripe_customer_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: checkoutMode(plan),
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email ?? undefined,
      client_reference_id: plan === "trip_pass" ? tripId ?? user.id : user.id,
      line_items: [lineItemForPlan(plan)],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data:
        plan === "pro_annual"
          ? {
              metadata,
            }
          : undefined,
      payment_intent_data:
        plan === "trip_pass"
          ? {
              metadata,
            }
          : undefined,
    });

    if (!session.url) {
      throw new Error("O Stripe nao retornou uma URL de checkout.");
    }

    if (plan === "trip_pass" && tripId) {
      const { error } = await db.from("trip_entitlements").insert({
        trip_id: tripId,
        purchaser_user_id: user.id,
        plan: "trip_pass",
        status: "checkout_pending",
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeId(session.customer),
      });
      if (error) throw error;
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao iniciar pagamento.";
    const status = msg.includes("STRIPE_SECRET_KEY") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
