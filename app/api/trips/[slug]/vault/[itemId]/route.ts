import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { lockedMessage, resolveTripAccess } from "@/lib/trip-access";
import { VAULT_BUCKET } from "@/lib/vault-attachments";
import { TRIP_VAULT_KINDS, TRIP_VAULT_STATUSES, type TripVaultKind, type TripVaultStatus } from "@/lib/types";

const MAX_TITLE = 140;
const MAX_PROVIDER = 100;
const MAX_CONFIRMATION = 80;
const MAX_LOCATION = 180;
const MAX_URL = 500;
const MAX_NOTES = 1200;
const MAX_AMOUNT = 5_000_000;
const SELECT_FIELDS =
  "id, trip_id, member_id, kind, title, provider, confirmation_code, starts_at, ends_at, location, amount, currency, status, url, notes, created_at, updated_at";

const VAULT_KINDS = new Set<TripVaultKind>(TRIP_VAULT_KINDS.map((kind) => kind.value));
const VAULT_STATUSES = new Set<TripVaultStatus>(TRIP_VAULT_STATUSES.map((status) => status.value));

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

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

function buildVaultUpdate(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(body, "title")) {
    const title = String(body.title ?? "").trim();
    if (!title) return { error: "De um nome para guardar no Cofre." };
    if (title.length > MAX_TITLE) return { error: "Nome muito longo para o Cofre." };
    update.title = title;
  }

  if (hasOwn(body, "kind")) {
    const kind = String(body.kind ?? "other").trim() as TripVaultKind;
    if (!VAULT_KINDS.has(kind)) return { error: "Tipo de item invalido." };
    update.kind = kind;
  }

  if (hasOwn(body, "status")) {
    const status = String(body.status ?? "saved").trim() as TripVaultStatus;
    if (!VAULT_STATUSES.has(status)) return { error: "Status invalido." };
    update.status = status;
  }

  if (hasOwn(body, "provider")) update.provider = cleanOptional(body.provider, MAX_PROVIDER);
  if (hasOwn(body, "confirmation_code")) {
    update.confirmation_code = cleanOptional(body.confirmation_code, MAX_CONFIRMATION);
  }
  if (hasOwn(body, "starts_at")) update.starts_at = cleanDate(body.starts_at);
  if (hasOwn(body, "ends_at")) update.ends_at = cleanDate(body.ends_at);
  if (hasOwn(body, "location")) update.location = cleanOptional(body.location, MAX_LOCATION);
  if (hasOwn(body, "url")) update.url = cleanOptional(body.url, MAX_URL);
  if (hasOwn(body, "notes")) update.notes = cleanOptional(body.notes, MAX_NOTES);
  if (hasOwn(body, "currency")) update.currency = cleanCurrency(body.currency);

  if (hasOwn(body, "amount")) {
    const hasAmount = body.amount !== null && body.amount !== undefined && String(body.amount).trim() !== "";
    const numericAmount = hasAmount ? Number(body.amount) : null;
    if (
      numericAmount !== null &&
      (!Number.isFinite(numericAmount) || numericAmount < 0 || numericAmount > MAX_AMOUNT)
    ) {
      return { error: "Valor invalido." };
    }
    update.amount = numericAmount === null ? null : Number(numericAmount.toFixed(2));
  }

  if (Object.keys(update).length === 1) return { error: "Nada para atualizar." };

  return { update };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const rawBody = await req.json().catch(() => ({}));
    const body =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {};
    const parsed = buildVaultUpdate(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para atualizar itens." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const access = await resolveTripAccess(db, membership.tripId);
    if (!access.unlocked) {
      return NextResponse.json({ error: lockedMessage("O Cofre") }, { status: 402 });
    }

    const { data: item, error: itemError } = await db
      .from("trip_vault_items")
      .select("id, member_id")
      .eq("id", itemId)
      .eq("trip_id", membership.tripId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });

    if (!membership.isOrganizer && item.member_id !== membership.memberId) {
      return NextResponse.json(
        { error: "So o organizador ou quem salvou este item pode editar." },
        { status: 403 }
      );
    }

    const { data, error } = await db
      .from("trip_vault_items")
      .update(parsed.update)
      .eq("id", itemId)
      .eq("trip_id", membership.tripId)
      .select(SELECT_FIELDS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });

    return NextResponse.json({ item: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar do Cofre.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para remover itens." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }


    const { data: item, error: itemError } = await db
      .from("trip_vault_items")
      .select("id, member_id")
      .eq("id", itemId)
      .eq("trip_id", membership.tripId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });

    if (!membership.isOrganizer && item.member_id !== membership.memberId) {
      return NextResponse.json(
        { error: "So o organizador ou quem salvou este item pode remover." },
        { status: 403 }
      );
    }

    // A linha de anexo cai por cascade, mas o objeto no Storage nao:
    // sem isso o bucket acumula arquivo orfao que ninguem mais consegue ver.
    const { data: attachments, error: attachmentsError } = await db
      .from("trip_vault_attachments")
      .select("storage_path")
      .eq("item_id", itemId)
      .eq("trip_id", membership.tripId);
    if (attachmentsError) throw attachmentsError;

    if (attachments?.length) {
      await db.storage.from(VAULT_BUCKET).remove(attachments.map((row) => row.storage_path));
    }

    const { error } = await db
      .from("trip_vault_items")
      .delete()
      .eq("id", itemId)
      .eq("trip_id", membership.tripId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover do Cofre.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
