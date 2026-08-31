import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Amostra de roteiro sem conta.
 *
 * O objetivo e a pessoa ver o produto funcionando antes de decidir se
 * cria conta. O risco e o custo: geracao aberta pode ser chamada por
 * qualquer um, inclusive por script, e cada chamada custa modelo.
 *
 * Tres travas, da mais eficaz para a mais bruta:
 *
 *   1. Cache por destino. Destino repete muito, entao a partir do segundo
 *      pedido de "Lisboa" nao ha custo nenhum. E a trava que carrega o
 *      peso; as outras duas so cobrem o que escapar dela.
 *   2. Limite por IP, para uma pessoa nao gerar dez destinos diferentes.
 *   3. Teto diario global, que e a rede de seguranca: mesmo que as duas
 *      primeiras falhem, a conta do mes tem um limite conhecido.
 */

/** Dias da amostra. Curto de proposito: mostra o formato, nao entrega a viagem. */
export const SAMPLE_DAYS = 2;

/** Cache de destino. Roteiro turistico nao muda de uma semana para a outra. */
export const SAMPLE_CACHE_DAYS = 30;

/** Pedidos por IP em 24h, contando os servidos pelo cache. */
export const SAMPLE_PER_IP_PER_DAY = 12;

/** Geracoes de verdade por IP em 24h. O que exceder so recebe cache. */
export const SAMPLE_GENERATIONS_PER_IP = 3;

/** Teto do dia inteiro. A rede de seguranca da conta de IA. */
export const SAMPLE_GENERATIONS_PER_DAY = 250;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Acentos separados pela normalizacao NFD. */
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Chave de cache do destino.
 *
 * "Lisboa", "lisboa " e "Lisboa, Portugal" nao deveriam gerar tres vezes,
 * mas "Lisboa" e "Porto" sim. Normalizar acento, caixa e espaco resolve a
 * maior parte da repeticao sem tentar ser esperto demais.
 */
export function destinationKey(raw: string) {
  return raw
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * IP com hash.
 *
 * Endereco IP e dado pessoal. Para contar pedido basta saber se dois
 * vieram da mesma origem, e o hash responde isso sem guardar de quem.
 */
export function hashIp(ip: string) {
  const salt = process.env.SAMPLE_IP_SALT ?? "planvoro-sample";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 40);
}

/** IP de quem chamou, atras do proxy da Vercel. */
export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "desconhecido";
}

export type SampleAllowance = {
  /** Pode responder alguma coisa? */
  allowed: boolean;
  /** Pode chamar o modelo, ou so servir cache? */
  mayGenerate: boolean;
  message?: string;
};

export async function checkSampleAllowance(
  db: SupabaseClient,
  ipHash: string
): Promise<SampleAllowance> {
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [byIp, generatedByIp, generatedToday] = await Promise.all([
    db
      .from("sample_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
    db
      .from("sample_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("generated", true)
      .gte("created_at", since),
    db
      .from("sample_requests")
      .select("id", { count: "exact", head: true })
      .eq("generated", true)
      .gte("created_at", since),
  ]);

  if ((byIp.count ?? 0) >= SAMPLE_PER_IP_PER_DAY) {
    return {
      allowed: false,
      mayGenerate: false,
      message:
        "Você já viu várias amostras hoje. Crie uma conta grátis para montar o roteiro completo da sua viagem.",
    };
  }

  const mayGenerate =
    (generatedByIp.count ?? 0) < SAMPLE_GENERATIONS_PER_IP &&
    (generatedToday.count ?? 0) < SAMPLE_GENERATIONS_PER_DAY;

  return { allowed: true, mayGenerate };
}

export async function readSampleCache(db: SupabaseClient, key: string) {
  const since = new Date(Date.now() - SAMPLE_CACHE_DAYS * DAY_MS).toISOString();

  const { data } = await db
    .from("sample_itineraries")
    .select("destination, payload, created_at")
    .eq("destination_key", key)
    .gte("created_at", since)
    .maybeSingle();

  return data ?? null;
}

export async function writeSampleCache(
  db: SupabaseClient,
  key: string,
  destination: string,
  payload: unknown
) {
  await db
    .from("sample_itineraries")
    .upsert(
      { destination_key: key, destination, payload, created_at: new Date().toISOString() },
      { onConflict: "destination_key" }
    );
}

export async function recordSampleRequest(
  db: SupabaseClient,
  ipHash: string,
  key: string,
  generated: boolean
) {
  await db.from("sample_requests").insert({
    ip_hash: ipHash,
    destination_key: key,
    generated,
  });
}

/** Datas fictícias da amostra: começa amanhã, para o modelo ter um período real. */
export function sampleDates() {
  const start = new Date();
  start.setDate(start.getDate() + 1);

  const dates: string[] = [];
  for (let i = 0; i < SAMPLE_DAYS; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}
