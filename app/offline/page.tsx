import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem conexão · Planvoro",
};

export default function OfflinePage() {
  return (
    <div className="card">
      <span className="badge b-warn">sem conexão</span>
      <h1 style={{ marginTop: 10 }}>Você está sem sinal</h1>
      <p className="sub">
        Esta página ainda não tinha sido carregada neste aparelho, então não dá para mostrá-la
        agora. As viagens que você já abriu continuam disponíveis.
      </p>
      <div className="note">
        <b>O que funciona sem sinal</b>
        <br />
        Roteiro, Cofre e checklist que você já visitou. Salvar, gerar roteiro e falar com o agente
        voltam assim que a conexão voltar.
      </div>
      <a className="btn" href="/app">
        Minhas viagens
      </a>
    </div>
  );
}
