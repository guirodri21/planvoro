import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip, memberIdsBelongToTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { lockedMessage, resolveTripAccess } from "@/lib/trip-access";

const MAX_DESCRIPTION = 160;
const MAX_AMOUNT = 1_000_000;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const { payer_member_id, split_member_ids, description, amount } = await req.json();

    const text = String(description ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Descreva o gasto." }, { status: 400 });
    }
    if (text.length > MAX_DESCRIPTION) {
      return NextResponse.json({ error: "Descricao muito longa." }, { status: 400 });
    }

    const payerId = String(payer_member_id ?? "").trim();
    if (!payerId) {
      return NextResponse.json({ error: "Escolha quem pagou." }, { status: 400 });
    }

    const splitIds = Array.isArray(split_member_ids)
      ? [...new Set(split_member_ids.map((value) => String(value).trim()).filter(Boolean))]
      : [];
    if (!splitIds.length) {
      return NextResponse.json({ error: "Selecione ao menos uma pessoa para dividir." }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > MAX_AMOUNT) {
      return NextResponse.json({ error: "Valor invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para registrar gastos." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const access = await resolveTripAccess(db, membership.tripId);
    if (!access.unlocked) {
      return NextResponse.json({ error: lockedMessage("Dividir gastos") }, { status: 402 });
    }

    if (!(await memberIdsBelongToTrip(db, membership.tripId, [payerId, ...splitIds]))) {
      return NextResponse.json(
        { error: "As pessoas selecionadas nao pertencem a esta viagem." },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from("expenses")
      .insert({
        trip_id: membership.tripId,
        payer_member_id: payerId,
        amount: Number(numericAmount.toFixed(2)),
        description: text,
        split_member_ids: splitIds,
      })
      .select("id, trip_id, payer_member_id, amount, description, split_member_ids, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ expense: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao registrar o gasto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
