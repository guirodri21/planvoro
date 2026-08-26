import { NextResponse } from "next/server";
import { logError, logInfo, startTimer } from "@/lib/logger";
import type Stripe from "stripe";
import { timestampFromSeconds } from "@/lib/billing";
import { stripeClient, stripeWebhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

function stripeId(value: string | { id?: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function tripAccessExpiresAt(endDate?: string | null) {
  const now = new Date();
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 30);

  if (!endDate) return fallback.toISOString();

  const expires = new Date(`${endDate}T23:59:59.000Z`);
  expires.setDate(expires.getDate() + 30);
  return (expires > fallback ? expires : fallback).toISOString();
}

/**
 * O preco nao vem no corpo do evento: `line_items` so existe se pedido de
 * volta a Stripe. Antes isto lia `metadata.stripe_price_id`, que ninguem
 * escrevia, e gravava nulo sempre.
 */
async function priceIdForSession(sessionId: string) {
  try {
    const stripe = stripeClient();
    const items = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    return items.data[0]?.price?.id ?? null;
  } catch {
    // Preco e dado de relatorio: nao vale derrubar a confirmacao do
    // pagamento por causa dele.
    return null;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = supabaseAdmin();
  const plan = session.metadata?.plan;
  const userId = session.metadata?.user_id;
  const customerId = stripeId(session.customer);

  if (plan === "trip_pass") {
    const tripId = session.metadata?.trip_id;
    if (!tripId) return;

    const { data: trip } = await db.from("trips").select("end_date").eq("id", tripId).maybeSingle();

    await db
      .from("trip_entitlements")
      .update({
        status: "paid",
        stripe_customer_id: customerId,
        stripe_payment_intent_id: stripeId(session.payment_intent),
        stripe_price_id: await priceIdForSession(session.id),
        amount_total: session.amount_total,
        currency: session.currency,
        paid_at: new Date().toISOString(),
        access_expires_at: tripAccessExpiresAt(trip?.end_date),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (plan === "pro_annual" && userId) {
    await db.from("user_subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeId(session.subscription),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  if (session.metadata?.plan !== "trip_pass") return;

  const db = supabaseAdmin();
  await db
    .from("trip_entitlements")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "checkout_pending");
}

async function handleSubscription(subscription: Stripe.Subscription) {
  const db = supabaseAdmin();
  let userId = subscription.metadata?.user_id ?? null;

  if (!userId) {
    const { data } = await db
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }

  if (!userId) return;

  const firstItem = subscription.items.data[0];

  await db.from("user_subscriptions").upsert(
    {
      user_id: userId,
      status: subscription.status,
      stripe_customer_id: stripeId(subscription.customer),
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price?.id ?? null,
      current_period_end: timestampFromSeconds(firstItem?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function POST(req: Request) {
  const elapsed = startTimer();
  let eventType = "unknown";

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Webhook sem assinatura." }, { status: 400 });
    }

    const stripe = stripeClient();
    const event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      stripeWebhookSecret()
    );

    eventType = event.type;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    logInfo({
      event: "stripe_webhook_handled",
      route: "billing/webhook",
      stripeEvent: eventType,
      durationMs: elapsed(),
    });

    return NextResponse.json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no webhook do Stripe.";
    logError({
      event: "stripe_webhook_failed",
      route: "billing/webhook",
      stripeEvent: eventType,
      durationMs: elapsed(),
      error: e,
    });
    const status = msg.includes("STRIPE_") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
