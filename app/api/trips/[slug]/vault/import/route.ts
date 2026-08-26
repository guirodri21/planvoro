import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { reserveAiUsage } from "@/lib/ai-limits";
import { logError, logInfo, logWarn, startTimer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { lockedMessage, resolveTripAccess } from "@/lib/trip-access";
import { importVaultDraftFromText } from "@/lib/vault-import";
import type { Trip } from "@/lib/types";

export const maxDuration = 35;

const MIN_IMPORT_TEXT = 40;
const MAX_IMPORT_TEXT = 12_000;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const elapsed = startTimer();
  const logCtx: { userId?: string; tripId?: string } = {};

  try {
    const { slug } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? body.raw_text ?? "").trim();

    if (text.length < MIN_IMPORT_TEXT) {
      return NextResponse.json(
        { error: "Cole um texto de confirmacao com mais detalhes para importar." },
        { status: 400 }
      );
    }
    if (text.length > MAX_IMPORT_TEXT) {
      return NextResponse.json(
        { error: "Texto grande demais. Cole ate 12 mil caracteres por importacao." },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para importar reservas." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const access = await resolveTripAccess(db, membership.tripId);
    if (!access.unlocked) {
      return NextResponse.json({ error: lockedMessage("A importacao do Cofre") }, { status: 402 });
    }

    logCtx.userId = user.id;
    logCtx.tripId = membership.tripId;

    const limitMessage = await reserveAiUsage(db, {
      kind: "vault_import",
      userId: user.id,
      tripId: membership.tripId,
    });
    if (limitMessage) {
      logWarn({ event: "vault_import_limited", route: "trips/[slug]/vault/import", ...logCtx });
      return NextResponse.json({ error: limitMessage }, { status: 429 });
    }

    const { data: trip, error: tripError } = await db
      .from("trips")
      .select("id, slug, destination, start_date, end_date, party_size, budget_band, styles, is_solo, is_public")
      .eq("id", membership.tripId)
      .maybeSingle();
    if (tripError) throw tripError;
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const draft = await importVaultDraftFromText(trip as Trip, text);

    logInfo({
      event: "vault_import_drafted",
      route: "trips/[slug]/vault/import",
      ...logCtx,
      durationMs: elapsed(),
      textLength: text.length,
      kind: draft?.kind,
      confidence: draft?.confidence,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao importar reserva.";
    logError({
      event: "vault_import_failed",
      route: "trips/[slug]/vault/import",
      ...logCtx,
      durationMs: elapsed(),
      error: e,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
