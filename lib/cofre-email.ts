import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reserveAiUsage } from "./ai-limits";
import { logError, logInfo } from "./logger";
import { resendClient, resendFromEmail } from "./resend";
import { absoluteUrl } from "./site";
import { resolveTripAccess } from "./trip-access";
import type { Trip } from "./types";
import { importVaultDraftFromText, type ImportFile } from "./vault-import";
import { buildStoragePath, isAllowedVaultMime, normalizeMimeType, safeFileName } from "./vault-attachments";
import { VAULT_BUCKET } from "./vault-attachments";

/**
 * Encaminhar e-mail de reserva para o Cofre.
 *
 * Cada viagem tem um endereco: <slug>.<assinatura>@<COFRE_EMAIL_DOMAIN>.
 * A assinatura e um HMAC do slug: o endereco nao da para adivinhar a
 * partir do link da viagem, e nao precisa de coluna nova no banco.
 *
 * Quem encaminha precisa ser participante da viagem (o remetente tem de
 * ser o e-mail de uma conta do grupo). Endereco vazado nao vira porta de
 * spam para dentro do Cofre, e remetente desconhecido nao recebe resposta
 * — responder a estranho e o que transforma um endereco em alvo.
 *
 * O texto do e-mail vai para a IA como dado, nao como instrucao: o mesmo
 * importador do "colar confirmacao", que so extrai campos.
 */

const MIN_TEXTO = 40;
const MAX_TEXTO = 12_000;
const MAX_ANEXO = 8 * 1024 * 1024;

function segredo() {
  return process.env.COFRE_EMAIL_SECRET?.trim() || "";
}

export function dominioCofre() {
  return process.env.COFRE_EMAIL_DOMAIN?.trim().toLowerCase() || "";
}

function assinatura(slug: string) {
  return createHmac("sha256", segredo()).update(`cofre:${slug}`).digest("hex").slice(0, 10);
}

/** Endereco do Cofre da viagem, ou null quando o recurso nao esta configurado. */
export function enderecoDoCofre(slug: string) {
  const dominio = dominioCofre();
  if (!dominio || !segredo()) return null;
  return `${slug}.${assinatura(slug)}@${dominio}`;
}

/** Slug da viagem a partir de um destinatario, conferindo a assinatura. */
export function slugDoEndereco(endereco: string) {
  const dominio = dominioCofre();
  if (!dominio || !segredo()) return null;
  const limpo = extrairEmail(endereco);
  const [local, host] = limpo.split("@");
  if (host !== dominio || !local) return null;
  const m = /^([a-z0-9-]{1,80})\.([a-f0-9]{10})$/.exec(local);
  if (!m) return null;
  const esperado = Buffer.from(assinatura(m[1]));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}

/** "Ana <ana@x.com>" -> "ana@x.com". */
export function extrairEmail(valor: string) {
  const m = /<([^>]+)>/.exec(valor);
  return (m ? m[1] : valor).trim().toLowerCase();
}

/** HTML de e-mail para texto corrido, o suficiente para a IA ler. */
export function htmlParaTexto(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

type Recebido = {
  email_id: string;
  from: string;
  to: string[];
  received_for?: string[];
  subject: string;
};

async function responder(para: string, assunto: string, linhas: string[], link?: { texto: string; url: string }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const corpo = [...linhas, ...(link ? ["", `${link.texto}: ${link.url}`] : []), "", "— Planvoro"].join("\n");
    await resendClient().emails.send({ from: resendFromEmail(), to: [para], subject: assunto, text: corpo });
  } catch (e) {
    logError({ event: "cofre_email_resposta_falhou", route: "cofre/email", error: e });
  }
}

async function marcar(db: SupabaseClient, emailId: string, campos: Record<string, unknown>) {
  await db.from("cofre_emails").update(campos).eq("email_id", emailId);
}

/**
 * Processa um e-mail recebido. Roda depois que o webhook ja respondeu
 * (a IA leva ate 25 s, e o Resend tenta de novo se a resposta demora).
 */
export async function processarEmailDoCofre(db: SupabaseClient, recebido: Recebido) {
  const destinatarios = [...recebido.to, ...(recebido.received_for ?? [])];
  const slug = destinatarios.map(slugDoEndereco).find(Boolean) ?? null;
  if (!slug) {
    await marcar(db, recebido.email_id, { situacao: "endereco_invalido" });
    return;
  }

  const { data: trip } = await db
    .from("trips")
    .select("id, slug, destination, start_date, end_date")
    .eq("slug", slug)
    .maybeSingle();
  if (!trip) {
    await marcar(db, recebido.email_id, { situacao: "viagem_inexistente" });
    return;
  }
  await marcar(db, recebido.email_id, { trip_id: trip.id });

  // O remetente precisa ser uma conta do grupo.
  const remetente = extrairEmail(recebido.from);
  const { data: membros } = await db
    .from("members")
    .select("id, user_id, is_organizer")
    .eq("trip_id", trip.id)
    .not("user_id", "is", null);
  let membro: { id: string; user_id: string; is_organizer: boolean } | null = null;
  for (const m of membros ?? []) {
    const { data } = await db.auth.admin.getUserById(m.user_id as string);
    if (data.user?.email?.toLowerCase() === remetente) {
      membro = m as { id: string; user_id: string; is_organizer: boolean };
      break;
    }
  }
  if (!membro) {
    await marcar(db, recebido.email_id, { situacao: "remetente_desconhecido" });
    logInfo({ event: "cofre_email_ignorado", route: "cofre/email", motivo: "remetente", tripId: trip.id });
    return;
  }

  const linkCofre = { texto: "Abrir o Cofre", url: absoluteUrl(`/v/${trip.slug}#cofre`) };

  const acesso = await resolveTripAccess(db, trip.id);
  if (!acesso.unlocked) {
    await marcar(db, recebido.email_id, { situacao: "viagem_trancada" });
    await responder(
      remetente,
      `Não guardamos: o Cofre de ${trip.destination} está trancado`,
      [
        `Recebemos o e-mail "${recebido.subject}", mas o Cofre da viagem ${trip.destination} faz parte do Passe da viagem.`,
        membro.is_organizer
          ? "Libere a viagem (ou comece o teste grátis de 7 dias) e encaminhe o e-mail de novo."
          : "Peça a quem organiza a viagem para liberá-la — você não paga nada — e encaminhe de novo.",
      ],
      { texto: "Ver opções", url: absoluteUrl(`/planos?viagem=${encodeURIComponent(trip.slug)}`) }
    );
    return;
  }

  const limite = await reserveAiUsage(db, { kind: "vault_import", userId: membro.user_id, tripId: trip.id });
  if (limite) {
    await marcar(db, recebido.email_id, { situacao: "limite" });
    await responder(remetente, "Não guardamos sua reserva agora", [limite], linkCofre);
    return;
  }

  // Conteudo: o corpo do e-mail e, se houver, o primeiro anexo PDF ou imagem.
  const { data: email, error: erroEmail } = await resendClient().emails.receiving.get(recebido.email_id);
  if (erroEmail || !email) throw new Error(erroEmail?.message ?? "e-mail recebido não encontrado");

  const corpo = (email.text?.trim() || htmlParaTexto(email.html ?? "")).slice(0, MAX_TEXTO);
  let arquivo: (ImportFile & { nome: string; tamanho: number }) | null = null;
  const anexo = email.attachments.find(
    (a) => isAllowedVaultMime(normalizeMimeType(a.content_type)) && a.size > 0 && a.size <= MAX_ANEXO
  );
  if (anexo) {
    const { data: meta } = await resendClient().emails.receiving.attachments.get({
      emailId: recebido.email_id,
      id: anexo.id,
    });
    if (meta?.download_url) {
      const resposta = await fetch(meta.download_url, { signal: AbortSignal.timeout(15_000) });
      if (resposta.ok) {
        const bytes = Buffer.from(await resposta.arrayBuffer());
        if (bytes.length <= MAX_ANEXO) {
          arquivo = {
            mimeType: normalizeMimeType(anexo.content_type),
            base64: bytes.toString("base64"),
            nome: anexo.filename ?? "reserva",
            tamanho: bytes.length,
          };
        }
      }
    }
  }

  if (corpo.length < MIN_TEXTO && !arquivo) {
    await marcar(db, recebido.email_id, { situacao: "sem_conteudo" });
    await responder(
      remetente,
      "Não encontramos a reserva no e-mail",
      ["O e-mail chegou quase vazio. Encaminhe a confirmação completa (com o texto ou o PDF da reserva)."],
      linkCofre
    );
    return;
  }

  const texto = `Assunto: ${recebido.subject}\n\n${corpo}`.slice(0, MAX_TEXTO);
  const rascunho = await importVaultDraftFromText(trip as Pick<Trip, "destination" | "start_date" | "end_date">, texto, arquivo);

  const aviso = "Importado de um e-mail encaminhado — confira os dados com a confirmação original.";
  const { data: item, error: erroItem } = await db
    .from("trip_vault_items")
    .insert({
      trip_id: trip.id,
      member_id: membro.id,
      kind: rascunho.kind,
      title: rascunho.title,
      provider: rascunho.provider,
      confirmation_code: rascunho.confirmation_code,
      starts_at: rascunho.starts_at,
      ends_at: rascunho.ends_at,
      location: rascunho.location,
      amount: rascunho.amount,
      currency: rascunho.currency,
      status: rascunho.status,
      url: rascunho.url,
      notes: [rascunho.notes, aviso].filter(Boolean).join("\n\n").slice(0, 1200),
    })
    .select("id")
    .single();
  if (erroItem) throw erroItem;

  // O PDF ou print que veio junto fica anexado ao item, como se tivesse
  // sido enviado pela tela. Falhar aqui nao desfaz o item.
  if (arquivo) {
    try {
      const mime = arquivo.mimeType as Parameters<typeof buildStoragePath>[3];
      const anexoId = randomUUID();
      const caminho = buildStoragePath(trip.id, item.id, anexoId, mime);
      const { error: erroUpload } = await db.storage
        .from(VAULT_BUCKET)
        .upload(caminho, Buffer.from(arquivo.base64, "base64"), { contentType: mime, upsert: false });
      if (erroUpload) throw erroUpload;
      const { error: erroAnexo } = await db.from("trip_vault_attachments").insert({
        id: anexoId,
        trip_id: trip.id,
        item_id: item.id,
        member_id: membro.id,
        storage_path: caminho,
        file_name: safeFileName(arquivo.nome, mime),
        mime_type: mime,
        size_bytes: arquivo.tamanho,
      });
      if (erroAnexo) {
        await db.storage.from(VAULT_BUCKET).remove([caminho]);
        throw erroAnexo;
      }
    } catch (e) {
      logError({ event: "cofre_email_anexo_falhou", route: "cofre/email", tripId: trip.id, error: e });
    }
  }

  await marcar(db, recebido.email_id, { situacao: "importado", vault_item_id: item.id });
  logInfo({
    event: "cofre_email_importado",
    route: "cofre/email",
    tripId: trip.id,
    kind: rascunho.kind,
    confidence: rascunho.confidence,
    comAnexo: Boolean(arquivo),
  });

  const faltando = rascunho.missing_fields.length
    ? `Não encontramos: ${rascunho.missing_fields.join(", ")}. Complete no Cofre.`
    : "Confira os dados no Cofre.";
  await responder(
    remetente,
    `Guardado no Cofre: ${rascunho.title}`,
    [`"${rascunho.title}" foi guardado no Cofre da viagem ${trip.destination}.`, rascunho.summary, faltando].filter(Boolean),
    linkCofre
  );
}
