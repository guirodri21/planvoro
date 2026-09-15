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
  emit("error", {
    ...rest,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorName: error instanceof Error ? error.name : "unknown",
  });
}

/** Marca o inicio de uma operacao e devolve quanto tempo passou, em ms. */
export function startTimer() {
  const began = Date.now();
  return () => Date.now() - began;
}
