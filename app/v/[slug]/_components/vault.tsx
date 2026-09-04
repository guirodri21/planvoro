"use client";

/**
 * Aba Cofre: reservas, documentos e anexos da viagem.
 *
 * Saiu do page.tsx porque sozinha passava de 900 linhas — mais que muitos
 * arquivos inteiros do projeto.
 */

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  TRIP_VAULT_KINDS,
  TRIP_VAULT_STATUSES,
  type Member,
  type Trip,
  type TripVaultAttachment,
  type TripVaultItem,
  type TripVaultKind,
  type TripVaultStatus,
} from "@/lib/types";
import {
  VAULT_ATTACHMENT_MAX_BYTES,
  VAULT_ATTACHMENT_MIME_TYPES,
  formatFileSize,
} from "@/lib/vault-attachments";
import { authHeaders, authJsonHeaders, readApiJson } from "../_lib/api";
import {
  formatCurrency,
  formatMoney,
  pluralItens,
  formatVaultDate,
  formatVaultRange,
  toDateTimeLocalValue,
  vaultKindLabel,
  vaultStatusLabel,
} from "../_lib/format";
import { isOutsideTripDates } from "../_lib/format";
import { Confirmar } from "@/components/confirmar";
import {
  MAX_PENDING_ATTACHMENTS,
  type VaultImportDraft,
  type VaultImportResult,
} from "../_lib/workspace-types";

/**
 * Upload de um anexo. Usado tanto pelo card de um item ja salvo quanto pelo
 * formulario de criacao, que segura os arquivos ate o item existir no banco.
 */
export async function uploadVaultAttachment(
  slug: string,
  itemId: string,
  file: File,
  accessToken: string
) {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`/api/trips/${slug}/vault/${itemId}/attachments`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body,
  });
  const json = await readApiJson<{ attachment?: TripVaultAttachment; error?: string }>(res);
  if (!res.ok) throw new Error(json.error ?? "Não foi possível anexar o arquivo.");

  // So tipo e tamanho: nome de arquivo pode carregar dado pessoal.
  track("cofre_anexo_enviado", { mime: file.type, bytes: file.size });

  return json.attachment;
}

export function VaultAttachmentsBlock({
  accessToken,
  slug,
  itemId,
  attachments,
  canManage,
  canRemove,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  itemId: string;
  attachments: TripVaultAttachment[];
  canManage: boolean;
  canRemove: boolean;
  onChange: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    if (!accessToken || uploading) return;

    if (file.size > VAULT_ATTACHMENT_MAX_BYTES) {
      setError(`Arquivo maior que ${formatFileSize(VAULT_ATTACHMENT_MAX_BYTES)}.`);
      return;
    }

    setUploading(true);
    setError("");

    try {
      await uploadVaultAttachment(slug, itemId, file, accessToken);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao anexar arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /**
   * O bucket e privado: pedimos ao servidor uma signed URL curta na hora do
   * clique, em vez de guardar link permanente no HTML.
   */
  async function openAttachment(attachment: TripVaultAttachment, download = false) {
    if (!accessToken || workingId) return;

    setWorkingId(attachment.id);
    setError("");

    try {
      const query = download ? "?download=1" : "";
      const res = await fetch(
        `/api/trips/${slug}/vault/${itemId}/attachments/${attachment.id}${query}`,
        { headers: authHeaders(accessToken) }
      );
      const json = await readApiJson<{ url?: string; error?: string }>(res);
      if (!res.ok || !json.url) throw new Error(json.error ?? "Não foi possível abrir o anexo.");

      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir anexo.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeAttachment(attachment: TripVaultAttachment) {
    if (!accessToken || workingId) return;

    setWorkingId(attachment.id);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}/attachments/${attachment.id}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível remover o anexo.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover anexo.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="vault-attachments">
      <div className="vault-attachments-head">
        <span className="stat-label">Anexos</span>
        {canManage && (
          <>
            <input
              ref={inputRef}
              className="hidden-file"
              type="file"
              accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !accessToken}
            >
              {uploading ? "Enviando..." : "Anexar arquivo"}
            </button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="tiny">
          PDF, print ou comprovante ficam guardados aqui, visiveis so para quem participa da viagem.
        </p>
      ) : (
        <ul className="vault-attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <div>
                <strong>{attachment.file_name}</strong>
                <small>{formatFileSize(attachment.size_bytes)}</small>
              </div>
              <div>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => openAttachment(attachment)}
                  disabled={workingId === attachment.id || !accessToken}
                >
                  Abrir
                </button>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => openAttachment(attachment, true)}
                  disabled={workingId === attachment.id || !accessToken}
                >
                  Baixar
                </button>
                {canRemove && (
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => removeAttachment(attachment)}
                    disabled={workingId === attachment.id || !accessToken}
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function TravelVaultView({
  accessToken,
  slug,
  trip,
  items,
  attachments,
  members,
  me,
  locked,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  items: TripVaultItem[];
  attachments: TripVaultAttachment[];
  members: Member[];
  me: Member;
  locked: boolean;
  onChange: () => Promise<void> | void;
}) {
  const emptyForm = {
    kind: "flight" as TripVaultKind,
    status: "saved" as TripVaultStatus,
    title: "",
    provider: "",
    confirmation_code: "",
    starts_at: "",
    ends_at: "",
    location: "",
    amount: "",
    currency: "BRL",
    url: "",
    notes: "",
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  /** Item aguardando confirmacao de remocao. Vazio quando nao ha dialogo. */
  const [confirmarRemocao, setConfirmarRemocao] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<VaultImportResult | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  // Arquivos escolhidos antes de o item existir. Sobem logo depois do insert.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingPending, setUploadingPending] = useState(false);
  const newItemFileRef = useRef<HTMLInputElement | null>(null);

  const totalKnown = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const attentionCount = items.filter((item) => item.status === "attention").length;
  const activeItems = items.filter((item) => item.status !== "canceled");
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.starts_at ? new Date(a.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.starts_at ? new Date(b.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const upcomingItems = sortedItems
    .filter((item) => item.status !== "canceled" && item.starts_at)
    .slice(0, 4);
  const hasTravelMovement = activeItems.some((item) => item.kind === "flight" || item.kind === "transport");
  const hasLodging = activeItems.some((item) => item.kind === "lodging");
  const hasDocument = activeItems.some((item) => item.kind === "visa" || item.kind === "document");
  const reservedNotPaidCount = activeItems.filter((item) => item.status === "reserved").length;
  const outsideTripCount = activeItems.filter((item) => isOutsideTripDates(item, trip)).length;
  const vaultInsights = [
    !hasTravelMovement && {
      tone: "warn",
      title: "Transporte ainda solto",
      body: "Guarde passagem, trem, transfer ou carro para o grupo saber como chega e sai.",
    },
    !hasLodging && {
      tone: "warn",
      title: "Hospedagem sem registro",
      body: "Quando escolher hotel ou Airbnb, salve endereço, check-in e código aqui.",
    },
    !hasDocument && {
      tone: "neutral",
      title: "Documentos e regras",
      body: "Vale guardar visto, seguro, apolice, pasta de documentos ou requisitos de entrada.",
    },
    attentionCount > 0 && {
      tone: "warn",
      title: `${attentionCount} ${pluralItens(attentionCount)} para conferir`,
      body: "Revise itens marcados como atenção antes de fechar o roteiro.",
    },
    reservedNotPaidCount > 0 && {
      tone: "neutral",
      title: `${reservedNotPaidCount} reserva${reservedNotPaidCount === 1 ? "" : "s"} sem pago`,
      body: "Se já foi pago, marque como pago para o custo conhecido ficar mais confiavel.",
    },
    outsideTripCount > 0 && {
      tone: "warn",
      title: "Data fora da viagem",
      body: "Existe item com data antes ou depois do período da viagem. Pode ser fuso, conexão ou erro.",
    },
  ].filter(Boolean) as Array<{ tone: "warn" | "neutral"; title: string; body: string }>;

  function updateForm(next: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId("");
    setImportError("");
    setImportResult(null);
    setPendingFiles([]);
    if (newItemFileRef.current) newItemFileRef.current.value = "";
  }

  function addPendingFiles(files: File[]) {
    setError("");

    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > VAULT_ATTACHMENT_MAX_BYTES) {
        setError(`"${file.name}" passa de ${formatFileSize(VAULT_ATTACHMENT_MAX_BYTES)}.`);
        continue;
      }
      accepted.push(file);
    }

    setPendingFiles((current) => [...current, ...accepted].slice(0, MAX_PENDING_ATTACHMENTS));
    if (newItemFileRef.current) newItemFileRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, position) => position !== index));
  }

  function startEditing(item: TripVaultItem) {
    setEditingId(item.id);
    setError("");
    setPendingFiles([]);
    setImportError("");
    setImportResult(null);
    setForm({
      kind: item.kind,
      status: item.status,
      title: item.title,
      provider: item.provider ?? "",
      confirmation_code: item.confirmation_code ?? "",
      starts_at: toDateTimeLocalValue(item.starts_at),
      ends_at: toDateTimeLocalValue(item.ends_at),
      location: item.location ?? "",
      amount: item.amount == null ? "" : String(item.amount),
      currency: item.currency,
      url: item.url ?? "",
      notes: item.notes ?? "",
    });
  }

  function itemPayload() {
    return {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
  }

  function applyImportDraft(draft: VaultImportDraft) {
    setEditingId("");
    setError("");
    setForm({
      kind: draft.kind,
      status: draft.status,
      title: draft.title,
      provider: draft.provider ?? "",
      confirmation_code: draft.confirmation_code ?? "",
      starts_at: toDateTimeLocalValue(draft.starts_at),
      ends_at: toDateTimeLocalValue(draft.ends_at),
      location: draft.location ?? "",
      amount: draft.amount == null ? "" : String(draft.amount),
      currency: draft.currency,
      url: draft.url ?? "",
      notes: draft.notes ?? "",
    });
    setImportResult({
      confidence: draft.confidence,
      missing_fields: draft.missing_fields,
      summary: draft.summary,
    });
  }

  /**
   * Le um PDF ou print da confirmacao.
   *
   * O arquivo vai so para leitura: nada e salvo no Cofre ate a pessoa
   * revisar o rascunho e clicar em guardar, igual ao texto colado.
   */
  async function importFromFile(file: File) {
    if (!accessToken || importing) return;

    setImporting(true);
    setImportError("");
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      if (importText.trim()) body.append("text", importText.trim());

      const res = await fetch(`/api/trips/${slug}/vault/import`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body,
      });
      const json = await readApiJson<{ draft?: VaultImportDraft; error?: string }>(res);
      if (!res.ok || !json.draft) {
        if (res.status === 429) track("limite_atingido", { acao: "importacao_cofre" });
        throw new Error(json.error ?? "Não foi possível ler esse arquivo.");
      }

      track("cofre_importacao_usada", { confianca: json.draft.confidence, origem: "arquivo" });
      applyImportDraft(json.draft);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro ao ler o arquivo.");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  async function importReservation() {
    if (!accessToken || importing) return;

    const text = importText.trim();
    if (text.length < 40) {
      setImportError("Cole um email, recibo ou confirmação com mais detalhes.");
      return;
    }

    setImporting(true);
    setImportError("");
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/import`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ text }),
      });
      const json = await readApiJson<{ draft?: VaultImportDraft; error?: string }>(res);
      if (!res.ok || !json.draft) {
        if (res.status === 429) track("limite_atingido", { acao: "importacao_cofre" });
        throw new Error(json.error ?? "Não foi possível importar esse texto.");
      }

      track("cofre_importacao_usada", { confianca: json.draft.confidence });
      applyImportDraft(json.draft);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro ao importar reserva.");
    } finally {
      setImporting(false);
    }
  }

  async function saveItem() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(editingId ? `/api/trips/${slug}/vault/${editingId}` : `/api/trips/${slug}/vault`, {
        method: editingId ? "PATCH" : "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify(itemPayload()),
      });
      const json = await readApiJson<{ item?: TripVaultItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar o Cofre.");

      // O item ja esta salvo. Se um anexo falhar daqui pra frente, o item
      // continua valendo: avisamos o que nao subiu em vez de desfazer tudo.
      track("cofre_item_salvo", { tipo: form.kind, edicao: Boolean(editingId) });

      const createdId = editingId ? "" : json.item?.id;
      if (createdId && pendingFiles.length && accessToken) {
        setUploadingPending(true);

        const failed: string[] = [];
        for (const file of pendingFiles) {
          try {
            await uploadVaultAttachment(slug, createdId, file, accessToken);
          } catch {
            failed.push(file.name);
          }
        }

        setUploadingPending(false);

        if (failed.length) {
          setPendingFiles([]);
          await onChange();
          setError(
            `Item salvo, mas nao consegui anexar: ${failed.join(", ")}. Tente anexar pelo card do item.`
          );
          return;
        }
      }

      resetForm();
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar no Cofre.");
    } finally {
      setSaving(false);
    }
  }

  async function setItemStatus(itemId: string, status: TripVaultStatus) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await readApiJson<{ item?: TripVaultItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar o status.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar status.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeItem(itemId: string) {
    if (!accessToken || workingId) return;

    setConfirmarRemocao("");
    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}`, {
        method: "DELETE",
        headers: authJsonHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível remover o item.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover do Cofre.");
    } finally {
      setWorkingId("");
    }
  }

  const attachmentsByItem = new Map<string, TripVaultAttachment[]>();
  for (const attachment of attachments) {
    const list = attachmentsByItem.get(attachment.item_id);
    if (list) list.push(attachment);
    else attachmentsByItem.set(attachment.item_id, [attachment]);
  }

  const memberName = (memberId: string | null) =>
    members.find((member) => member.id === memberId)?.name ?? "grupo";
  /** Quem pode mexer no item. Trancado, ninguem edita — mas remover
   *  continua liberado, entao a checagem de remocao e separada. */
  const canManage = (item: TripVaultItem) =>
    !locked && (me.is_organizer || item.member_id === me.id);
  const canRemove = (item: TripVaultItem) => me.is_organizer || item.member_id === me.id;

  return (
    <div className="vault-layout">
      {locked ? (
        <div className="card vault-form-card locked-form">
          <span className="badge b-warn">recursos do Passe</span>
          <h2>Guardar no Cofre precisa do Passe</h2>
          <p className="sub">
            Cadastrar reserva, editar item e anexar arquivo fazem parte do Passe desta viagem.
            Quem organiza pode liberar para o grupo todo.
          </p>
          <div className="note">
            <b>O que já está aqui continua seu</b>
            <br />
            Os itens salvos seguem visíveis, e você pode abrir, baixar e remover à vontade. Nada
            fica preso.
          </div>
          {me.is_organizer ? (
            <a className="btn full" href={`/app?liberar=${slug}`}>
              Liberar esta viagem
            </a>
          ) : (
            <p className="tiny">Você não precisa pagar nada: só quem organiza libera.</p>
          )}
        </div>
      ) : (
      <div className="card vault-form-card">
        <div className="vault-form-head">
          <span className="badge b-ok">{editingId ? "editando item" : "central da viagem"}</span>
          {editingId && (
            <button className="btn ghost sm" type="button" onClick={resetForm} disabled={saving}>
              Cancelar edição
            </button>
          )}
        </div>
        <h2>{editingId ? "Editar item do Cofre" : "Cofre de reservas e documentos"}</h2>
        <p className="sub">
          Guarde tudo que foi comprado, reservado ou precisa ser conferido: voos, hospedagens,
          passeios, seguros, vistos, restaurantes, links e códigos.
        </p>

        <div className="vault-summary">
          <div>
            <span className="stat-label">Itens salvos</span>
            <strong>{items.length}</strong>
          </div>
          <div>
            <span className="stat-label">Na agenda</span>
            <strong>{upcomingItems.length}</strong>
          </div>
          <div>
            <span className="stat-label">Conferir</span>
            <strong>{attentionCount}</strong>
          </div>
          <div>
            <span className="stat-label">Valor conhecido</span>
            <strong>{formatMoney(totalKnown)}</strong>
          </div>
        </div>

        {!editingId && (
          <div className="vault-import-box">
            <div className="vault-import-head">
              <div>
                <span className="badge b-warn">importação inteligente</span>
                <h3>Colar confirmação</h3>
              </div>
              <span className="tiny">Nada é salvo automaticamente.</span>
            </div>
            <p className="sub">
              Cole um email ou recibo, ou envie o PDF da confirmação e o print da tela. O
              Planvoro extrai um rascunho para você revisar antes de guardar no Cofre.
            </p>
            <textarea
              rows={5}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Ex: confirmação de voo, reserva do hotel, seguro viagem, ingresso, transfer..."
            />
            <div className="vault-import-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={importReservation}
                disabled={importing || !accessToken || importText.trim().length < 40}
              >
                {importing ? "Extraindo..." : "Extrair do texto"}
              </button>
              <input
                ref={importFileRef}
                className="hidden-file"
                type="file"
                accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFromFile(file);
                }}
              />
              <button
                className="btn ghost"
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={importing || !accessToken}
              >
                Ler PDF ou print
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setImportText("");
                  setImportError("");
                  setImportResult(null);
                }}
                disabled={importing || !importText.trim()}
              >
                Limpar texto
              </button>
            </div>
            {importError && <div className="err">{importError}</div>}
            {importResult && (
              <div className="vault-import-result">
                <strong>Rascunho preenchido. Confira antes de salvar.</strong>
                <span>{importResult.summary}</span>
                <small>
                  Confiança estimada: {Math.round(importResult.confidence * 100)}%
                  {importResult.missing_fields.length
                    ? ` · Falta conferir: ${importResult.missing_fields.join(", ")}`
                    : " · Sem campos criticos pendentes"}
                </small>
              </div>
            )}
          </div>
        )}

        <div className="grid2 tight">
          <div>
            <label>Tipo</label>
            <select
              value={form.kind}
              onChange={(event) => updateForm({ kind: event.target.value as TripVaultKind })}
            >
              {TRIP_VAULT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select
              value={form.status}
              onChange={(event) => updateForm({ status: event.target.value as TripVaultStatus })}
            >
              {TRIP_VAULT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>Nome do item</label>
        <input
          value={form.title}
          onChange={(event) => updateForm({ title: event.target.value })}
          placeholder="Voo LATAM SP para Lisboa, Hotel, Seguro viagem..."
        />

        <div className="grid2 tight">
          <div>
            <label>Fornecedor</label>
            <input
              value={form.provider}
              onChange={(event) => updateForm({ provider: event.target.value })}
              placeholder="LATAM, Booking, Airbnb, Civitatis..."
            />
          </div>
          <div>
            <label>Código / localizador</label>
            <input
              value={form.confirmation_code}
              onChange={(event) => updateForm({ confirmation_code: event.target.value })}
              placeholder="ABC123"
            />
          </div>
        </div>

        <div className="grid2 tight">
          <div>
            <label>Começa em</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => updateForm({ starts_at: event.target.value })}
            />
          </div>
          <div>
            <label>Termina em</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(event) => updateForm({ ends_at: event.target.value })}
            />
          </div>
        </div>

        <label>Local</label>
        <input
          value={form.location}
          onChange={(event) => updateForm({ location: event.target.value })}
          placeholder="Aeroporto, endereço do hotel, ponto de encontro..."
        />

        <div className="grid2 tight">
          <div>
            <label>Valor</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm({ amount: event.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label>Moeda</label>
            <input
              value={form.currency}
              onChange={(event) => updateForm({ currency: event.target.value.toUpperCase() })}
              placeholder="BRL"
            />
          </div>
        </div>

        <label>Link</label>
        <input
          value={form.url}
          onChange={(event) => updateForm({ url: event.target.value })}
          placeholder="https://..."
        />

        <label>Notas</label>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => updateForm({ notes: event.target.value })}
          placeholder="Check-in, franquia de bagagem, regras de cancelamento, documentos..."
        />

        {!editingId && (
          <div className="vault-pending-box">
            <div className="vault-attachments-head">
              <div>
                <label>Anexos</label>
                <span className="tiny">PDF, print ou comprovante. Sobem junto ao guardar.</span>
              </div>
              <input
                ref={newItemFileRef}
                className="hidden-file"
                type="file"
                multiple
                accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
                onChange={(event) => addPendingFiles(Array.from(event.target.files ?? []))}
              />
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => newItemFileRef.current?.click()}
                disabled={saving || pendingFiles.length >= MAX_PENDING_ATTACHMENTS}
              >
                Escolher arquivos
              </button>
            </div>

            {pendingFiles.length > 0 && (
              <ul className="vault-attachment-list">
                {pendingFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{formatFileSize(file.size)}</small>
                    </div>
                    <div>
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => removePendingFile(index)}
                        disabled={saving}
                      >
                        Tirar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <div className="err">{error}</div>}

        <button className="btn full" onClick={saveItem} disabled={saving || !form.title.trim() || !accessToken}>
          {uploadingPending
            ? "Enviando anexos..."
            : saving
              ? "Salvando..."
              : editingId
                ? "Salvar alterações"
                : "Guardar no Cofre"}
        </button>
      </div>
      )}

      <div className="vault-list">
        <div className="vault-smart-grid">
          <div className="card vault-timeline-card">
            <span className="badge b-ok">próximos</span>
            <h3>Agenda do Cofre</h3>
            {upcomingItems.length === 0 ? (
              <p className="sub">Adicione datas em voos, hospedagens e reservas para montar a linha do tempo.</p>
            ) : (
              <div className="vault-timeline">
                {upcomingItems.map((item) => (
                  <button
                    type="button"
                    className="vault-timeline-item"
                    key={item.id}
                    onClick={() => startEditing(item)}
                    disabled={!canManage(item)}
                  >
                    <span>{formatVaultDate(item.starts_at)}</span>
                    <strong>{item.title}</strong>
                    <small>{vaultKindLabel(item.kind)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card vault-insights-card">
            <span className="badge b-warn">radar</span>
            <h3>Alertas inteligentes</h3>
            {vaultInsights.length === 0 ? (
              <p className="sub">O Cofre está redondo: itens essenciais cadastrados e nada marcado para conferir.</p>
            ) : (
              <div className="vault-insights">
                {vaultInsights.map((insight) => (
                  <div className={`vault-insight ${insight.tone}`} key={insight.title}>
                    <strong>{insight.title}</strong>
                    <span>{insight.body}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card">
            <h3>Cofre vazio</h3>
            <p className="sub">
              Quando você tiver um localizador, reserva, comprovante ou link importante, guarda aqui
              para o grupo não depender de prints perdidos no WhatsApp.
            </p>
            <div className="note">
              <b>Bom primeiro item</b>
              <br />
              Comece cadastrando o hotel ou o voo principal da viagem.
            </div>
          </div>
        ) : (
          sortedItems.map((item) => (
            <div className={`vault-card ${item.status}`} key={item.id}>
              <div className="vault-card-head">
                <div>
                  <span className="stat-label">{vaultKindLabel(item.kind)}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className={`badge ${item.status === "attention" ? "b-warn" : "b-ok"}`}>
                  {vaultStatusLabel(item.status)}
                </span>
              </div>

              <div className="vault-meta-grid">
                <div>
                  <span>Quando</span>
                  <strong>{formatVaultRange(item)}</strong>
                </div>
                <div>
                  <span>Fornecedor</span>
                  <strong>{item.provider || "não informado"}</strong>
                </div>
                <div>
                  <span>Código</span>
                  <strong>{item.confirmation_code || "sem código"}</strong>
                </div>
                <div>
                  <span>Valor</span>
                  <strong>
                    {item.amount == null ? "não informado" : formatCurrency(Number(item.amount), item.currency)}
                  </strong>
                </div>
              </div>

              {item.location && <p className="small">{item.location}</p>}
              {item.notes && <p className="item-d">{item.notes}</p>}
              {isOutsideTripDates(item, trip) && (
                <div className="note tight">
                  A data deste item parece cair fora do período da viagem. Confira fuso, conexão ou
                  horário cadastrado.
                </div>
              )}

              <div className="vault-status-actions">
                {item.status !== "reserved" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "reserved")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Reservado
                  </button>
                )}
                {item.status !== "paid" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "paid")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Pago
                  </button>
                )}
                {item.status !== "attention" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "attention")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Conferir
                  </button>
                )}
                {item.status === "canceled" ? (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "saved")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Reabrir
                  </button>
                ) : (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "canceled")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <VaultAttachmentsBlock
                accessToken={accessToken}
                slug={slug}
                itemId={item.id}
                attachments={attachmentsByItem.get(item.id) ?? []}
                canManage={canManage(item)}
                canRemove={canRemove(item)}
                onChange={onChange}
              />

              <div className="vault-card-actions">
                <span className="tiny">Salvo por {memberName(item.member_id)}</span>
                <div>
                  {item.url && (
                    <a className="btn ghost sm" href={item.url} target="_blank" rel="noreferrer">
                      Abrir link
                    </a>
                  )}
                  <button
                    className="btn ghost sm"
                    onClick={() => startEditing(item)}
                    disabled={!canManage(item)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => setConfirmarRemocao(item.id)}
                    disabled={workingId === item.id || !canRemove(item)}
                  >
                    {workingId === item.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/*
        Item do Cofre costuma ser a unica copia de um localizador, e some
        junto com os anexos. Um toque errado no celular nao pode fazer
        isso em silencio.
      */}
      {confirmarRemocao && (
        <Confirmar
          titulo="Remover do Cofre?"
          descricao={`"${
            items.find((entry) => entry.id === confirmarRemocao)?.title ?? "Este item"
          }" sai do Cofre e os anexos dele também são apagados. Não dá para desfazer.`}
          acao="Remover item"
          trabalhando={workingId === confirmarRemocao}
          onConfirmar={() => removeItem(confirmarRemocao)}
          onCancelar={() => setConfirmarRemocao("")}
        />
      )}
    </div>
  );
}

