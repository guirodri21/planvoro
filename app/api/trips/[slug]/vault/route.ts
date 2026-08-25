import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { TRIP_VAULT_KINDS, TRIP_VAULT_STATUSES, type TripVaultKind, type TripVaultStatus } from "@/lib/types";

const MAX_TITLE = 140;
const MAX_PROVIDER = 100;
const MAX_CONFIRMATION = 80;
const MAX_LOCATION = 180;
const MAX_URL = 500;
const MAX_NOTES = 1200;
const MAX_AMOUNT = 5_000_000;

const VAULT_KINDS = new Set<TripVaultKind>(TRIP_VAULT_KINDS.map((kind) => kind.value));
const VAULT_STATUSES = new Set<TripVaultStatus>(TRIP_VAULT_STATUSES.map((status) => status.value));

function cleanOptional(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanCurrency(value: unknown) {
  const text = String(value ?? "BRL").trim().toUpperCase();
  return text.length >= 3 && text.length <= 8 ? text : "BRL";
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "De um nome para guardar no Cofre." }, { status: 400 });
    }
    if (title.length > MAX_TITLE) {
      return NextResponse.json({ error: "Nome muito longo para o Cofre." }, { status: 400 });
    }

    const kind = String(body.kind ?? "other").trim() as TripVaultKind;
    if (!VAULT_KINDS.has(kind)) {
      return NextResponse.json({ error: "Tipo de item invalido." }, { status: 400 });
    }

    const status = String(body.status ?? "saved").trim() as TripVaultStatus;
    if (!VAULT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const hasAmount = body.amount !== null && body.amount !== undefined && String(body.amount).trim() !== "";
    const numericAmount = hasAmount ? Number(body.amount) : null;
    if (
      numericAmount !== null &&
      (!Number.isFinite(numericAmount) || numericAmount < 0 || numericAmount > MAX_AMOUNT)
    ) {
      return NextResponse.json({ error: "Valor invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para guardar itens." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data, error } = await db
      .from("trip_vault_items")
      .insert({
        trip_id: membership.tripId,
        member_id: membership.memberId,
        kind,
        title,
        provider: cleanOptional(body.provider, MAX_PROVIDER),
        confirmation_code: cleanOptional(body.confirmation_code, MAX_CONFIRMATION),
        starts_at: cleanDate(body.starts_at),
        ends_at: cleanDate(body.ends_at),
        location: cleanOptional(body.location, MAX_LOCATION),
        amount: numericAmount === null ? null : Number(numericAmount.toFixed(2)),
        currency: cleanCurrency(body.currency),
        status,
        url: cleanOptional(body.url, MAX_URL),
        notes: cleanOptional(body.notes, MAX_NOTES),
      })
      .select(
        "id, trip_id, member_id, kind, title, provider, confirmation_code, starts_at, ends_at, location, amount, currency, status, url, notes, created_at, updated_at"
      )
      .single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar no Cofre.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
