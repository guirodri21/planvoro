import type Stripe from "stripe";

export type BillingPlan = "trip_pass" | "pro_annual";

export const BILLING_COPY: Record<
  BillingPlan,
  {
    label: string;
    description: string;
    amount: number;
    priceEnv: string;
    alternatePriceEnv?: string;
  }
> = {
  trip_pass: {
    label: "Planvoro por viagem",
    description: "Libera grupo ilimitado, roteiros ilimitados, votos, comentários e gastos para uma viagem.",
    amount: 7900,
    priceEnv: "STRIPE_PRICE_TRIP_PASS",
    alternatePriceEnv: "STRIPE_TRIP_PASS_PRICE_ID",
  },
  pro_annual: {
    label: "Planvoro Pro anual",
    description: "Viagens ilimitadas por um ano para quem viaja bastante.",
    amount: 14900,
    priceEnv: "STRIPE_PRICE_PRO_ANNUAL",
    alternatePriceEnv: "STRIPE_PRO_ANNUAL_PRICE_ID",
  },
};

export function billingOrigin(req: Request) {
  return new URL(req.url).origin;
}

export function checkoutMode(plan: BillingPlan): Stripe.Checkout.SessionCreateParams.Mode {
  return plan === "pro_annual" ? "subscription" : "payment";
}

export function lineItemForPlan(plan: BillingPlan): Stripe.Checkout.SessionCreateParams.LineItem {
  const copy = BILLING_COPY[plan];
  const priceId =
    process.env[copy.priceEnv] ??
    (copy.alternatePriceEnv ? process.env[copy.alternatePriceEnv] : undefined);

  if (priceId) {
    return { price: priceId, quantity: 1 };
  }

  return {
    quantity: 1,
    price_data: {
      currency: "brl",
      unit_amount: copy.amount,
      product_data: {
        name: copy.label,
        description: copy.description,
      },
      ...(plan === "pro_annual" ? { recurring: { interval: "year" as const } } : {}),
    },
  };
}

export function isProStatusActive(status?: string | null, currentPeriodEnd?: string | null) {
  if (!status || !["active", "trialing"].includes(status)) return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

export function isTripEntitlementActive(status?: string | null, accessExpiresAt?: string | null) {
  if (status !== "paid") return false;
  if (!accessExpiresAt) return true;
  return new Date(accessExpiresAt).getTime() > Date.now();
}

export function timestampFromSeconds(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}
