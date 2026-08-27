import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Remover um gasto lancado.
 *
 * Nao passa pelo gate do Passe: apagar nunca e bloqueado. Um gasto
 * digitado errado ou lancado duas vezes suja o acerto de todo o grupo, e
 * segurar a correcao atras de pagamento seria indefensavel.
 *
 * Quem pode: o organizador, ou quem lancou. O rateio de um gasto atinge
 * todo mundo, entao nao pode ficar na mao de qualquer participante.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string; expenseId: string }> }
) {
  try {
    const { slug, expenseId } = await ctx.params;

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data: expense, error: expenseError } = await db
      .from("expenses")
      .select("id, payer_member_id")
      .eq("id", expenseId)
      .eq("trip_id", membership.tripId)
      .maybeSingle();
    if (expenseError) throw expenseError;
    if (!expense) return NextResponse.json({ error: "Gasto nao encontrado." }, { status: 404 });

    if (!membership.isOrganizer && expense.payer_member_id !== membership.memberId) {
      return NextResponse.json(
        { error: "So o organizador ou quem lancou pode remover este gasto." },
        { status: 403 }
      );
    }

    const { error } = await db
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("trip_id", membership.tripId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover o gasto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
