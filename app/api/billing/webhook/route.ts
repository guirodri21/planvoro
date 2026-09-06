import { NextResponse } from "next/server";
import { assinaturaConfere, buscarCheckout, webhookSecretConfere } from "@/lib/abacatepay";
import { tripAccessExpiresAt } from "@/lib/billing";
import { logError, logInfo, logWarn, startTimer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

type Pedido = {
  id: string;
  plan: string;
  user_id: string;
  trip_id: string | null;
  status: string;
};

/** Um ano a partir de agora, para a assinatura anual. */
function umAnoAdiante() {
  const fim = new Date();
  fim.setFullYear(fim.getFullYear() + 1);
  return fim.toISOString();
}

/**
 * Transforma pagamento confirmado em acesso liberado.
 *
 * Cada escrita e conferida. Antes nenhuma era: a atualizacao do direito de
 * acesso foi recusada pelo banco, o erro caiu no chao, e o webhook
 * respondeu "handled" — cobranca paga, Passe trancado, e nada no log
 * dizendo por que.
 */
async function liberarAcesso(pedido: Pedido, checkoutId: string | null, valor: number | null) {
  const db = supabaseAdmin();
  const agora = new Date().toISOString();

  if (pedido.plan === "trip_pass" && pedido.trip_id) {
    const { data: trip } = await db
      .from("trips")
      .select("end_date")
      .eq("id", pedido.trip_id)
      .maybeSingle();

    /**
     * Libera UMA linha, a desta cobranca — nao todas as da viagem.
     *
     * A versao anterior filtrava por `trip_id` + `checkout_pending`. Como
     * cada tentativa de compra cria a sua linha, tres tentativas viraram
     * tres pendentes na mesma viagem, e o update tentou marcar as tres
     * como paga de uma vez. Existe um indice unico que permite so um
     * `paid` por viagem — e com razao, senao a mesma viagem seria vendida
     * duas vezes. O Postgres recusou a instrucao inteira.
     *
     * Pegar a mais recente resolve os dois lados: uma linha so, e a que
     * corresponde ao checkout que a pessoa acabou de pagar.
     */
    const { data: pendente } = await db
      .from("trip_entitlements")
      .select("id")
      .eq("trip_id", pedido.trip_id)
      .eq("status", "checkout_pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pendente) {
      logWarn({
        event: "abacate_sem_direito_pendente",
        route: "billing/webhook",
        tripId: pedido.trip_id,
      });
    } else {
      const { error } = await db
        .from("trip_entitlements")
        .update({
          status: "paid",
          provider: "abacatepay",
          provider_checkout_id: checkoutId,
          amount_total: valor,
          currency: "brl",
          paid_at: agora,
          access_expires_at: tripAccessExpiresAt(trip?.end_date),
          updated_at: agora,
        })
        .eq("id", pendente.id);

      if (error) {
        logError({ event: "abacate_direito_nao_gravado", route: "billing/webhook", error });
        throw error;
      }

      logInfo({
        event: "abacate_direito_liberado",
        route: "billing/webhook",
        tripId: pedido.trip_id,
      });
    }

    // As outras tentativas da mesma viagem nao viram nada: encerram como
    // abandonadas, senao continuam pendentes para sempre e a proxima
    // compra tropeca nelas de novo.
    await db
      .from("trip_entitlements")
      .update({ status: "expired", updated_at: agora })
      .eq("trip_id", pedido.trip_id)
      .eq("status", "checkout_pending");
  }

  if (pedido.plan === "pro_annual") {
    const { error } = await db.from("user_subscriptions").upsert(
      {
        user_id: pedido.user_id,
        status: "active",
        provider: "abacatepay",
        provider_subscription_id: checkoutId,
        current_period_end: umAnoAdiante(),
        cancel_at_period_end: false,
        updated_at: agora,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logError({ event: "abacate_assinatura_nao_gravada", route: "billing/webhook", error });
      throw error;
    }
  }

  const { error: erroPedido } = await db
    .from("billing_checkouts")
    .update({ status: "paid", paid_at: agora, provider_checkout_id: checkoutId })
    .eq("id", pedido.id);

  if (erroPedido) {
    logError({ event: "abacate_pedido_nao_gravado", route: "billing/webhook", error: erroPedido });
    throw erroPedido;
  }
}

/**
 * O corpo do webhook da AbacatePay.
 *
 * O campo do evento chama-se `type`. A documentacao e o painel mostram
 * `event`, e o que a entrega manda e `type` — foi essa diferenca que fez
 * o primeiro pagamento de verdade ser descartado em silencio. `event`
 * fica como alternativa para o dia em que eles alinharem os dois.
 */
type Payload = { type?: string; event?: string; data?: Record<string, unknown> };

/** O nome do evento, venha no campo que vier. */
function nomeDoEvento(payload: Payload) {
  return payload.type ?? payload.event ?? "unknown";
}

/**
 * Le o corpo do webhook, seja qual for a forma que ele chegue.
 *
 * O reenvio pelo painel da AbacatePay chegou com `event` indefinido,
 * embora o painel mostrasse o JSON com `event` no topo. O `JSON.parse`
 * nao falhou — devolveu algo que simplesmente nao tinha esse campo. Ou
 * seja: o que sai de la e o que chega aqui nao sao a mesma coisa, e ler
 * um caminho so fazia o handler desistir em silencio.
 *
 * Tres formas ja vistas em webhooks por ai, todas tratadas:
 *   - JSON dentro de string JSON (parse devolve texto, nao objeto)
 *   - JSON embrulhado numa chave (`payload`, `body`, `event_data`)
 *   - form-urlencoded com o JSON dentro de um campo
 *
 * O diagnostico registra formato e tamanho, nunca conteudo: o corpo
 * carrega nome e e-mail de quem pagou.
 */
function lerPayload(
  raw: string,
  ctx: { contentType: string | null; contentEncoding: string | null; elapsed: () => number }
): Payload {
  const diagnostico = {
    route: "billing/webhook",
    contentType: ctx.contentType ?? "ausente",
    contentEncoding: ctx.contentEncoding ?? "ausente",
    tamanho: raw.length,
    durationMs: ctx.elapsed(),
  };

  if (!raw.trim()) {
    logWarn({ event: "abacate_webhook_corpo_vazio", ...diagnostico });
    return {};
  }

  let valor: unknown;
  try {
    valor = JSON.parse(raw);
  } catch {
    // Nao e JSON. A forma mais comum aqui e form-urlencoded com o JSON
    // dentro de algum campo.
    try {
      const campos = new URLSearchParams(raw);
      for (const [, texto] of campos) {
        try {
          const interno = JSON.parse(texto);
          if (interno && typeof interno === "object") {
            logWarn({ event: "abacate_webhook_corpo_em_formulario", ...diagnostico });
            return interno as Payload;
          }
        } catch {
          // campo que nao e JSON; segue para o proximo
        }
      }
    } catch {
      // nem form-urlencoded
    }

    logWarn({ event: "abacate_webhook_corpo_ilegivel", ...diagnostico });
    return {};
  }

  // JSON dentro de string JSON: o parse devolve texto, e `.event` num
  // texto e undefined — sem erro nenhum, que e o que confundiu.
  if (typeof valor === "string") {
    try {
      valor = JSON.parse(valor);
      logWarn({ event: "abacate_webhook_corpo_duplamente_codificado", ...diagnostico });
    } catch {
      logWarn({ event: "abacate_webhook_corpo_texto", ...diagnostico });
      return {};
    }
  }

  if (!valor || typeof valor !== "object") {
    logWarn({ event: "abacate_webhook_corpo_inesperado", ...diagnostico });
    return {};
  }

  const objeto = valor as Record<string, unknown>;

  if (typeof objeto.type === "string" || typeof objeto.event === "string") {
    return objeto as Payload;
  }

  // Sem `event` no topo: pode vir embrulhado. Procura um nivel abaixo.
  for (const chave of Object.keys(objeto)) {
    const dentro = objeto[chave];
    const interno = dentro as Payload | null;
    if (
      dentro &&
      typeof dentro === "object" &&
      (typeof interno?.type === "string" || typeof interno?.event === "string")
    ) {
      logWarn({ event: "abacate_webhook_corpo_embrulhado", chaveExterna: chave, ...diagnostico });
      return dentro as Payload;
    }
  }

  // Desisto, mas digo o que veio: as chaves de primeiro nivel bastam para
  // reconhecer o formato sem expor um unico dado de quem pagou.
  logWarn({
    event: "abacate_webhook_corpo_sem_evento",
    chaves: Object.keys(objeto).join(","),
    ...diagnostico,
  });
  return objeto as Payload;
}

export async function POST(req: Request) {
  const elapsed = startTimer();
  let evento = "unknown";

  try {
    const url = new URL(req.url);
    const raw = await req.text();

    /**
     * Duas conferencias, com pesos bem diferentes.
     *
     * O segredo da query string e so nosso, e e o que de fato autentica a
     * chamada. Ele e obrigatorio.
     *
     * A assinatura HMAC usa uma chave que a propria AbacatePay publica na
     * documentacao — qualquer pessoa consegue forjar uma valida, entao
     * ela nao prova remetente, so pega corpo corrompido no caminho.
     *
     * Ela era obrigatoria tambem, e foi assim que o primeiro pagamento de
     * verdade se perdeu: a AbacatePay entregou o evento sem o header, nos
     * respondemos 401 e o acesso nunca liberou. Exigir uma prova fraca ao
     * ponto de recusar dinheiro que entrou e pior do que nao exigir.
     *
     * Agora: sem header, passa e fica registrado. Com header errado,
     * recusa — porque ai alguem mexeu no corpo.
     */
    if (!webhookSecretConfere(url.searchParams.get("webhookSecret"))) {
      logWarn({
        event: "abacate_webhook_segredo_invalido",
        route: "billing/webhook",
        durationMs: elapsed(),
      });
      return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
    }

    const assinatura = req.headers.get("x-webhook-signature");
    if (assinatura && !assinaturaConfere(raw, assinatura)) {
      logWarn({
        event: "abacate_webhook_assinatura_invalida",
        route: "billing/webhook",
        durationMs: elapsed(),
      });
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
    if (!assinatura) {
      logInfo({
        event: "abacate_webhook_sem_assinatura",
        route: "billing/webhook",
        durationMs: elapsed(),
      });
    }

    /**
     * Leitura solta de proposito.
     *
     * A propria AbacatePay recomenda nao validar o payload inteiro: um
     * campo novo do lado deles nao pode derrubar a confirmacao de um
     * pagamento que ja aconteceu.
     */
    const payload = lerPayload(raw, {
      contentType: req.headers.get("content-type"),
      contentEncoding: req.headers.get("content-encoding"),
      elapsed,
    });

    evento = nomeDoEvento(payload);

    /**
     * O nome do evento deixou de ser o porteiro.
     *
     * Ele era: qualquer coisa fora de `checkout.completed` saia calada, e
     * um reenvio que chegou com `event` indefinido foi descartado mesmo
     * carregando um pagamento de R$ 29 ja liquidado.
     *
     * Agora ele so serve para descartar o que comprovadamente nao e
     * pagamento — saque, transferencia, reembolso. Se o nome nao vier, ou
     * vier algo que nao conhecemos, seguimos: quem decide se ha dinheiro
     * e a consulta a AbacatePay logo abaixo, e ela nao depende de rotulo.
     */
    const NAO_E_PAGAMENTO = ["payout.", "transfer.", "refunded", "disputed", "cancelled"];
    if (NAO_E_PAGAMENTO.some((prefixo) => evento.includes(prefixo))) {
      logInfo({
        event: "abacate_webhook_evento_ignorado",
        route: "billing/webhook",
        abacateEvent: evento,
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    /**
     * O id da cobranca, venha ele de onde vier.
     *
     * O envio original trazia `data.checkout.id`. O reenvio pelo painel
     * chega com outro formato, e ler so um caminho fazia o handler sair
     * calado. Como o payload e escrito por terceiro e pode mudar sem
     * aviso, aqui a leitura e generosa — e o que decide de verdade vem
     * logo abaixo, da API deles.
     */
    const dados = payload.data ?? {};
    const aninhado = (dados.checkout ?? dados.transparent ?? {}) as Record<string, unknown>;
    const idCobranca =
      (typeof aninhado.id === "string" && aninhado.id) ||
      (typeof dados.id === "string" && dados.id) ||
      null;

    if (!idCobranca) {
      logWarn({
        event: "abacate_webhook_sem_id",
        route: "billing/webhook",
        abacateEvent: evento,
        // As chaves, nunca os valores: o corpo carrega nome e e-mail de
        // quem pagou, e log nao e lugar para isso.
        chavesData: Object.keys(dados).join(","),
        chavesAninhado: Object.keys(aninhado).join(","),
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    /**
     * Confirma com a AbacatePay antes de liberar qualquer coisa.
     *
     * O webhook vira aviso, nao prova. Ele chega sem assinatura — a
     * AbacatePay nao manda o header — entao a unica defesa era o segredo
     * na query string, e segredo em URL vaza em log de proxy, historico e
     * print de tela. Perguntar a fonte remove a confianca no mensageiro:
     * webhook forjado nao consegue fazer a API dizer PAID.
     */
    const naFonte = await buscarCheckout(idCobranca);

    if (!naFonte || naFonte.status !== "PAID") {
      logWarn({
        event: "abacate_webhook_nao_confirmado",
        route: "billing/webhook",
        abacateEvent: evento,
        statusNaFonte: naFonte?.status ?? "não encontrado",
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    const externalId = naFonte.externalId;
    if (!externalId) {
      logWarn({
        event: "abacate_webhook_sem_externalid",
        route: "billing/webhook",
        abacateEvent: evento,
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    const db = supabaseAdmin();
    const { data: pedido } = await db
      .from("billing_checkouts")
      .select("id, plan, user_id, trip_id, status")
      .eq("id", externalId)
      .maybeSingle<Pedido>();

    if (!pedido) {
      // Cobranca que nao nasceu aqui. Responder 200 encerra a retentativa
      // do provedor; um 4xx faria ele insistir por dias sem chance de mudar.
      logInfo({
        event: "abacate_webhook_sem_pedido",
        route: "billing/webhook",
        abacateEvent: evento,
        durationMs: elapsed(),
      });
      return NextResponse.json({ received: true });
    }

    // Idempotencia: o provedor reenvia o mesmo evento ate receber 200, e
    // liberar duas vezes reescreveria a validade do acesso ja concedido.
    if (pedido.status !== "paid") {
      await liberarAcesso(pedido, naFonte.id, naFonte.paidAmount ?? naFonte.amount);
    }

    logInfo({
      event: "abacate_webhook_handled",
      route: "billing/webhook",
      abacateEvent: evento,
      durationMs: elapsed(),
    });

    return NextResponse.json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no webhook da AbacatePay.";
    logError({
      event: "abacate_webhook_failed",
      route: "billing/webhook",
      abacateEvent: evento,
      durationMs: elapsed(),
      error: e,
    });
    const status = msg.includes("ABACATEPAY_") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
