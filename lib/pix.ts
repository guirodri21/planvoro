/**
 * BR Code do Pix (EMV MPM), o "copia e cola".
 *
 * Gerado aqui no cliente de proposito: e so montagem de string com um
 * CRC no fim, nao precisa de servidor nem de internet. Assim o acerto de
 * contas funciona no aeroporto sem sinal, que e onde ele costuma
 * acontecer.
 *
 * O Planvoro nao move dinheiro: o codigo abre o app do banco da pessoa,
 * que confirma valor e destinatario antes de qualquer coisa acontecer.
 */

/** Acentos separados pela normalizacao NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
/** O que nao e ASCII imprimivel quebra a leitura em parte dos bancos. */
const NON_ASCII = new RegExp("[^\\u0020-\\u007e]", "g");

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria" | "desconhecida";

/** Campo no formato EMV: id + tamanho com dois digitos + valor. */
function field(id: string, value: string) {
  const size = value.length.toString().padStart(2, "0");
  return `${id}${size}${value}`;
}

/**
 * CRC16/CCITT-FALSE, polinomio 0x1021 comecando em 0xFFFF.
 * E o que a especificacao do BC exige nos quatro ultimos digitos.
 */
function crc16(payload: string) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_ASCII, "")
    .trim()
    .slice(0, maxLength)
    .toUpperCase();
}

const DIGITS = new RegExp("\\D", "g");

/** Descobre o tipo da chave para exibir, e normaliza CPF/CNPJ/telefone. */
export function detectPixKey(raw: string): { key: string; type: PixKeyType } {
  const value = String(raw ?? "").trim();
  if (!value) return { key: "", type: "desconhecida" };

  if (value.includes("@")) return { key: value.toLowerCase(), type: "email" };

  const digits = value.replace(DIGITS, "");

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return { key: value.toLowerCase(), type: "aleatoria" };
  }
  if (digits.length === 11 && value.trim().startsWith("+")) {
    return { key: `+${digits}`, type: "telefone" };
  }
  if (digits.length === 11) return { key: digits, type: "cpf" };
  if (digits.length === 14) return { key: digits, type: "cnpj" };
  if (digits.length === 13 && digits.startsWith("55")) {
    return { key: `+${digits}`, type: "telefone" };
  }
  if (digits.length === 10 || digits.length === 12) {
    return { key: `+55${digits.slice(-11)}`, type: "telefone" };
  }

  return { key: value, type: "desconhecida" };
}

export function isLikelyPixKey(raw: string) {
  const { key, type } = detectPixKey(raw);
  return Boolean(key) && type !== "desconhecida";
}

/**
 * Cidade quando ninguem informou.
 *
 * O campo 60 e obrigatorio na especificacao, entao nao da para omitir.
 * Antes ia fixo como "SAO PAULO", o que e mentira para a maioria das
 * pessoas e aparece na tela de parte dos bancos. "BRASIL" e verdade para
 * todo mundo e ocupa o campo sem afirmar nada errado.
 */
export const PIX_DEFAULT_CITY = "BRASIL";

/**
 * Monta o codigo copia e cola.
 *
 * `amount` vai com duas casas e ponto. Um valor invalido nao vira zero:
 * cobrar R$ 0,00 por engano e pior do que um codigo sem valor, que o
 * pagador preenche na mao.
 */
export function buildPixPayload({
  key,
  amount,
  receiverName,
  city,
  reference,
}: {
  key: string;
  amount?: number | null;
  receiverName: string;
  city?: string | null;
  reference?: string;
}) {
  const cleanKey = detectPixKey(key).key;
  if (!cleanKey) return "";

  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", cleanKey);

  const hasAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const txid = sanitize(reference ?? "", 25).replace(new RegExp("[^A-Z0-9]", "g"), "") || "***";

  const payload =
    field("00", "01") +
    // 12 = uso unico. O valor esta embutido, entao o codigo nao deve ser
    // reaproveitado para uma segunda cobranca.
    field("01", "12") +
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    (hasAmount ? field("54", amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", sanitize(receiverName || "RECEBEDOR", 25) || "RECEBEDOR") +
    field("60", sanitize(city || PIX_DEFAULT_CITY, 15) || PIX_DEFAULT_CITY) +
    field("62", field("05", txid));

  const semCrc = `${payload}6304`;
  return `${semCrc}${crc16(semCrc)}`;
}

export function pixKeyLabel(type: PixKeyType) {
  switch (type) {
    case "cpf":
      return "CPF";
    case "cnpj":
      return "CNPJ";
    case "email":
      return "e-mail";
    case "telefone":
      return "telefone";
    case "aleatoria":
      return "chave aleatória";
    default:
      return "chave";
  }
}
