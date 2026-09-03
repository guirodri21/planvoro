import crypto from "node:crypto";

/**
 * Cliente da AbacatePay.
 *
 * Substituiu a Stripe porque a Stripe nao liberou a conta brasileira. Para
 * o Planvoro a troca sai barata: os precos sao um pagamento unico (Passe) e
 * uma assinatura anual (Pro), e nao havia mensalidade — que era a unica
 * coisa que teria amarrado o projeto a Stripe.
 */

const API = "https://api.abacatepay.com/v2";

export type BillingPlan = "trip_pass" | "pro_annual";

/**
 * Chave da API.
 *
 * Deliberadamente sem valor padrao: uma chave vazia faria o checkout falhar
 * com "401 nao autorizado" na cara do cliente, no meio da compra. Melhor
 * quebrar no servidor, com nome do que falta.
 */
export function abacateApiKey() {
  const key = process.env.ABACATEPAY_API_KEY;
  if (!key) throw new Error("ABACATEPAY_API_KEY nao configurada.");
  return key;
}

export function abacateWebhookSecret() {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("ABACATEPAY_WEBHOOK_SECRET nao configurado.");
  return secret;
}

/** ID do produto na AbacatePay, criado uma vez no painel ou pela API. */
export function productIdForPlan(plan: BillingPlan) {
  const id =
    plan === "trip_pass"
      ? process.env.ABACATEPAY_PRODUCT_TRIP_PASS
      : process.env.ABACATEPAY_PRODUCT_PRO_ANNUAL;

  if (!id) throw new Error(`Produto da AbacatePay nao configurado para ${plan}.`);
  return id;
}

type CriarCheckout = {
  plan: BillingPlan;
  /** Nossa referencia: o id da linha em billing_checkouts. */
  externalId: string;
  completionUrl: string;
  returnUrl: string;
  /**
   * Cliente ja cadastrado na AbacatePay, para o checkout vir preenchido.
   * A API aceita `customerId`, nunca os dados do cliente soltos: o schema
   * e `additionalProperties: false` e recusa o corpo inteiro se vier campo
   * que ela nao conhece.
   */
  customerId?: string | null;
};

export type CheckoutCriado = {
  id: string;
  url: string;
  amount: number | null;
};

async function abacateFetch(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${abacateApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: unknown; error?: string | null }
    | null;

  if (!res.ok || json?.error) {
    // A mensagem da AbacatePay pode citar campo e motivo; vale propagar
    // para o log, mas quem chama decide o que mostrar ao usuario.
    throw new Error(json?.error ?? `AbacatePay respondeu ${res.status} em ${path}.`);
  }

  return json?.data ?? null;
}

export async function criarCheckout(params: CriarCheckout): Promise<CheckoutCriado> {
  const data = (await abacateFetch("/checkouts/create", {
    items: [{ id: productIdForPlan(params.plan), quantity: 1 }],
    methods: ["PIX", "CARD"],
    externalId: params.externalId,
    completionUrl: params.completionUrl,
    returnUrl: params.returnUrl,
    ...(params.customerId ? { customerId: params.customerId } : {}),
  })) as { id?: string; url?: string; amount?: number } | null;

  if (!data?.id || !data?.url) {
    throw new Error("AbacatePay nao devolveu o link de pagamento.");
  }

  return { id: data.id, url: data.url, amount: data.amount ?? null };
}

/**
 * Cria o cliente na AbacatePay, ou devolve null se nao der.
 *
 * Serve so para o checkout ja abrir com o e-mail preenchido. Falhar aqui
 * nao pode impedir a compra: cliente e conveniencia, pagamento e o negocio.
 */
export async function criarCliente(email: string, nome?: string | null) {
  try {
    const data = (await abacateFetch("/customers/create", {
      email,
      ...(nome ? { name: nome } : {}),
    })) as { id?: string } | null;

    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Chave publicada pela AbacatePay para a assinatura HMAC dos webhooks.
 *
 * Ela esta na documentacao publica, ou seja, qualquer pessoa consegue
 * produzir uma assinatura valida. Conferir isso pega corpo corrompido no
 * caminho, nao remetente falso. Quem realmente autentica o webhook e o
 * segredo na query string, que e so nosso — por isso os dois sao exigidos,
 * e nao um ou outro.
 */
const HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

/** Comparacao de tamanho fixo: `===` em segredo vaza o tamanho pelo tempo. */
function iguais(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function webhookSecretConfere(recebido: string | null) {
  if (!recebido) return false;
  return iguais(recebido, abacateWebhookSecret());
}

export function assinaturaConfere(rawBody: string, assinatura: string | null) {
  if (!assinatura) return false;

  const esperada = crypto
    .createHmac("sha256", HMAC_KEY)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");

  return iguais(esperada, assinatura);
}
