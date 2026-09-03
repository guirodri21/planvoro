import type { BillingPlan } from "@/lib/abacatepay";

export type { BillingPlan };

export const BILLING_COPY: Record<
  BillingPlan,
  { label: string; description: string; amount: number }
> = {
  trip_pass: {
    label: "Passe de viagem",
    description:
      "Libera uma viagem inteira para o grupo todo. So o organizador paga. Vale ate 90 dias depois da volta.",
    amount: 2900,
  },
  pro_annual: {
    label: "Planvoro Pro anual",
    description: "Viagens ilimitadas por um ano, com importacao de reservas e historico completo.",
    amount: 7900,
  },
};

export function billingOrigin(req: Request) {
  return new URL(req.url).origin;
}

/**
 * Assinatura vale enquanto o periodo pago nao terminou.
 *
 * O provedor avisa quando a assinatura e cancelada, mas nao manda nada no
 * dia em que o periodo simplesmente expira. Sem a comparacao de data, uma
 * assinatura vencida em janeiro continuaria "ativa" para sempre.
 */
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

/**
 * O passe vale ate 90 dias depois do fim da viagem.
 *
 * Acerto de contas, comprovante e recibo continuam sendo consultados
 * depois da volta. Cortar o acesso no dia do desembarque transformaria o
 * Cofre em resgate justo na hora em que ele mais e aberto.
 */
const TRIP_PASS_GRACE_DAYS = 90;

export function tripAccessExpiresAt(endDate?: string | null) {
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + TRIP_PASS_GRACE_DAYS);

  if (!endDate) return fallback.toISOString();

  const expires = new Date(`${endDate}T23:59:59.000Z`);
  expires.setDate(expires.getDate() + TRIP_PASS_GRACE_DAYS);

  // Viagem que ja acabou nao pode gerar acesso curto ou vencido: quem
  // pagou hoje tem os 90 dias contados a partir de hoje.
  return (expires > fallback ? expires : fallback).toISOString();
}
