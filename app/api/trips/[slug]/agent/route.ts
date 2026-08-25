import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { answerTravelAgentQuestion } from "@/lib/travel-agent";
import type { Itinerary } from "@/lib/types";

export const maxDuration = 35;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? "").trim();

    if (question.length < 3) {
      return NextResponse.json({ error: "Escreva uma pergunta para o agente." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para falar com o agente." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data: trip, error: tripError } = await db
      .from("trips")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (tripError) throw tripError;
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const [members, preferences, itineraries, expenses, ideas, vaultItems, checklistItems] = await Promise.all([
      db
        .from("members")
        .select("id, trip_id, name, is_organizer, color")
        .eq("trip_id", trip.id)
        .order("created_at"),
      db
        .from("preferences")
        .select("id, member_id, interests, restrictions, daily_budget, present_from, present_to")
        .eq("trip_id", trip.id),
      db
        .from("itineraries")
        .select("id, version, rationale, itinerary_days(*, itinerary_items(*))")
        .eq("trip_id", trip.id)
        .order("version", { ascending: false })
        .limit(1),
      db
        .from("expenses")
        .select("id, trip_id, payer_member_id, amount, description, split_member_ids, created_at")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: false }),
      db
        .from("ideas")
        .select("id, trip_id, member_id, title, notes, category, estimated_cost, status, created_at, updated_at")
        .eq("trip_id", trip.id)
        .order("updated_at", { ascending: false }),
      db
        .from("trip_vault_items")
        .select(
          "id, trip_id, member_id, kind, title, provider, confirmation_code, starts_at, ends_at, location, amount, currency, status, url, notes, created_at, updated_at"
        )
        .eq("trip_id", trip.id)
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      db
        .from("trip_checklist_items")
        .select("id, trip_id, member_id, category, title, notes, due_date, status, source, created_at, updated_at")
        .eq("trip_id", trip.id)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    if (members.error) throw members.error;
    if (preferences.error) throw preferences.error;
    if (itineraries.error) throw itineraries.error;
    if (expenses.error) throw expenses.error;
    if (ideas.error) throw ideas.error;
    if (vaultItems.error) throw vaultItems.error;
    if (checklistItems.error) throw checklistItems.error;

    const itinerary = (itineraries.data?.[0] ?? null) as unknown as Itinerary | null;

    if (itinerary) {
      itinerary.itinerary_days.sort((a, b) => a.position - b.position);
      for (const day of itinerary.itinerary_days) {
        day.itinerary_items.sort((a, b) => a.position - b.position);
      }
    }

    const answer = await answerTravelAgentQuestion(
      {
        trip,
        members: members.data ?? [],
        preferences: preferences.data ?? [],
        itinerary,
        expenses: expenses.data ?? [],
        ideas: ideas.data ?? [],
        vaultItems: vaultItems.data ?? [],
        checklistItems: checklistItems.data ?? [],
      },
      question
    );

    return NextResponse.json({ ok: true, ...answer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao falar com o agente.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
