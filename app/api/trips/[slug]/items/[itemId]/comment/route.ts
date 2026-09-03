import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { itemBelongsToTrip, memberForUserInTrip } from "@/lib/guards";

const MAX_LEN = 1000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const { body } = await req.json();

    const texto = String(body ?? "").trim();
    if (!texto) return NextResponse.json({ error: "Escreva alguma coisa." }, { status: 400 });
    if (texto.length > MAX_LEN) {
      return NextResponse.json({ error: "Comentario muito longo." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para comentar." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await itemBelongsToTrip(db, membership.tripId, itemId))) {
      return NextResponse.json({ error: "Item nao encontrado nesta viagem." }, { status: 404 });
    }

    const { data, error } = await db
      .from("comments")
      .insert({ item_id: itemId, member_id: membership.memberId, body: texto })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao comentar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
