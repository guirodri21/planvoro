import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { itemBelongsToTrip, memberForUserInTrip } from "@/lib/guards";
import { idsDoDia, lerItem, renumerarDia } from "@/lib/itinerary-edit";
import { logError } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

type Ctx = { params: Promise<{ slug: string; itemId: string }> };

/** Confere conta, viagem, papel de organizador e se o item e desta viagem. */
async function autorizar(req: Request, ctx: Ctx) {
  const { slug, itemId } = await ctx.params;
  const db = supabaseAdmin();
  const user = await getUserFromRequest(req, db);
  if (!user) {
    return { resposta: NextResponse.json({ error: "Entre na sua conta para editar o roteiro." }, { status: 401 }) };
  }
  const membership = await memberForUserInTrip(db, slug, user.id);
  if (!membership) {
    return { resposta: NextResponse.json({ error: "Você não participa desta viagem." }, { status: 403 }) };
  }
  if (!membership.isOrganizer) {
    return {
      resposta: NextResponse.json(
        { error: "Só quem organiza edita o roteiro. Você pode votar e comentar." },
        { status: 403 }
      ),
    };
  }
  if (!(await itemBelongsToTrip(db, membership.tripId, itemId))) {
    return { resposta: NextResponse.json({ error: "Item não encontrado nesta viagem." }, { status: 404 }) };
  }
  return { db, itemId };
}

/**
 * Edita um item ou muda a posicao dele no dia.
 *
 * Corpo com `move: "up" | "down"` so reordena; qualquer outro campo edita.
 * Trocar o titulo apaga a conferencia do lugar: o selo "verificado" era do
 * lugar antigo e passaria a mentir sobre o novo.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(req, ctx);
    if ("resposta" in auth) return auth.resposta;
    const { db, itemId } = auth;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.move === "up" || body.move === "down") {
      const { data: item } = await db
        .from("itinerary_items")
        .select("day_id")
        .eq("id", itemId)
        .single();
      const ordem = await idsDoDia(db, item!.day_id as string);
      const i = ordem.indexOf(itemId);
      const j = body.move === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= ordem.length) return NextResponse.json({ ok: true });
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      await renumerarDia(db, item!.day_id as string, ordem);
      return NextResponse.json({ ok: true });
    }

    const lido = lerItem(body, { exigirTitulo: false });
    if ("erro" in lido) return NextResponse.json({ error: lido.erro }, { status: 400 });
    if (!Object.keys(lido.item).length) {
      return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });
    }

    const mudancas: Record<string, unknown> = { ...lido.item };
    if ("cost_estimate" in lido.item) {
      // Valor digitado e em real; o valor em moeda local da IA deixa de
      // valer e sairia contradizendo o novo.
      mudancas.cost_local = null;
      mudancas.cost_currency = null;
    }
    if (lido.item.title) {
      const { data: atual } = await db.from("itinerary_items").select("title").eq("id", itemId).single();
      if (atual && atual.title !== lido.item.title) {
        mudancas.verified = false;
        mudancas.lat = null;
        mudancas.lng = null;
        mudancas.place_data = null;
      }
    }

    const { error } = await db.from("itinerary_items").update(mudancas).eq("id", itemId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError({ event: "item_update_failed", route: "trips/[slug]/items/[itemId]", error: e });
    return NextResponse.json({ error: "Não foi possível salvar o item." }, { status: 500 });
  }
}

/** Remove o item; votos e comentarios dele saem junto (on delete cascade). */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(req, ctx);
    if ("resposta" in auth) return auth.resposta;
    const { db, itemId } = auth;

    const { data: item } = await db.from("itinerary_items").select("day_id").eq("id", itemId).single();
    const { error } = await db.from("itinerary_items").delete().eq("id", itemId);
    if (error) throw error;

    if (item?.day_id) {
      await renumerarDia(db, item.day_id as string, await idsDoDia(db, item.day_id as string));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError({ event: "item_delete_failed", route: "trips/[slug]/items/[itemId]", error: e });
    return NextResponse.json({ error: "Não foi possível remover o item." }, { status: 500 });
  }
}
