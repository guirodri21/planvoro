import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { billingOrigin } from "@/lib/billing";
import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para gerenciar a assinatura." }, { status: 401 });
    }

    const { data: subscription, error } = await db
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "Nenhuma assinatura encontrada para sua conta." }, { status: 400 });
    }

    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${billingOrigin(req)}/app`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir portal de assinatura.";
    const status = msg.includes("STRIPE_SECRET_KEY") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
