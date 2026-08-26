/**
 * Identificacao juridica e contatos.
 *
 * PREENCHER ANTES DE ABRIR AO PUBLICO. A LGPD (art. 41) exige indicar o
 * controlador e um canal de contato do encarregado; os Termos precisam
 * dizer com quem o usuario esta contratando. Enquanto estiver com os
 * valores abaixo, as paginas mostram um aviso de rascunho.
 */

export const LEGAL = {
  /** Razao social. Ex: "Planvoro Tecnologia LTDA". */
  companyName: "",
  /** CNPJ formatado. Ex: "00.000.000/0001-00". */
  cnpj: "",
  /** Cidade/UF da sede. Ex: "Sao Paulo/SP". */
  city: "",
  /** Foro eleito para disputas. Normalmente a comarca da sede. */
  jurisdiction: "",

  /** Canal geral de suporte. */
  supportEmail: "",
  /** Canal do encarregado de dados (LGPD). Pode ser o mesmo do suporte. */
  privacyEmail: "",

  /** Ultima revisao dos documentos, em ISO. */
  updatedAt: "2026-08-26",
} as const;

export const LEGAL_PENDING = !LEGAL.companyName || !LEGAL.supportEmail;

/** Nome a exibir enquanto a razao social nao foi preenchida. */
export const legalCompany = LEGAL.companyName || "Planvoro";

export const legalSupportEmail = LEGAL.supportEmail || "contato@planvoro.com.br";

export const legalPrivacyEmail =
  LEGAL.privacyEmail || LEGAL.supportEmail || "privacidade@planvoro.com.br";

export function formatLegalDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
