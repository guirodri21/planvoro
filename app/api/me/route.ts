import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { logError, logInfo, startTimer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { VAULT_BUCKET } from "@/lib/vault-attachments";

export const runtime = "nodejs";

/**
 * Exclusao de conta (LGPD art. 18, VI).
 *
 * Ordem importa. As viagens organizadas pela pessoa caem por cascade,
 * levando junto membros, roteiro, Cofre e anexos — mas o cascade so alcanca
 * linhas do banco, entao os objetos no Storage precisam sair antes, senao
 * viram arquivo orfao que ninguem mais consegue listar nem apagar.
 *
 * Viagens de que a pessoa so participava continuam existindo para o resto
 * do grupo: apagar a viagem dos outros nao e direito de quem sai.
 */
export async function DELETE(req: Request) {
  const elapsed = startTimer();

  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const confirmation = await req.json().catch(() => ({}));
    if (String(confirmation?.confirm ?? "").trim().toUpperCase() !== "APAGAR") {
      return NextResponse.json(
        { error: "Digite APAGAR para confirmar a exclusao da conta." },
        { status: 400 }
      );
    }

    // Viagens em que a pessoa e organizadora: essas somem inteiras.
    const { data: organized, error: organizedError } = await db
      .from("members")
      .select("trip_id")
      .eq("user_id", user.id)
      .eq("is_organizer", true);
    if (organizedError) throw organizedError;

    const tripIds = [...new Set((organized ?? []).map((row) => row.trip_id))];

    if (tripIds.length) {
      const { data: attachments, error: attachmentsError } = await db
        .from("trip_vault_attachments")
        .select("storage_path")
        .in("trip_id", tripIds);
      if (attachmentsError) throw attachmentsError;

      if (attachments?.length) {
        const { error: storageError } = await db.storage
          .from(VAULT_BUCKET)
          .remove(attachments.map((row) => row.storage_path));
        if (storageError) throw storageError;
      }

      const { error: tripsError } = await db.from("trips").delete().in("id", tripIds);
      if (tripsError) throw tripsError;
    }

    // Solta a pessoa das viagens alheias sem apagar o historico do grupo.
    const { error: membershipError } = await db
      .from("members")
      .delete()
      .eq("user_id", user.id);
    if (membershipError) throw membershipError;

    const { error: authError } = await db.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    logInfo({
      event: "account_deleted",
      route: "me",
      userId: user.id,
      deletedTrips: tripIds.length,
      durationMs: elapsed(),
    });

    return NextResponse.json({ ok: true, deleted_trips: tripIds.length });
  } catch (e) {
    logError({ event: "account_deletion_failed", route: "me", durationMs: elapsed(), error: e });
    const msg = e instanceof Error ? e.message : "Erro ao apagar a conta.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
