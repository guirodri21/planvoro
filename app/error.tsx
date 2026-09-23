"use client";

import { useEffect } from "react";

/**
 * Tela de erro inesperado.
 *
 * Sem ela, qualquer excecao no navegador virava a pagina branca do Next
 * com "Application error: a client-side exception has occurred" — em
 * ingles, sem botao e sem dizer se os dados da viagem estavam salvos.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vai para o console do navegador e para os logs da Vercel. Nunca
    // aparece na tela: mensagem interna nao ajuda quem esta usando.
    console.error(error);
  }, [error]);

  return (
    <div className="status-page">
      <p className="status-code">Ops</p>
      <h1>Algo deu errado nesta tela.</h1>
      <p className="sub">
        O que você já salvou continua salvo — o erro foi só ao mostrar a página. Tente de novo;
        se continuar, recarregue ou volte para suas viagens.
      </p>
      <div className="status-actions">
        <button className="btn" type="button" onClick={reset}>
          Tentar de novo
        </button>
        <a className="btn ghost" href="/app">
          Minhas viagens
        </a>
        <a className="btn ghost" href="/contato">
          Avisar o suporte
        </a>
      </div>
      {error.digest && <p className="tiny">Código do erro: {error.digest}</p>}
    </div>
  );
}
