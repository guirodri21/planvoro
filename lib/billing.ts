import type { BillingPlan } from "@/lib/abacatepay";

export type { BillingPlan };

export const BILLING_COPY: Record<
  BillingPlan,
  { label: string; description: string; amount: number }
> = {
  trip_pass: {
    label: "Passe de viagem",
    description:
      "Libera uma viagem inteira para o grupo todo. Só o organizador paga. Vale até 90 dias depois da volta.",
    amount: 2900,
  },
  pro_annual: {
    label: "Planvoro Pro anual",
    description: "Viagens ilimitadas por um ano, com importação de reservas e histórico completo.",
    amount: 7900,
  },
};

/**
 * Id do evento Purchase da Meta. O mesmo no servidor (lib/billing-grant.ts)
 * e no navegador (app/meta-pixel.tsx), para a Meta contar a compra uma vez.
 */
export function eventIdDaCompra(pedidoId: string) {
  return `compra-${pedidoId}`;
}

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

/**
 * Teste gratis da conta, para quem ainda nao organiza viagem nenhuma.
 *
 * O teste era so por viagem: quem clicava sem ter viagem propria (so
 * convidado, ou recem-chegado) nao via nada acontecer — o botao procurava
 * uma viagem para liberar, nao achava e parava. Agora, sem viagem, o teste
 * vale para a conta: tudo que ela organizar nos 7 dias ja nasce liberado.
 *
 * Mora na mesma linha de `user_subscriptions` do Pro, com status
 * `trialing` (que `isProStatusActive` ja trata como liberado) e este
 * provedor marcando que e teste, nao Pro pago.
 */
export const PROVEDOR_TESTE_CONTA = "teste_gratis";

type LinhaAssinatura = {
  status?: string | null;
  provider?: string | null;
  current_period_end?: string | null;
} | null | undefined;

export function testeDaConta(assinatura: LinhaAssinatura) {
  const usado = assinatura?.provider === PROVEDOR_TESTE_CONTA;
  const expiraEm = usado ? assinatura?.current_period_end ?? null : null;
  const ativo =
    usado && assinatura?.status === "trialing" && Boolean(expiraEm) && new Date(expiraEm as string).getTime() > Date.now();
  return { usado, ativo, expiraEm };
}

/** Pro pago de verdade. O teste da conta usa a mesma linha, mas nao e Pro. */
export function proPagoAtivo(assinatura: LinhaAssinatura) {
  if (testeDaConta(assinatura).usado) return false;
  return isProStatusActive(assinatura?.status ?? null, assinatura?.current_period_end ?? null);
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

/**
 * Teste gratis.
 *
 * Sete dias e o prazo que cobre uma semana inteira de planejamento sem
 * dar tempo de a viagem acontecer dentro dele — quem testa precisa sentir
 * falta do Cofre depois, nao usar a viagem toda de graca.
 */
export const TRIAL_DIAS = 7;

export function trialExpiresAt() {
  const fim = new Date();
  fim.setDate(fim.getDate() + TRIAL_DIAS);
  return fim.toISOString();
}
