import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { PROVEDOR_TESTE_CONTA, TRIAL_DIAS, proPagoAtivo, testeDaConta, trialExpiresAt } from "@/lib/billing";
import { memberForUserInTrip } from "@/lib/guards";
import { logInfo, logError } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

/** Teste sem viagem: libera a conta por 7 dias. Uma vez por conta. */
async function testeDaContaInteira(db: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data: testeEmViagem } = await db
    .from("trip_entitlements")
    .select("id")
    .eq("purchaser_user_id", userId)
    .eq("status", "trial")
    .limit(1)
    .maybeSingle();
  if (testeEmViagem) {
    return NextResponse.json({ error: "Você já usou seu teste grátis em uma viagem." }, { status: 409 });
  }

  const expiraEm = trialExpiresAt();
  const { error } = await db.from("user_subscriptions").upsert(
    {
      user_id: userId,
      status: "trialing",
      provider: PROVEDOR_TESTE_CONTA,
      current_period_end: expiraEm,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  logInfo({ event: "teste_gratis_iniciado", route: "billing/trial", userId, escopo: "conta" });
  return NextResponse.json({ expires_at: expiraEm, days: TRIAL_DIAS, escopo: "conta" });
}

/**
 * Comeca o teste gratis de 7 dias numa viagem.
 *
 * Uma vez por conta, e sem pedir cartao — no Pix nem existe cartao
 * guardado para cobrar depois. O teste acaba sozinho: a viagem tranca de
 * novo e nada do que foi salvo e apagado.
 *
 * So o organizador comeca, pela mesma razao do Passe: o acesso segue a
 * viagem, entao quem liga isso decide pelo grupo inteiro.
 *
 * Sem `trip_slug`, o teste vale para a conta (ver `testeDaConta` em
 * lib/billing.ts): e o caminho de quem ainda nao organiza viagem. Antes,
 * esse clique nao fazia nada.
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

    const { data: assinatura } = await db
      .from("user_subscriptions")
      .select("status, provider, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (proPagoAtivo(assinatura)) {
      return NextResponse.json({ error: "Sua conta já está no Pro: tudo já está liberado." }, { status: 400 });
    }
    if (testeDaConta(assinatura).usado) {
      return NextResponse.json({ error: "Você já usou seu teste grátis." }, { status: 409 });
    }

    if (!slug) return testeDaContaInteira(db, user.id);

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
    logError({ event: "api_falhou", route: "/api/billing/trial", error: e });
    const msg = e instanceof Error ? e.message : "Erro ao começar o teste.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
