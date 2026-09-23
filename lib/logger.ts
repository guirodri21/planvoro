/**
 * Log estruturado das rotas criticas.
 *
 * Sai como uma linha JSON por evento, que e o formato que os logs da Vercel
 * indexam e permitem filtrar. `console.error` para falha, `console.log` para
 * o resto, porque so o primeiro aparece destacado no painel.
 *
 * REGRA: nunca logar conteudo de usuario nem segredo. Texto colado no Cofre,
 * pergunta ao agente, e-mail, token e chave ficam de fora. Tamanho e contagem
 * podem entrar: dizem o mesmo para depurar sem virar vazamento.
 */

import { after } from "next/server";
import { alertarErro } from "./alertas";

type LogLevel = "info" | "warn" | "error";

type LogFields = {
  /** Nome do evento, em snake_case. Ex: "itinerary_generated". */
  event: string;
  route?: string;
  userId?: string;
  tripId?: string;
  durationMs?: number;
  /** Campos extras. Devem ser numeros, booleanos ou rotulos curtos. */
  [key: string]: unknown;
};

function emit(level: LogLevel, fields: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...fields,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(fields: LogFields) {
  emit("info", fields);
}

export function logWarn(fields: LogFields) {
  emit("warn", fields);
}

/**
 * Loga uma falha. A mensagem do erro entra porque e o que identifica a causa;
 * o stack fica de fora, ja que a Vercel guarda o dela e o stack costuma
 * carregar caminho de arquivo sem valor de diagnostico aqui.
 */
export function logError(fields: LogFields & { error: unknown }) {
  const { error, ...rest } = fields;
  const errorMessage = mensagemDoErro(error);
  emit("error", {
    ...rest,
    errorMessage,
    errorName: error instanceof Error ? error.name : "unknown",
  });
  agendarAlerta(() =>
    alertarErro({ evento: fields.event, rota: fields.route ?? null, mensagem: errorMessage })
  );
}

/**
 * Texto do erro. Erro do Supabase nao e `Error`: e um objeto com
 * `message` e `code`, e `String()` dele dava "[object Object]" — o log
 * dizia que falhou, mas nao o que.
 */
export function mensagemDoErro(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const campos = error as Record<string, unknown>;
    const partes = ["message", "code", "details", "hint"]
      .map((k) => campos[k])
      .filter((v): v is string | number => (typeof v === "string" && v.length > 0) || typeof v === "number");
    if (partes.length) return partes.join(" · ");
    try {
      return JSON.stringify(error).slice(0, 300);
    } catch {
      return "erro sem mensagem";
    }
  }
  return String(error);
}

/**
 * Manda o alerta sem atrasar a resposta. `after` roda depois que a
 * resposta saiu e segura a funcao viva ate terminar — sem ele, a Vercel
 * congela a funcao assim que responde e o alerta se perde no meio.
 * Fora de uma requisicao (script, build) `after` nao existe; ai vai solto.
 */
function agendarAlerta(tarefa: () => Promise<void>) {
  try {
    after(tarefa);
  } catch {
    void tarefa();
  }
}

/** Marca o inicio de uma operacao e devolve quanto tempo passou, em ms. */
export function startTimer() {
  const began = Date.now();
  return () => Date.now() - began;
}
