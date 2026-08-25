import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ideaBelongsToTrip, memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Voto de uma pessoa numa ideia solta.
 *   1  = curti
 *   0  = na duvida
 *  -1  = nao curti
 * Votar de novo no mesmo valor desfaz o voto.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; ideaId: string }> }
) {
  try {
    const { slug, ideaId } = await ctx.params;
    const { value } = await req.json();

    if (![1, 0, -1].includes(value)) {
      return NextResponse.json({ error: "Voto invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para votar." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await ideaBelongsToTrip(db, membership.tripId, ideaId))) {
      return NextResponse.json({ error: "Ideia nao encontrada nesta viagem." }, { status: 404 });
    }

    const { data: existing, error: existingError } = await db
      .from("idea_votes")
      .select("id, value")
      .eq("idea_id", ideaId)
      .eq("member_id", membership.memberId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing && existing.value === value) {
      const { error: deleteError } = await db.from("idea_votes").delete().eq("id", existing.id);
      if (deleteError) throw deleteError;
      return NextResponse.json({ ok: true, value: null });
    }

    const { error } = await db
      .from("idea_votes")
      .upsert(
        { idea_id: ideaId, member_id: membership.memberId, value },
        { onConflict: "idea_id,member_id" }
      );
    if (error) throw error;

    return NextResponse.json({ ok: true, value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao votar na ideia.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
