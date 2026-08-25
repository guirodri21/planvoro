import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();

    const { data: trip, error } = await db.from("trips").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!trip) return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });

    const user = await getUserFromRequest(req, db);

    const [members, preferences, itineraries, expenses, ideas, vaultItems, checklistItems, viewerMember] = await Promise.all([
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
        .order("created_at", { ascending: false }),
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
      user
        ? db
            .from("members")
            .select("id")
            .eq("trip_id", trip.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (members.error) throw members.error;
    if (preferences.error) throw preferences.error;
    if (itineraries.error) throw itineraries.error;
    if (expenses.error) throw expenses.error;
    if (ideas.error) throw ideas.error;
    if (vaultItems.error) throw vaultItems.error;
    if (checklistItems.error) throw checklistItems.error;
    if (viewerMember.error) throw viewerMember.error;

    type DayRow = { position: number; itinerary_items: { id: string; position: number }[] };
    const itinerary = (itineraries.data?.[0] ?? null) as
      | ({ itinerary_days: DayRow[] } & Record<string, unknown>)
      | null;

    if (itinerary) {
      itinerary.itinerary_days.sort((a: DayRow, b: DayRow) => a.position - b.position);
      for (const day of itinerary.itinerary_days) {
        day.itinerary_items.sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position
        );
      }
    }

    // Votos e comentarios dos itens do roteiro atual.
    // Buscamos pelos ids dos itens para nao trazer dados de versoes antigas.
    let votes: unknown[] = [];
    let comments: unknown[] = [];
    let ideaVotes: unknown[] = [];

    if (itinerary) {
      const itemIds = itinerary.itinerary_days.flatMap((d) =>
        d.itinerary_items.map((i) => i.id)
      );

      if (itemIds.length) {
        const [v, c] = await Promise.all([
          db.from("votes").select("item_id, member_id, value").in("item_id", itemIds),
          db
            .from("comments")
            .select("id, item_id, member_id, body, created_at")
            .in("item_id", itemIds)
            .order("created_at"),
        ]);
        if (v.error) throw v.error;
        if (c.error) throw c.error;
        votes = v.data ?? [];
        comments = c.data ?? [];
      }
    }

    const ideaIds = (ideas.data ?? []).map((idea) => idea.id);
    if (ideaIds.length) {
      const { data: ideaVoteRows, error: ideaVoteError } = await db
        .from("idea_votes")
        .select("idea_id, member_id, value")
        .in("idea_id", ideaIds);
      if (ideaVoteError) throw ideaVoteError;
      ideaVotes = ideaVoteRows ?? [];
    }

    return NextResponse.json({
      trip,
      members: members.data ?? [],
      preferences: preferences.data ?? [],
      itinerary,
      votes,
      comments,
      expenses: expenses.data ?? [],
      ideas: ideas.data ?? [],
      vault_items: vaultItems.data ?? [],
      checklist_items: checklistItems.data ?? [],
      idea_votes: ideaVotes,
      viewer_member_id: viewerMember.data?.id ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar a viagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
