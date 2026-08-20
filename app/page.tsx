import Image from "next/image";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="glow" />
        <div className="hero-grid">
          <div>
            <div className="pill">
              <span className="dot-live" /> Sozinho ou com o grupo inteiro
            </div>
            <h1 className="h1">
              Seu roteiro pronto.
              <br />
              Sem 200 mensagens no grupo.
            </h1>
            <p className="lead">
              Você marca o que gosta e a IA monta o roteiro dia a dia — conferindo se cada lugar
              existe mesmo. Se for em grupo, ela equilibra as preferências de todo mundo.
            </p>
            <div className="hero-cta">
              <a href="/nova" className="btn lg">
                Criar viagem grátis
              </a>
              <a href="#roteiro" className="btn lg ghost">
                Ver um roteiro pronto
              </a>
            </div>
            <p className="tiny" style={{ marginTop: 16 }}>
              Grátis para começar · Sem cartão · Quem você convidar não precisa criar conta
            </p>
          </div>

          <div className="mock">
            <div className="mock-bar">
              <i />
              <i />
              <i />
              <span>planvoro.app/v/lisboa-outubro</span>
            </div>
            <div className="mock-body">
              <div className="day">
                <div className="day-h">
                  <b>Seg · 13 out — Baixa e Alfama</b>
                  <span className="muted">~R$ 310</span>
                </div>
                <div className="item">
                  <div className="time">10:30</div>
                  <div className="item-b">
                    <div className="item-t">
                      Time Out Market <span className="badge b-ok">verificado</span>
                    </div>
                    <div className="item-d">Brunch. 4 opções vegetarianas.</div>
                  </div>
                  <div className="cost">R$ 90</div>
                </div>
                <div className="item">
                  <div className="time">13:00</div>
                  <div className="item-b">
                    <div className="item-t">
                      Elevador de Santa Justa <span className="badge b-ok">verificado</span>
                    </div>
                    <div className="item-d">8 min a pé. Fila menor antes das 14h.</div>
                  </div>
                  <div className="cost">R$ 35</div>
                </div>
                <div className="item">
                  <div className="time">21:00</div>
                  <div className="item-b">
                    <div className="item-t">
                      Jantar — 3 opções <span className="badge b-vote">votando</span>
                    </div>
                    <div className="item-d">O grupo está dividido. 6 de 8 já votaram.</div>
                  </div>
                  <div className="cost">~R$ 185</div>
                </div>
              </div>
              <div className="note" style={{ marginTop: 4 }}>
                <b>Por que ficou assim</b>
                <br />
                Comecei tarde porque a Marina chega 9h30 e três pessoas pediram para não acordar
                cedo. Todos os restaurantes têm opção vegetariana.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DOIS CAMINHOS */}
      <section id="como">
        <p className="eyebrow">Dois jeitos de usar</p>
        <h2 className="h2">Comece sozinho. Chame a galera depois.</h2>
        <p className="lead">
          Quase ninguém acorda decidindo organizar uma viagem em grupo. Você começa pesquisando
          sozinho — e só depois chama o pessoal. O Planvoro funciona nessa ordem.
        </p>

        <div className="grid2" style={{ marginTop: 36 }}>
          <div className="card">
            <span className="badge b-ok" style={{ marginLeft: 0 }}>
              mais rápido
            </span>
            <h3 style={{ marginTop: 14 }}>🎒 Vou sozinho</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Marque seus interesses, restrições e orçamento. Em menos de um minuto o roteiro está
              pronto, com horários, custo por dia e deslocamento realista entre os lugares.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <span>Roteiro dia a dia</span>
              <span className="small muted">2 minutos</span>
            </div>
            <div className="row">
              <span>Lugares verificados</span>
              <span className="small muted">automático</span>
            </div>
            <div className="row">
              <span>Link público para compartilhar</span>
              <span className="small muted">incluso</span>
            </div>
          </div>

          <div className="card">
            <span className="badge b-vote" style={{ marginLeft: 0 }}>
              o que ninguém faz
            </span>
            <h3 style={{ marginTop: 14 }}>👥 Vou em grupo</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Mande o link no WhatsApp. Cada pessoa marca o que quer, e a IA remonta o roteiro
              equilibrando quem é vegetariano, quem odeia museu, quem chega depois e quem tem menos
              orçamento.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <span>Convite sem cadastro</span>
              <span className="small muted">link direto</span>
            </div>
            <div className="row">
              <span>Votação quando o grupo se divide</span>
              <span className="small muted">incluso</span>
            </div>
            <div className="row">
              <span>Divisão de despesas por Pix</span>
              <span className="small muted">incluso</span>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section>
        <p className="eyebrow">O problema</p>
        <h2 className="h2">Todo app de viagem assume que você viaja sozinho</h2>
        <p className="lead">
          E quando não é o caso, tudo desanda. É aí que a gente é diferente.
        </p>

        <div className="grid2" style={{ marginTop: 36, alignItems: "stretch" }}>
          <div className="wa">
            <p className="tiny" style={{ margin: "0 0 14px" }}>
              Grupo da viagem · 8 participantes
            </p>
            <div className="bub">
              <b>Ana</b>gente alguém decidiu o que a gente vai fazer segunda?
            </div>
            <div className="bub">
              <b>João</b>museu não né pfvr
            </div>
            <div className="bub me">achei um restaurante, mando o link</div>
            <div className="bub">
              <b>Marina</b>lembrando que eu só chego dia 14
            </div>
            <div className="bub">
              <b>Lucas</b>esse aí tá fora do meu orçamento gente
            </div>
            <div className="bub" style={{ opacity: 0.5 }}>
              + 187 mensagens
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <h3>Ninguém lê 200 mensagens</h3>
              <p className="small" style={{ marginTop: 7 }}>
                O que foi decidido some no meio da conversa. Três dias depois alguém pergunta a
                mesma coisa de novo.
              </p>
            </div>
            <div className="card">
              <h3>A planilha morre na segunda semana</h3>
              <p className="small" style={{ marginTop: 7 }}>
                Uma pessoa monta, ninguém atualiza, e vira um documento que todo mundo ignora.
              </p>
            </div>
            <div className="card">
              <h3>Sempre tem alguém que fica de fora</h3>
              <p className="small" style={{ marginTop: 7 }}>
                Quem é vegetariano, quem não acorda cedo, quem tem menos orçamento, quem chega
                depois.
              </p>
            </div>
            <div className="card">
              <h3>E no fim ninguém sabe quem deve quanto</h3>
              <p className="small" style={{ marginTop: 7 }}>
                A viagem acaba e começa a parte chata: reconstruir de memória quem pagou o quê.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROTEIRO */}
      <section id="roteiro">
        <div className="grid2" style={{ alignItems: "center", gap: 48 }}>
          <div>
            <p className="eyebrow">O roteiro</p>
            <h2 className="h2">A IA explica por que ficou assim</h2>
            <p className="lead">
              Não é uma lista genérica de pontos turísticos. É um roteiro que sabe quem você é — e
              que te conta o raciocínio.
            </p>
            <div style={{ marginTop: 24 }}>
              <div className="row">
                <span>
                  <b>Respeita restrição alimentar</b>
                  <div className="small muted">Todo restaurante serve quem vai à mesa</div>
                </span>
              </div>
              <div className="row">
                <span>
                  <b>No máximo 4 atividades por dia</b>
                  <div className="small muted">Roteiro sufocado é o erro mais comum</div>
                </span>
              </div>
              <div className="row">
                <span>
                  <b>Lugares próximos no mesmo dia</b>
                  <div className="small muted">Sem atravessar a cidade três vezes</div>
                </span>
              </div>
              <div className="row">
                <span>
                  <b>Nada de lugar inventado</b>
                  <div className="small muted">
                    Conferido contra dados reais antes de entrar no roteiro
                  </div>
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="row">
              <span>
                <b>Time Out Market</b>
                <div className="small muted">Cais do Sodré</div>
              </span>
              <span className="badge b-ok">verificado</span>
            </div>
            <div className="row">
              <span>
                <b>Mosteiro dos Jerónimos</b>
                <div className="small muted">Belém</div>
              </span>
              <span className="badge b-ok">verificado</span>
            </div>
            <div className="row" style={{ opacity: 0.45 }}>
              <span>
                <b>Casa do Bacalhau</b>
                <div className="small muted">não encontrado — removido do roteiro</div>
              </span>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>
              Recomendar restaurante que já fechou é a reclamação número um dos concorrentes. Aqui
              isso não passa.
            </p>
          </div>
        </div>
      </section>

      {/* PRECOS */}
      <section id="precos">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }}>
          <p className="eyebrow">Preços</p>
          <h2 className="h2">
            Você viaja 2 vezes por ano.
            <br />
            Por que pagaria 12?
          </h2>
          <p className="lead" style={{ marginLeft: "auto", marginRight: "auto" }}>
            Por isso o plano principal é por viagem. O organizador paga uma vez e libera pro grupo
            inteiro.
          </p>
        </div>

        <div className="grid3" style={{ alignItems: "stretch" }}>
          <div className="plan">
            <h3>Grátis</h3>
            <div className="price">R$ 0</div>
            <p className="tiny">Pra sentir o gosto</p>
            <ul className="feat">
              <li>1 viagem ativa</li>
              <li>Até 3 pessoas</li>
              <li>3 roteiros por mês</li>
              <li>Link público</li>
              <li className="off">Votação e comentários</li>
            </ul>
            <a href="/nova" className="btn ghost" style={{ marginTop: 20 }}>
              Começar grátis
            </a>
          </div>

          <div className="plan hi">
            <span className="plan-badge">MAIS ESCOLHIDO</span>
            <h3>Por viagem</h3>
            <div className="price">
              R$ 79 <small>uma vez</small>
            </div>
            <p className="tiny">Libera pro grupo inteiro</p>
            <ul className="feat">
              <li>Grupo ilimitado</li>
              <li>Roteiros ilimitados</li>
              <li>Votação e comentários</li>
              <li>Despesas com Pix</li>
              <li>Vale até 30 dias após a volta</li>
            </ul>
            <a href="/nova" className="btn" style={{ marginTop: 20 }}>
              Criar viagem
            </a>
          </div>

          <div className="plan">
            <h3>Pro anual</h3>
            <div className="price">
              R$ 149 <small>/ ano</small>
            </div>
            <p className="tiny">Pra quem viaja bastante</p>
            <ul className="feat">
              <li>Viagens ilimitadas</li>
              <li>Tudo do plano por viagem</li>
              <li>Otimização de rota</li>
              <li>Histórico completo</li>
            </ul>
            <a href="/nova" className="btn ghost" style={{ marginTop: 20 }}>
              Assinar Pro
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 820, margin: "0 auto" }}>
        <p className="eyebrow">Dúvidas</p>
        <h2 className="h2">Perguntas, respostas</h2>
        <div style={{ marginTop: 28 }}>
          <details>
            <summary>Preciso viajar em grupo pra usar?</summary>
            <p>
              Não. Dá pra usar sozinho e receber o roteiro na hora. O grupo é onde o Planvoro
              brilha, mas nunca foi obrigatório — e você pode transformar uma viagem individual em
              viagem de grupo a qualquer momento.
            </p>
          </details>
          <details>
            <summary>Quem eu convidar precisa criar conta?</summary>
            <p>
              Não. A pessoa entra pelo link só com o primeiro nome e já marca as preferências.
              Fricção de convite é o que mata app de grupo — tiramos essa barreira de propósito.
            </p>
          </details>
          <details>
            <summary>A IA não vai inventar lugar que não existe?</summary>
            <p>
              Todo lugar sugerido é conferido contra uma base de dados real antes de entrar no
              roteiro. O que não é encontrado simplesmente não aparece.
            </p>
          </details>
          <details>
            <summary>E se as pessoas do grupo quiserem coisas opostas?</summary>
            <p>
              É pra isso que o produto existe. A IA equilibra o que dá, e o que não dá vira votação
              dentro do roteiro. No fim ela explica quais conflitos existiam e como resolveu cada
              um.
            </p>
          </details>
          <details>
            <summary>Dá pra usar durante a viagem?</summary>
            <p>
              Sim — e é onde ele fica mais útil. Roteiro do dia, despesas registradas na hora e o
              acerto final por Pix quando todo mundo volta.
            </p>
          </details>
          <details>
            <summary>Posso reservar voo e hotel por aqui?</summary>
            <p>
              Ainda não. Hoje mostramos onde reservar e você fecha direto com o fornecedor.
              Preferimos fazer o planejamento muito bem feito antes de virar mais uma agência de
              viagem.
            </p>
          </details>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="cta-box" style={{ textAlign: "center" }}>
          <Image
            src="/logo.png"
            alt=""
            width={60}
            height={60}
            style={{ margin: "0 auto 20px", display: "block" }}
          />
          <h2 className="h2">Comece agora, sozinho.</h2>
          <p className="lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
            Leva dois minutos. Se der vontade de chamar alguém, o link está a um clique.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 26,
              flexWrap: "wrap",
            }}
          >
            <a href="/nova" className="btn lg">
              Criar viagem grátis
            </a>
          </div>
          <p className="tiny" style={{ marginTop: 14 }}>
            Sem cartão · Sem instalar nada · Funciona no navegador do celular
          </p>
        </div>
      </section>
    </>
  );
}
