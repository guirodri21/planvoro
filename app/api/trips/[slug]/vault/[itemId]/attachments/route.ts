import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip, vaultItemForTrip } from "@/lib/guards";
import { supabaseAdmin } from "@/lib/supabase";
import { lockedMessage, resolveTripAccess } from "@/lib/trip-access";
import {
  VAULT_ATTACHMENT_MAX_BYTES,
  VAULT_BUCKET,
  buildStoragePath,
  isAllowedVaultMime,
  normalizeMimeType,
  safeFileName,
} from "@/lib/vault-attachments";

export const runtime = "nodejs";

const SELECT_FIELDS = "id, trip_id, item_id, member_id, file_name, mime_type, size_bytes, created_at";
const MAX_ATTACHMENTS_PER_ITEM = 12;

/**
 * Upload de anexo para um item do Cofre.
 *
 * O arquivo vai para um bucket privado. Nada do que o navegador manda
 * (nome, extensao, content-type) e usado para montar o caminho no Storage:
 * o path vem de tripId/itemId/uuid, e o nome original fica so como rotulo.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string; itemId: string }> }) {
  try {
    const { slug, itemId } = await ctx.params;

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para anexar arquivos." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const access = await resolveTripAccess(db, membership.tripId);
    if (!access.unlocked) {
      return NextResponse.json({ error: lockedMessage("Anexar arquivos") }, { status: 402 });
    }

    const item = await vaultItemForTrip(db, membership.tripId, itemId);
    if (!item) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });

    if (!membership.isOrganizer && item.member_id !== membership.memberId) {
      return NextResponse.json(
        { error: "So o organizador ou quem salvou este item pode anexar arquivos." },
        { status: 403 }
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
      return NextResponse.json({ error: "Escolha um arquivo para anexar." }, { status: 400 });
    }

    if (!file.size) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }
    if (file.size > VAULT_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo maior que 15 MB." }, { status: 400 });
    }

    const mimeType = normalizeMimeType(file.type);
    if (!isAllowedVaultMime(mimeType)) {
      return NextResponse.json(
        { error: "Formato nao aceito. Envie PDF, JPG, PNG, WEBP ou HEIC." },
        { status: 400 }
      );
    }

    const { count, error: countError } = await db
      .from("trip_vault_attachments")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId);
    if (countError) throw countError;

    if ((count ?? 0) >= MAX_ATTACHMENTS_PER_ITEM) {
      return NextResponse.json(
        { error: `Este item ja tem ${MAX_ATTACHMENTS_PER_ITEM} anexos.` },
        { status: 400 }
      );
    }

    const attachmentId = randomUUID();
    const storagePath = buildStoragePath(membership.tripId, itemId, attachmentId, mimeType);

    const { error: uploadError } = await db.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await db
      .from("trip_vault_attachments")
      .insert({
        id: attachmentId,
        trip_id: membership.tripId,
        item_id: itemId,
        member_id: membership.memberId,
        storage_path: storagePath,
        file_name: safeFileName(file.name, mimeType),
        mime_type: mimeType,
        size_bytes: file.size,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      // Sem a linha o objeto viraria lixo invisivel no bucket.
      await db.storage.from(VAULT_BUCKET).remove([storagePath]);
      throw error;
    }

    return NextResponse.json({ attachment: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao anexar arquivo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
