import { NextResponse } from "next/server";
import { logError, logInfo, startTimer } from "@/lib/logger";
import { getUserFromRequest } from "@/lib/auth";
import { sendTripInviteEmails } from "@/lib/email";
import { memberForUserInTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_RECIPIENTS = 12;
const MAX_MESSAGE = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmails(value: unknown) {
  const raw = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  const unique = new Map<string, string>();

  for (const piece of raw.split(/[\n,;]+/)) {
    const email = piece.trim();
    if (!email) continue;
    unique.set(email.toLowerCase(), email);
  }

  return [...unique.values()];
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const elapsed = startTimer();

  try {
    const { slug } = await ctx.params;
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para enviar convites." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const body = await req.json();
    const recipientEmails = normalizeEmails(body.emails);
    const message = String(body.message ?? "").trim();

    if (!recipientEmails.length) {
      return NextResponse.json({ error: "Digite ao menos um e-mail." }, { status: 400 });
    }
    if (recipientEmails.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Envie no maximo ${MAX_RECIPIENTS} convites por vez.` },
        { status: 400 }
      );
    }
    if (!recipientEmails.every((email) => EMAIL_RE.test(email))) {
      return NextResponse.json({ error: "Tem e-mail invalido na lista." }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "Mensagem muito longa." }, { status: 400 });
    }

    const [{ data: trip, error: tripError }, { data: member, error: memberError }] =
      await Promise.all([
        db
          .from("trips")
          .select("destination, start_date, end_date, party_size, is_solo")
          .eq("id", membership.tripId)
          .single(),
        db.from("members").select("name").eq("id", membership.memberId).single(),
      ]);

    if (tripError) throw tripError;
    if (memberError) throw memberError;

    const origin = new URL(req.url).origin;
    const result = await sendTripInviteEmails({
      destination: trip.destination,
      inviterName: member.name,
      inviteUrl: `${origin}/v/${slug}`,
      publicUrl: `${origin}/r/${slug}`,
      message,
      recipientEmails,
      trip,
    });

    // So a contagem: endereco de e-mail e dado pessoal, nao vai para o log.
    logInfo({
      event: "trip_invites_sent",
      route: "trips/[slug]/invite-email",
      tripId: membership.tripId,
      recipientCount: recipientEmails.length,
      durationMs: elapsed(),
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar os convites.";
    logError({
      event: "trip_invites_failed",
      route: "trips/[slug]/invite-email",
      durationMs: elapsed(),
      error: e,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
