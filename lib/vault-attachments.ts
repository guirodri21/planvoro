/**
 * Regras dos anexos do Cofre.
 *
 * O arquivo enviado pelo usuario e dado nao confiavel: nome, extensao e
 * content-type vem do navegador. Por isso o caminho no Storage e sempre
 * gerado aqui (uuid), e o nome original so e guardado como rotulo.
 */

export const VAULT_BUCKET = "trip-vault";

export const VAULT_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

export const VAULT_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type VaultAttachmentMime = (typeof VAULT_ATTACHMENT_MIME_TYPES)[number];

const MIME_EXTENSIONS: Record<VaultAttachmentMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const MIME_SET = new Set<string>(VAULT_ATTACHMENT_MIME_TYPES);

/** Caracteres de controle, separadores de path e coringas de sistema de arquivos. */
const UNSAFE_NAME_CHARS = new RegExp("[\\u0000-\\u001f\\u007f<>:\"|?*]", "g");

export function isAllowedVaultMime(value: string): value is VaultAttachmentMime {
  return MIME_SET.has(value);
}

export function normalizeMimeType(value: unknown) {
  return String(value ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

/**
 * Nome apenas para exibir. Remove diretorios, caracteres de controle e
 * qualquer coisa que possa virar path traversal na hora de baixar.
 */
export function safeFileName(value: unknown, mime: VaultAttachmentMime) {
  const raw = String(value ?? "")
    .split(/[\\/]/)
    .pop();

  const cleaned = (raw ?? "")
    .replace(UNSAFE_NAME_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return `anexo.${MIME_EXTENSIONS[mime]}`;
  }

  return cleaned;
}

export function extensionForMime(mime: VaultAttachmentMime) {
  return MIME_EXTENSIONS[mime];
}

export function buildStoragePath(
  tripId: string,
  itemId: string,
  attachmentId: string,
  mime: VaultAttachmentMime
) {
  return `${tripId}/${itemId}/${attachmentId}.${extensionForMime(mime)}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
