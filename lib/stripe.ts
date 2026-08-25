import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Falta configurar STRIPE_SECRET_KEY para ativar pagamentos.");
  }

  if (!client) {
    client = new Stripe(key, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }

  return client;
}

export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Falta configurar STRIPE_WEBHOOK_SECRET para validar webhooks.");
  }
  return secret;
}
