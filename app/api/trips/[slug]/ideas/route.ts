import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_TITLE = 120;
const MAX_NOTES = 800;
const MAX_CATEGORY = 60;
const MAX_COST = 1_000_000;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const { title, notes, category, estimated_cost } = await req.json();

    const cleanTitle = String(title ?? "").trim();
    if (!cleanTitle) {
      return NextResponse.json({ error: "Dê um nome para a ideia." }, { status: 400 });
    }
    if (cleanTitle.length > MAX_TITLE) {
      return NextResponse.json({ error: "Nome da ideia muito longo." }, { status: 400 });
    }

    const cleanNotes = String(notes ?? "").trim();
    if (cleanNotes.length > MAX_NOTES) {
      return NextResponse.json({ error: "Detalhes da ideia muito longos." }, { status: 400 });
    }

    const cleanCategory = String(category ?? "").trim();
    if (cleanCategory.length > MAX_CATEGORY) {
      return NextResponse.json({ error: "Categoria muito longa." }, { status: 400 });
    }

    const hasCost = estimated_cost !== null && estimated_cost !== undefined && String(estimated_cost).trim() !== "";
    const numericCost = hasCost ? Number(estimated_cost) : null;
    if (
      numericCost !== null &&
      (!Number.isFinite(numericCost) || numericCost < 0 || numericCost > MAX_COST)
    ) {
      return NextResponse.json({ error: "Custo estimado invalido." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para sugerir ideias." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data, error } = await db
      .from("ideas")
      .insert({
        trip_id: membership.tripId,
        member_id: membership.memberId,
        title: cleanTitle,
        notes: cleanNotes || null,
        category: cleanCategory || null,
        estimated_cost: numericCost === null ? null : Number(numericCost.toFixed(2)),
      })
      .select("id, trip_id, member_id, title, notes, category, estimated_cost, status, created_at, updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ idea: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar a ideia.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
