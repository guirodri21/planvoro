import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ideaBelongsToTrip, memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import type { IdeaStatus } from "@/lib/types";

const STATUSES: IdeaStatus[] = ["open", "planned", "dismissed"];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; ideaId: string }> }
) {
  try {
    const { slug, ideaId } = await ctx.params;
    const { status } = await req.json();

    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para organizar ideias." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }
    if (!(await ideaBelongsToTrip(db, membership.tripId, ideaId))) {
      return NextResponse.json({ error: "Ideia nao encontrada nesta viagem." }, { status: 404 });
    }

    const { data, error } = await db
      .from("ideas")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ideaId)
      .select("id, trip_id, member_id, title, notes, category, estimated_cost, status, created_at, updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ idea: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar a ideia.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
