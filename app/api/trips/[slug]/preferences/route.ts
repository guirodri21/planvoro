import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json();
    const { interests, restrictions, daily_budget, present_from, present_to } = body;

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para salvar preferencias." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce ainda nao entrou nesta viagem." }, { status: 403 });
    }

    const { error } = await db.from("preferences").upsert(
      {
        trip_id: membership.tripId,
        member_id: membership.memberId,
        interests: interests ?? [],
        restrictions: restrictions ?? [],
        daily_budget: daily_budget || null,
        present_from: present_from || null,
        present_to: present_to || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar preferencias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
