import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { lockedMessage, resolveTripAccess } from "@/lib/trip-access";
import { TRIP_CHECKLIST_STATUSES, type TripChecklistStatus } from "@/lib/types";

const STATUSES = new Set<TripChecklistStatus>(
  TRIP_CHECKLIST_STATUSES.map((status) => status.value)
);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? "").trim() as TripChecklistStatus;

    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para atualizar tarefas." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const access = await resolveTripAccess(db, membership.tripId);
    if (!access.unlocked) {
      return NextResponse.json({ error: lockedMessage("O checklist") }, { status: 402 });
    }

    const { data, error } = await db
      .from("trip_checklist_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("trip_id", membership.tripId)
      .select("id, trip_id, member_id, category, title, notes, due_date, status, source, created_at, updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });

    return NextResponse.json({ item: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar tarefa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para remover tarefas." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }


    const { error } = await db
      .from("trip_checklist_items")
      .delete()
      .eq("id", itemId)
      .eq("trip_id", membership.tripId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover tarefa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
