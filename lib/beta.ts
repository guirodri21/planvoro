const rawBetaAccess = process.env.NEXT_PUBLIC_PLANVORO_BETA_ACCESS ?? "true";

export const betaAccessEnabled = !["0", "false", "off", "no"].includes(
  rawBetaAccess.trim().toLowerCase()
);

export const betaAccessLabel = "Beta grátis";

export const betaAccessDescription =
  "Durante a beta, todos os recursos principais ficam liberados para testar com viagens reais.";

/**
 * Contas que passam pela beta e chegam ao checkout.
 *
 * Existe para validar o fluxo de pagamento ponta a ponta sem tirar a beta
 * do ar para todo mundo. E deliberadamente uma variavel so do servidor,
 * sem `NEXT_PUBLIC_`: a lista nao precisa chegar ao navegador, e o que nao
 * chega nao vira convite para tentar burlar.
 *
 * Quando a beta for desligada, `betaAccessEnabled` vira false e esta lista
 * deixa de ter efeito sozinha. Nao ha o que limpar depois.
 */
const rawBillingTesters = process.env.PLANVORO_BILLING_TESTERS ?? "";

const billingTesters = new Set(
  rawBillingTesters
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

/** Se esta pessoa deve ser barrada pela beta ao tentar pagar. */
export function betaBlocksCheckoutFor(email?: string | null) {
  if (!betaAccessEnabled) return false;

  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return true;

  return !billingTesters.has(normalized);
}
