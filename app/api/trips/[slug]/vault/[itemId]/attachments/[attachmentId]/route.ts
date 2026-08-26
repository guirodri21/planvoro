import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip, vaultItemForTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { VAULT_BUCKET } from "@/lib/vault-attachments";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 120;

type Ctx = { params: Promise<{ slug: string; itemId: string; attachmentId: string }> };

async function loadAttachment(req: Request, ctx: Ctx) {
  const { slug, itemId, attachmentId } = await ctx.params;

  const db = supabaseAdmin();
  const user = await getUserFromRequest(req, db);
  if (!user) {
    return { error: NextResponse.json({ error: "Entre na sua conta para abrir anexos." }, { status: 401 }) };
  }

  const membership = await memberForUserInTrip(db, slug, user.id);
  if (!membership) {
    return { error: NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 }) };
  }

  const item = await vaultItemForTrip(db, membership.tripId, itemId);
  if (!item) {
    return { error: NextResponse.json({ error: "Item nao encontrado." }, { status: 404 }) };
  }

  const { data: attachment, error } = await db
    .from("trip_vault_attachments")
    .select("id, storage_path, file_name, mime_type, member_id")
    .eq("id", attachmentId)
    .eq("item_id", itemId)
    .eq("trip_id", membership.tripId)
    .maybeSingle();
  if (error) throw error;

  if (!attachment) {
    return { error: NextResponse.json({ error: "Anexo nao encontrado." }, { status: 404 }) };
  }

  return { db, membership, item, attachment };
}

/** Devolve uma signed URL curta. O bucket e privado: o link expira em 2 minutos. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const loaded = await loadAttachment(req, ctx);
    if ("error" in loaded) return loaded.error;

    const { db, attachment } = loaded;

    const { data, error } = await db.storage
      .from(VAULT_BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, {
        download: attachment.file_name,
      });
    if (error) throw error;
    if (!data?.signedUrl) {
      return NextResponse.json({ error: "Nao foi possivel abrir este anexo." }, { status: 404 });
    }

    return NextResponse.json({ url: data.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir anexo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const loaded = await loadAttachment(req, ctx);
    if ("error" in loaded) return loaded.error;

    const { db, membership, item, attachment } = loaded;

    const canManage =
      membership.isOrganizer ||
      attachment.member_id === membership.memberId ||
      item.member_id === membership.memberId;

    if (!canManage) {
      return NextResponse.json(
        { error: "So o organizador ou quem enviou o anexo pode remover." },
        { status: 403 }
      );
    }

    const { error: storageError } = await db.storage
      .from(VAULT_BUCKET)
      .remove([attachment.storage_path]);
    if (storageError) throw storageError;

    const { error } = await db.from("trip_vault_attachments").delete().eq("id", attachment.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover anexo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
