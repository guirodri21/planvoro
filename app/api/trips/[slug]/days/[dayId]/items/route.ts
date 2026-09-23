import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { dayBelongsToTrip, lerItem } from "@/lib/itinerary-edit";
import { logError } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

/** Adiciona um item escrito a mao no fim de um dia do roteiro. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; dayId: string }> }
) {
  try {
    const { slug, dayId } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para editar o roteiro." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Você não participa desta viagem." }, { status: 403 });
    }
    if (!membership.isOrganizer) {
      return NextResponse.json(
        { error: "Só quem organiza edita o roteiro. Você pode sugerir pelas Ideias." },
        { status: 403 }
      );
    }
    if (!(await dayBelongsToTrip(db, membership.tripId, dayId))) {
      return NextResponse.json({ error: "Dia não encontrado nesta viagem." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const lido = lerItem(body, { exigirTitulo: true });
    if ("erro" in lido) return NextResponse.json({ error: lido.erro }, { status: 400 });

    const { count } = await db
      .from("itinerary_items")
      .select("id", { count: "exact", head: true })
      .eq("day_id", dayId);

    const { data, error } = await db
      .from("itinerary_items")
      .insert({
        day_id: dayId,
        position: count ?? 0,
        title: lido.item.title,
        description: lido.item.description ?? null,
        start_time: lido.item.start_time ?? null,
        cost_estimate: lido.item.cost_estimate ?? null,
        // Item escrito a mao nao passou pela conferencia de lugar: fica
        // marcado como nao verificado, e o mapa nao inventa coordenada.
        verified: false,
        needs_vote: false,
        category: "Manual",
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    logError({ event: "item_create_failed", route: "trips/[slug]/days/[dayId]/items", error: e });
    return NextResponse.json({ error: "Não foi possível adicionar o item." }, { status: 500 });
  }
}
