import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { TRIAL_DIAS, trialExpiresAt } from "@/lib/billing";
import { memberForUserInTrip } from "@/lib/guards";
import { logInfo } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Comeca o teste gratis de 7 dias numa viagem.
 *
 * Uma vez por conta, e sem pedir cartao — no Pix nem existe cartao
 * guardado para cobrar depois. O teste acaba sozinho: a viagem tranca de
 * novo e nada do que foi salvo e apagado.
 *
 * So o organizador comeca, pela mesma razao do Passe: o acesso segue a
 * viagem, entao quem liga isso decide pelo grupo inteiro.
 */
export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const slug = String(body.trip_slug ?? "").trim();
    if (!slug) {
      return NextResponse.json({ error: "Escolha uma viagem para testar." }, { status: 400 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Você não participa desta viagem." }, { status: 403 });
    }
    if (!membership.isOrganizer) {
      return NextResponse.json(
        { error: "Só quem organiza a viagem pode começar o teste." },
        { status: 403 }
      );
    }

    // Uma por conta, para sempre. Nao ha coluna de controle: a propria
    // existencia de um teste anterior e a resposta.
    const { data: testeAnterior } = await db
      .from("trip_entitlements")
      .select("id, trip_id")
      .eq("purchaser_user_id", user.id)
      .eq("status", "trial")
      .maybeSingle();

    if (testeAnterior) {
      return NextResponse.json(
        {
          error:
            testeAnterior.trip_id === membership.tripId
              ? "Esta viagem já está no teste grátis."
              : "Você já usou seu teste grátis em outra viagem.",
        },
        { status: 409 }
      );
    }

    const { data: jaPago } = await db
      .from("trip_entitlements")
      .select("id")
      .eq("trip_id", membership.tripId)
      .eq("status", "paid")
      .maybeSingle();

    if (jaPago) {
      return NextResponse.json({ error: "Esta viagem já está liberada." }, { status: 400 });
    }

    const expiraEm = trialExpiresAt();

    const { error } = await db.from("trip_entitlements").insert({
      trip_id: membership.tripId,
      purchaser_user_id: user.id,
      plan: "trip_pass",
      status: "trial",
      access_expires_at: expiraEm,
    });
    if (error) throw error;

    logInfo({
      event: "teste_gratis_iniciado",
      route: "billing/trial",
      userId: user.id,
      tripId: membership.tripId,
    });

    return NextResponse.json({ expires_at: expiraEm, days: TRIAL_DIAS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao começar o teste.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
