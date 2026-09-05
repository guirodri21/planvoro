/**
 * Identificacao juridica e contatos.
 *
 * PREENCHER ANTES DE ABRIR AO PUBLICO. A LGPD exige indicar quem controla
 * os dados e um canal de contato; enquanto `controllerName` ou
 * `supportEmail` estiverem vazios, as paginas legais se declaram em
 * preparacao em vez de posar de versao final.
 *
 * O Planvoro pode ser operado por pessoa fisica ou por empresa. Nos dois
 * casos o que a lei pede e o mesmo: saber com quem o usuario esta
 * tratando e como falar com essa pessoa.
 *
 * Sobre o documento: a recomendacao depende de qual documento e.
 *
 * CPF exposto em pagina publica e materia-prima para fraude de
 * identidade, e identificar o controlador nao exige publica-lo — por isso
 * ficou em branco enquanto o Planvoro era pessoa fisica.
 *
 * CNPJ e o contrario: registro publico, consultavel por qualquer um na
 * Receita, e publica-lo e o que faz o site parecer empresa em vez de
 * projeto pessoal. Entrou em 05/09/2026, junto com a abertura.
 *
 * `jurisdiction` continua vazio de proposito, e ter CNPJ nao muda isso:
 * eleger foro contra consumidor e o que o CDC trata como clausula
 * abusiva. Sem a clausula, vale a comarca do cliente — que e o que
 * valeria de qualquer jeito.
 */

export const LEGAL = {
  /** Nome completo, se pessoa fisica. Razao social, se empresa. */
  controllerName: "Guilherme Paixão Rodrigues",

  /** Ver a observacao acima antes de preencher. */
  document: "68.948.655/0001-20",
  /** Rotulo do documento acima: "CPF" ou "CNPJ". */
  documentLabel: "CNPJ" as "CPF" | "CNPJ",

  /** Cidade/UF. Ex: "Salvador/BA". */
  city: "",
  /** Foro eleito. Normalmente a comarca da cidade acima. */
  jurisdiction: "",

  /** Canal geral de suporte. */
  supportEmail: "paixaodevtech@gmail.com",
  /** Canal de privacidade (LGPD). Pode ser o mesmo do suporte. */
  privacyEmail: "paixaodevtech@gmail.com",

  /** Ultima revisao dos documentos, em ISO. */
  updatedAt: "2026-09-05",
} as const;

export const LEGAL_PENDING = !LEGAL.controllerName || !LEGAL.supportEmail;

/** Nome a exibir enquanto o controlador nao foi identificado. */
export const legalCompany = LEGAL.controllerName || "Planvoro";

/** "CPF 000.000.000-00" ou string vazia quando nao ha documento publicado. */
export const legalDocument = LEGAL.document
  ? `${LEGAL.documentLabel} ${LEGAL.document}`
  : "";

export const legalSupportEmail = LEGAL.supportEmail || "contato@planvoro.com.br";

export const legalPrivacyEmail =
  LEGAL.privacyEmail || LEGAL.supportEmail || "privacidade@planvoro.com.br";

export function formatLegalDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
