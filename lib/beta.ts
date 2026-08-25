const rawBetaAccess = process.env.NEXT_PUBLIC_PLANVORO_BETA_ACCESS ?? "true";

export const betaAccessEnabled = !["0", "false", "off", "no"].includes(
  rawBetaAccess.trim().toLowerCase()
);

export const betaAccessLabel = "Beta grátis";

export const betaAccessDescription =
  "Durante a beta, todos os recursos principais ficam liberados para testar com viagens reais.";
