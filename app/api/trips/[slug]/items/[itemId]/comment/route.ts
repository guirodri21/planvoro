import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { memberBelongsToTrip, itemBelongsToTrip } from "@/lib/guards";

const MAX_LEN = 1000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const { member_id, body } = await req.json();

    if (!member_id) {
      return NextResponse.json({ error: "Sem membro identificado." }, { status: 400 });
    }
    const texto = String(body ?? "").trim();
    if (!texto) return NextResponse.json({ error: "Escreva alguma coisa." }, { status: 400 });
    if (texto.length > MAX_LEN) {
      return NextResponse.json({ error: "Comentario muito longo." }, { status: 400 });
    }

    const db = supabaseAdmin();

    const trip = await memberBelongsToTrip(db, slug, member_id);
    if (!trip) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await itemBelongsToTrip(db, trip.id, itemId))) {
      return NextResponse.json({ error: "Item nao encontrado nesta viagem." }, { status: 404 });
    }

    const { data, error } = await db
      .from("comments")
      .insert({ item_id: itemId, member_id, body: texto })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao comentar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
