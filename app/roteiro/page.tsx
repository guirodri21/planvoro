import type { Metadata } from "next";
import { custoTotal, listarRoteirosPublicos } from "@/lib/roteiros-publicos";

export const revalidate = 86400;

export const metadata: Metadata = {
  // O "— Planvoro" vem do template do layout; repetir aqui duplicava.
  title: "Roteiros prontos, com o preço de cada parada",
  description:
    "Roteiros de 2 dias montados pela IA do Planvoro, com horário e custo estimado de cada parada. Escolha um destino ou monte o seu de graça.",
  alternates: { canonical: "/roteiro" },
};

function moedaBR(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * O indice da vitrine.
 *
 * Existe tanto para a pessoa quanto para o rastreador: sem uma pagina que
 * aponte para todas, cada destino fica ilhado e depende so do sitemap
 * para ser encontrado — o que o Google trata como sinal fraco.
 */
export default async function IndiceDeRoteiros() {
  const roteiros = await listarRoteirosPublicos();

  return (
    <div className="sample-shell">
      <header className="sample-head">
        <p className="eyebrow">Exemplos reais, gerados pelo produto</p>
        <h1>Roteiros prontos, com o preço de cada parada</h1>
        <p className="sub">
          Cada roteiro abaixo foi montado pela IA do Planvoro e traz horário e custo estimado de
          cada parada. Se o seu destino não estiver aqui, é só pedir — leva cerca de um minuto e
          não precisa de conta.
        </p>
        <div className="sample-chips">
          <a className="btn" href="/experimente">
            Montar o meu
          </a>
        </div>
      </header>

      {roteiros.length === 0 ? (
        <div className="card">
          <p className="sub">
            Nenhum roteiro de exemplo disponível agora.{" "}
            <a href="/experimente">Monte o seu</a> — funciona do mesmo jeito.
          </p>
        </div>
      ) : (
        <div className="card">
          {roteiros.map((r) => {
            const total = custoTotal(r.dias);
            return (
              <div className="item" key={r.chave}>
                <div className="item-b">
                  <div className="item-t">
                    <a href={`/roteiro/${r.chave}`}>
                      Roteiro de {r.dias.length} dias em {r.destino}
                    </a>
                  </div>
                  <div className="item-d">
                    {r.dias.reduce((n, d) => n + d.items.length, 0)} paradas com horário e custo
                  </div>
                </div>
                <div className="cost">{total > 0 ? `~${moedaBR(total)}` : "—"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
