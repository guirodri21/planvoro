import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { itemBelongsToTrip, memberForUserInTrip } from "@/lib/guards";

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
    const { value } = await req.json();

    if (![1, 0, -1].includes(value)) {
      return NextResponse.json({ error: "Voto invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para votar." }, { status: 401 });
    }

    // Duas checagens obrigatorias: a pessoa e mesmo desta viagem,
    // e o item pertence mesmo a esta viagem. Sem isso, quem tiver o
    // id de um item de outra viagem consegue votar nela.
    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await itemBelongsToTrip(db, membership.tripId, itemId))) {
      return NextResponse.json({ error: "Item nao encontrado nesta viagem." }, { status: 404 });
    }

    const { data: existing } = await db
      .from("votes")
      .select("id, value")
      .eq("item_id", itemId)
      .eq("member_id", membership.memberId)
      .maybeSingle();

    if (existing && existing.value === value) {
      await db.from("votes").delete().eq("id", existing.id);
      return NextResponse.json({ ok: true, value: null });
    }

    const { error } = await db
      .from("votes")
      .upsert(
        { item_id: itemId, member_id: membership.memberId, value },
        { onConflict: "item_id,member_id" }
      );
    if (error) throw error;

    return NextResponse.json({ ok: true, value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao votar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
