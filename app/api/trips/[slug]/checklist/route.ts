import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import {
  TRIP_CHECKLIST_CATEGORIES,
  TRIP_CHECKLIST_STATUSES,
  type TripChecklistCategory,
  type TripChecklistStatus,
} from "@/lib/types";

const MAX_TITLE = 160;
const MAX_NOTES = 900;
const CATEGORIES = new Set<TripChecklistCategory>(
  TRIP_CHECKLIST_CATEGORIES.map((category) => category.value)
);
const STATUSES = new Set<TripChecklistStatus>(
  TRIP_CHECKLIST_STATUSES.map((status) => status.value)
);

function cleanDueDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : text.slice(0, 10);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Descreva a tarefa do checklist." }, { status: 400 });
    }
    if (title.length > MAX_TITLE) {
      return NextResponse.json({ error: "Tarefa muito longa." }, { status: 400 });
    }

    const category = String(body.category ?? "planning").trim() as TripChecklistCategory;
    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Categoria invalida." }, { status: 400 });
    }

    const status = String(body.status ?? "open").trim() as TripChecklistStatus;
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const notes = String(body.notes ?? "").trim();
    if (notes.length > MAX_NOTES) {
      return NextResponse.json({ error: "Notas muito longas." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para criar tarefas." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data, error } = await db
      .from("trip_checklist_items")
      .insert({
        trip_id: membership.tripId,
        member_id: membership.memberId,
        category,
        title,
        notes: notes || null,
        due_date: cleanDueDate(body.due_date),
        status,
        source: body.source === "suggested" ? "suggested" : "manual",
      })
      .select("id, trip_id, member_id, category, title, notes, due_date, status, source, created_at, updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar tarefa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
