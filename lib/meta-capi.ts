import crypto from "node:crypto";
import { logInfo, logWarn } from "@/lib/logger";

/**
 * API de Conversoes da Meta: o mesmo evento do Pixel, mandado pelo
 * servidor.
 *
 * Existe para quem bloqueia o Pixel — Safari do iPhone, bloqueador de
 * anuncio, navegador do Instagram com rastreamento limitado. O anuncio
 * otimiza por Lead; se metade dos Leads some no navegador, a Meta aprende
 * com a metade errada.
 *
 * Os dois lados mandam o mesmo `event_id` e a Meta conta uma vez so.
 *
 * Sem META_CAPI_TOKEN ou sem NEXT_PUBLIC_META_PIXEL_ID, nada sai daqui —
 * mesmo acordo do Pixel: desligar e apagar a variavel.
 *
 * O que vai: IP e navegador de quem pediu (a Meta precisa deles para
 * casar o evento com a pessoa que viu o anuncio), os cookies _fbp/_fbc
 * que o proprio Pixel criou e, so no Purchase, o e-mail com hash SHA-256.
 * No Purchase, IP e navegador sao os de quem abriu o checkout, guardados
 * no pedido ate o evento sair (billing_checkouts.meta_contexto).
 * Nunca vai destino, nome ou e-mail em texto.
 */

const VERSAO = "v21.0";
const TEMPO_MAXIMO_MS = 3000;

export type EventoMetaServidor = "Lead" | "Purchase";

export type DadosDoNavegador = {
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  url: string | null;
};

export function metaCapiLigada() {
  return Boolean(process.env.META_CAPI_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

/** event_id vem do navegador: so aceita o formato que o nosso codigo gera. */
export function eventIdValido(valor: unknown): string | null {
  return typeof valor === "string" && /^[a-z]+-[a-zA-Z0-9-]{8,64}$/.test(valor) ? valor : null;
}

export function hashEmail(email: string) {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function cookie(req: Request, nome: string) {
  const bruto = req.headers.get("cookie") ?? "";
  for (const parte of bruto.split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return resto.join("=") || null;
  }
  return null;
}

/** O que a requisicao do navegador traz para casar o evento com a pessoa. */
export function dadosDoNavegador(req: Request): DadosDoNavegador {
  const encaminhado = req.headers.get("x-forwarded-for");
  return {
    ip: encaminhado ? encaminhado.split(",")[0].trim() : req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
    fbp: cookie(req, "_fbp"),
    fbc: cookie(req, "_fbc"),
    url: req.headers.get("referer"),
  };
}

/**
 * Manda um evento. Nunca lanca erro: medicao de anuncio nao pode derrubar
 * a amostra nem a liberacao de um pagamento.
 */
export async function enviarEventoMeta(opcoes: {
  evento: EventoMetaServidor;
  eventId: string;
  navegador?: DadosDoNavegador;
  emailHash?: string | null;
  valor?: number;
}) {
  const token = process.env.META_CAPI_TOKEN;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixel) return;

  const { evento, eventId, navegador, emailHash, valor } = opcoes;
  const userData: Record<string, unknown> = {};
  if (navegador?.ip) userData.client_ip_address = navegador.ip;
  if (navegador?.userAgent) userData.client_user_agent = navegador.userAgent;
  if (navegador?.fbp) userData.fbp = navegador.fbp;
  if (navegador?.fbc) userData.fbc = navegador.fbc;
  if (emailHash) userData.em = [emailHash];

  // Token no corpo, e nao na URL: URL aparece em log de proxy e de erro.
  const corpo: Record<string, unknown> = {
    access_token: token,
    data: [
      {
        event_name: evento,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        ...(navegador?.url ? { event_source_url: navegador.url } : {}),
        user_data: userData,
        ...(valor !== undefined ? { custom_data: { value: valor, currency: "BRL" } } : {}),
      },
    ],
  };
  // Codigo da aba "Testar eventos" do Gerenciador de Eventos. So para
  // conferir a instalacao; apagar depois.
  if (process.env.META_CAPI_TEST_CODE) corpo.test_event_code = process.env.META_CAPI_TEST_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${VERSAO}/${encodeURIComponent(pixel)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
      }
    );
    if (!res.ok) {
      // A resposta da Meta diz o motivo (token vencido, pixel errado) e
      // nao carrega dado de ninguem.
      const motivo = (await res.text().catch(() => "")).slice(0, 300);
      logWarn({ event: "meta_capi_recusou", route: "meta-capi", metaEvent: evento, status: res.status, motivo });
      return;
    }
    logInfo({ event: "meta_capi_enviado", route: "meta-capi", metaEvent: evento });
  } catch (e) {
    logWarn({
      event: "meta_capi_falhou",
      route: "meta-capi",
      metaEvent: evento,
      motivo: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
}
