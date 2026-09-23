import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false },
};

/**
 * 404 em portugues.
 *
 * Sem este arquivo o Next mostrava "404 | This page could not be found."
 * em ingles, sem menu util e sem saida — inclusive para quem abria um
 * roteiro publico que foi apagado.
 */
export default function NotFound() {
  return (
    <div className="status-page">
      <p className="status-code">404</p>
      <h1>Essa página não existe (ou não existe mais).</h1>
      <p className="sub">
        O link pode estar incompleto, ou a viagem foi apagada por quem organizou. Se alguém te
        mandou esse endereço, peça o link de novo.
      </p>
      <div className="status-actions">
        <a className="btn" href="/">
          Ir para o início
        </a>
        <a className="btn ghost" href="/app">
          Minhas viagens
        </a>
        <a className="btn ghost" href="/experimente">
          Ver um roteiro de exemplo
        </a>
      </div>
    </div>
  );
}
