/**
 * Erros que nenhuma rota tratou (excecao que escapou de um route handler
 * ou de uma pagina renderizada no servidor). O Next ja escreve no log;
 * aqui eles tambem entram no alerta por e-mail (lib/alertas.ts).
 *
 * Import dinamico e so no runtime Node: o alerta usa o cliente admin do
 * Supabase, que nao tem lugar no runtime edge.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { alertarErro } = await import("./lib/alertas");
  const { mensagemDoErro } = await import("./lib/logger");
  await alertarErro({
    evento: "erro_nao_tratado",
    rota: `${request.method} ${context.routePath}`,
    mensagem: mensagemDoErro(error),
  });
}
