import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { formatDayTotal, formatItemCost } from "@/lib/cost";
import {
  chaveCanonica,
  custoTotal,
  lerRoteiroPublico,
  listarRoteirosPublicos,
} from "@/lib/roteiros-publicos";
import { SITE_URL } from "@/lib/site";

/**
 * A pagina de um destino, escrita para quem chega pelo Google.
 *
 * Um dia de cache: o roteiro de amostra praticamente nao muda, e o que a
 * pagina precisa ser e rapida e estavel para o rastreador.
 */
export const revalidate = 86400;

/**
 * Gera as paginas no build. Sem isso a primeira visita de cada destino —
 * que costuma ser a do Googlebot — pagaria uma ida ao banco, e rastreador
 * lento rastreia menos.
 */
export async function generateStaticParams() {
  const roteiros = await listarRoteirosPublicos();
  return roteiros.map((r) => ({ destino: r.chave }));
}

function moedaBR(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destino: string }>;
}): Promise<Metadata> {
  const { destino } = await params;
  const roteiro = await lerRoteiroPublico(destino);
  if (!roteiro) return { title: "Roteiro não encontrado — Planvoro" };

  const dias = roteiro.dias.length;
  const total = custoTotal(roteiro.dias);

  // O title responde a busca com as palavras da busca. "Planvoro" no fim
  // porque marca desconhecida no comeco so ocupa o espaco que o Google
  // mostra e nao ajuda ninguem a clicar.
  const title = `Roteiro de ${dias} dias em ${roteiro.destino} — quanto custa cada parada`;
  const description =
    total > 0
      ? `Roteiro dia a dia em ${roteiro.destino} a partir de ${moedaBR(
          total
        )}, com horário e custo estimado de cada parada. Monte o seu, de graça e sem criar conta.`
      : `Roteiro dia a dia em ${roteiro.destino}, com horário e custo estimado de cada parada. Monte o seu, de graça e sem criar conta.`;

  return {
    title: `${title} — Planvoro`,
    description,
    alternates: { canonical: `/roteiro/${roteiro.chave}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function RoteiroDoDestino({
  params,
}: {
  params: Promise<{ destino: string }>;
}) {
  const { destino } = await params;

  // Uma cidade, um endereco: /roteiro/roma manda para /roteiro/roma-italia
  // em vez de servir a mesma coisa em duas URLs.
  const canonica = await chaveCanonica(destino);
  if (canonica !== destino) permanentRedirect(`/roteiro/${canonica}`);

  const roteiro = await lerRoteiroPublico(destino);
  if (!roteiro) notFound();

  const total = custoTotal(roteiro.dias);
  const outros = (await listarRoteirosPublicos())
    .filter((r) => r.chave !== roteiro.chave)
    .slice(0, 8);

  return (
    <div className="sample-shell">
      {/*
        JSON-LD para o Google entender que isto e um roteiro com etapas,
        e nao um texto qualquer. E o que abre a chance de aparecer com as
        paradas listadas no resultado, em vez de duas linhas de texto.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TouristTrip",
            name: `Roteiro de ${roteiro.dias.length} dias em ${roteiro.destino}`,
            description: roteiro.rationale || undefined,
            url: `${SITE_URL}/roteiro/${roteiro.chave}`,
            ...(total > 0
              ? { offers: { "@type": "Offer", price: total, priceCurrency: "BRL" } }
              : {}),
            itinerary: {
              "@type": "ItemList",
              numberOfItems: roteiro.dias.reduce((n, d) => n + d.items.length, 0),
              itemListElement: roteiro.dias.flatMap((dia, di) =>
                dia.items.map((item, ii) => ({
                  "@type": "ListItem",
                  position: di * 100 + ii + 1,
                  name: item.title,
                  description: item.description,
                }))
              ),
            },
          }),
        }}
      />

      <header className="sample-head">
        <p className="eyebrow">Roteiro de exemplo · montado pela IA do Planvoro</p>
        <h1>
          Roteiro de {roteiro.dias.length} dias em {roteiro.destino}, com o preço de cada parada
        </h1>
        <p className="sub">
          {total > 0 ? (
            <>
              Este roteiro sai por cerca de <b>{moedaBR(total)}</b> em passeios e refeições — sem
              contar passagem e hospedagem. Cada parada abaixo tem horário e custo estimado, que é
              o que uma lista de atrações não te dá.
            </>
          ) : (
            <>
              Cada parada abaixo tem horário e custo estimado, que é o que uma lista de atrações
              não te dá.
            </>
          )}
        </p>
        <div className="sample-chips">
          <a className="btn" href={`/experimente?d=${encodeURIComponent(roteiro.destino)}`}>
            Montar o meu para {roteiro.destino}
          </a>
        </div>
      </header>

      {roteiro.rationale && (
        <div className="card">
          <span className="badge b-ok">por que ficou assim</span>
          <p className="sub" style={{ marginTop: 8 }}>
            {roteiro.rationale}
          </p>
        </div>
      )}

      <div className="card">
        {roteiro.dias.map((dia) => (
          <div className="day" key={dia.day_date}>
            <div className="day-h">
              <b>{dia.title || dia.day_date}</b>
              <span className="muted">{formatDayTotal(dia.items)}</span>
            </div>
            {dia.note && <p className="item-d">{dia.note}</p>}
            {dia.items.map((item, index) => (
              <div className="item" key={`${dia.day_date}-${index}`}>
                <div className="time">{item.start_time}</div>
                <div className="item-b">
                  <div className="item-t">{item.title}</div>
                  <div className="item-d">{item.description}</div>
                </div>
                <div className="cost">
                  {formatItemCost(
                    item.cost_estimate,
                    item.cost_local ?? null,
                    item.cost_currency ?? null
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card cta-box">
        <h2 style={{ margin: "0 0 6px" }}>Suas datas são outras, seu grupo também</h2>
        <p className="sub">
          Este aqui é um exemplo fixo. Diga o seu destino e a IA monta o seu em cerca de um minuto,
          de graça e sem criar conta. Depois, se quiser, você convida o grupo para dizer o que cada
          um quer e o roteiro se remonta equilibrando todo mundo.
        </p>
        <a className="btn" href={`/experimente?d=${encodeURIComponent(roteiro.destino)}`}>
          Montar meu roteiro
        </a>
        <p className="tiny" style={{ marginTop: 12 }}>
          Roteiros, horários e preços são gerados por IA e podem conter erros. Confira na fonte
          antes de ir.
        </p>
      </div>

      {outros.length > 0 && (
        <div className="card">
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Outros destinos</h2>
          <div className="sample-chips">
            {outros.map((r) => (
              <a className="btn ghost sm" key={r.chave} href={`/roteiro/${r.chave}`}>
                {r.destino}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
