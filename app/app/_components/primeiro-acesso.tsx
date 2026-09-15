"use client";

import { betaAccessEnabled } from "@/lib/beta";

/**
 * Painel de quem ainda nao tem viagem.
 *
 * Antes essa pessoa via o mesmo painel de sempre: quatro cartoes de
 * metrica zerados, um bloco de plano e, so la embaixo, a explicacao do
 * que fazer. Numero zerado nao informa nada — ele so ocupa o lugar da
 * unica coisa que importa no primeiro acesso, que e saber por onde
 * comecar.
 *
 * Aqui a ordem e outra: o que fazer primeiro, como funciona, e onde a
 * pessoa esta no caminho. Os numeros continuam existindo, pequenos e ao
 * lado, dizendo por que estao zerados.
 */

const DESTINOS = [
  { nome: "Rio de Janeiro", sobre: "Praia, mirante e samba", tom: "rio" },
  { nome: "Lisboa", sobre: "Miradouros, bairros e fado", tom: "lisboa" },
  { nome: "Salvador", sobre: "Centro histórico e praia", tom: "salvador" },
  { nome: "Buenos Aires", sobre: "Café, livraria e parrilla", tom: "buenos" },
];

const PASSOS = [
  { titulo: "Você conta", sobre: "destino, datas e o que o grupo gosta" },
  { titulo: "A IA monta", sobre: "dias em sequência, com custo e deslocamento" },
  { titulo: "Vocês ajustam", sobre: "troca, vota e decide junto" },
];

const TRILHA = [
  { rotulo: "Conta criada", estado: "feito" as const },
  { rotulo: "Criar primeira viagem", estado: "agora" as const },
  { rotulo: "Gerar o roteiro", estado: "depois" as const },
  { rotulo: "Chamar o grupo", estado: "depois" as const },
];

/** "Bom dia" às 9h e "boa noite" às 22h — quem abre à noite percebe. */
function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function PrimeiroAcesso({ nome }: { nome: string }) {
  return (
    <div className="onb">
      <header className="onb-head">
        <div>
          <p className="onb-hello">
            {saudacao()}, {nome} · primeiro acesso
          </p>
          <h1 className="onb-titulo">
            Bem-vindo ao Planvoro. <em>Vamos montar a primeira?</em>
          </h1>
        </div>
        <a className="btn" href="/nova">
          Criar viagem
        </a>
      </header>

      <div className="onb-grid">
        <div className="card onb-hero">
          <span className="onb-marca" aria-hidden="true" />
          <h2>Sua primeira viagem mora aqui.</h2>
          <p className="sub">
            Você diz o destino, as datas e o que o grupo gosta. A IA devolve o roteiro dia a dia,
            com horários e custo. Depois, reservas, documentos, checklist e gastos ficam no mesmo
            lugar.
          </p>

          <div className="onb-cta">
            <a className="btn lg" href="/nova">
              Criar primeira viagem
            </a>
            <a className="btn lg ghost" href="/experimente">
              Ver um exemplo
            </a>
          </div>

          <ol className="onb-passos">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo}>
                <span className="onb-num">{i + 1}</span>
                <span>
                  <b>{passo.titulo}</b>
                  <small>{passo.sobre}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="onb-lado">
          <div className="card onb-trilha">
            <p className="onb-trilha-topo">Sua viagem no Planvoro</p>
            <div className="onb-trilha-medida">
              <span>Etapa 1 de 4</span>
              <b>25%</b>
            </div>
            <div className="onb-barra" role="presentation">
              <i style={{ width: "25%" }} />
            </div>
            <ul>
              {TRILHA.map((item, i) => (
                <li key={item.rotulo} className={`onb-etapa e-${item.estado}`}>
                  <span className="onb-etapa-num">{item.estado === "feito" ? "✓" : i + 1}</span>
                  <span className="onb-etapa-rotulo">{item.rotulo}</span>
                  {item.estado === "agora" && <span className="onb-agora">agora</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="card onb-numeros">
            <h3>Em números</h3>
            <dl>
              <div>
                <dt>Viagens criadas</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Dias planejados</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Próxima saída</dt>
                <dd className="onb-vazio">a definir</dd>
              </div>
            </dl>
            <p className="tiny">Quando você criar a primeira viagem, os números mudam.</p>
          </div>

          {betaAccessEnabled && (
            <p className="onb-beta">
              <b>Beta aberta.</b> Todos os recursos liberados, sem cobrança e sem cartão.
            </p>
          )}
        </aside>
      </div>

      <section className="onb-destinos">
        <h2>Sem ideia ainda? Comece por um destino.</h2>
        <p className="sub">Escolha um e o formulário abre já preenchido.</p>

        <div className="onb-destino-grid">
          {DESTINOS.map((destino) => (
            <a
              key={destino.nome}
              className={`onb-destino t-${destino.tom}`}
              href={`/nova?destino=${encodeURIComponent(destino.nome)}`}
            >
              <span className="onb-destino-arte" aria-hidden="true" />
              <b>{destino.nome}</b>
              <small>{destino.sobre}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
