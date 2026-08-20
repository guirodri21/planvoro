import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { memberBelongsToTrip, itemBelongsToTrip } from "@/lib/guards";

/**
 * Voto de uma pessoa num item do roteiro.
 *   1  = curti
 *   0  = na duvida
 *  -1  = nao curti
 * Votar de novo no mesmo valor desfaz o voto.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const { member_id, value } = await req.json();

    if (!member_id) {
      return NextResponse.json({ error: "Sem membro identificado." }, { status: 400 });
    }
    if (![1, 0, -1].includes(value)) {
      return NextResponse.json({ error: "Voto invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Duas checagens obrigatorias: a pessoa e mesmo desta viagem,
    // e o item pertence mesmo a esta viagem. Sem isso, quem tiver o
    // id de um item de outra viagem consegue votar nela.
    const trip = await memberBelongsToTrip(db, slug, member_id);
    if (!trip) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await itemBelongsToTrip(db, trip.id, itemId))) {
      return NextResponse.json({ error: "Item nao encontrado nesta viagem." }, { status: 404 });
    }

    const { data: existing } = await db
      .from("votes")
      .select("id, value")
      .eq("item_id", itemId)
      .eq("member_id", member_id)
      .maybeSingle();

    if (existing && existing.value === value) {
      await db.from("votes").delete().eq("id", existing.id);
      return NextResponse.json({ ok: true, value: null });
    }

    const { error } = await db
      .from("votes")
      .upsert({ item_id: itemId, member_id, value }, { onConflict: "item_id,member_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true, value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao votar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
