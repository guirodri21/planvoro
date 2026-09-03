import Image from "next/image";
import { betaAccessDescription, betaAccessEnabled, betaAccessLabel } from "@/lib/beta";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="glow" />
        <div className="hero-grid">
          <div>
            <div className="pill">
              <span className="dot-live" /> Roteiro pronto sem criar conta
            </div>
            <h1 className="h1">
              O roteiro sai em 1 minuto.
              <br />
              A viagem fica organizada até o fim.
            </h1>
            <p className="lead">
              Diga para onde vai e a IA monta o roteiro dia a dia, com horários, custo e
              deslocamento realista entre os lugares. Depois, as reservas, os documentos, os
              gastos e o grupo ficam no mesmo lugar — em vez de sumirem em 200 mensagens no
              WhatsApp.
            </p>

            {/* Um botao so.
                Antes eram dois do mesmo tamanho, e o segundo pedia cadastro.
                Quem chega aqui ainda nao confia o bastante para se cadastrar,
                mas ver um roteiro de verdade custa zero — e e a unica coisa
                que nenhum concorrente entrega antes do login. */}
            <div className="hero-cta">
              <a href="/experimente" className="btn lg">
                Ver um roteiro agora
              </a>
              <span className="cta-selo">sem conta · 1 minuto · grátis</span>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>
              Ou{" "}
              <a href="/entrar?mode=signup&next=%2Fnova" className="linklike">
                criar minha viagem de verdade
              </a>{" "}
              — também grátis, e funciona no celular.
            </p>
          </div>

          <div className="mock command-mock">
            <div className="mock-bar">
              <i />
              <i />
              <i />
              <span>planvoro.app/v/lisboa-portugal</span>
            </div>
            <div className="mock-body command-body">
              <div className="command-top">
                <span className="badge b-ok">Lisboa · 13-18 out</span>
                <h3>Central da viagem</h3>
                <p className="small">
                  8 viajantes, 5 dias, orçamento médio de R$ 3.200 por pessoa.
                </p>
              </div>

              <div className="mock-tabs">
                <span>Roteiro</span>
                <span>Agenda</span>
                <span>Cofre</span>
                <span>Gastos</span>
              </div>

              <div className="mock-stat-grid">
                <div>
                  <b>14</b>
                  <span>itens salvos</span>
                </div>
                <div>
                  <b>6</b>
                  <span>tarefas abertas</span>
                </div>
                <div>
                  <b>R$ 420</b>
                  <span>a acertar</span>
                </div>
              </div>

              <div className="command-panel">
                <div className="mini-row">
                  <span>
                    <b>Voo GIG-LIS</b>
                    <small>PDF anexado · vence check-in em 2 dias</small>
                  </span>
                  <em>Cofre</em>
                </div>
                <div className="mini-row">
                  <span>
                    <b>Segunda · Baixa e Alfama</b>
                    <small>3 atividades, 22 min andando no total</small>
                  </span>
                  <em>Agenda</em>
                </div>
                <div className="mini-row">
                  <span>
                    <b>Jantar de grupo</b>
                    <small>6 de 8 já votaram nas opções</small>
                  </span>
                  <em>Decisão</em>
                </div>
              </div>

              <div className="note" style={{ marginTop: 14 }}>
                <b>Agente Planvoro</b>
                <br />
                "Faltam confirmar hotel, seguro viagem e divisão do transfer. Quer que eu crie as
                tarefas para o grupo?"
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
          Ninguém acorda decidindo organizar uma viagem em grupo. Você começa pesquisando
          sozinho, e só quando a ideia ganha corpo é que chama o pessoal. O Planvoro funciona
          nessa ordem — e é por isso que o roteiro vem antes de qualquer convite.
        </p>

        <div className="grid2" style={{ marginTop: 36 }}>
          <div className="card">
            <span className="badge b-ok" style={{ marginLeft: 0 }}>
              mais rápido
            </span>
            <h3 style={{ marginTop: 14 }}>Vou sozinho</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Marque seus interesses, restrições e orçamento. Em menos de um minuto o roteiro está
              pronto, com horários, custo por dia e deslocamento realista entre os lugares.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <span>Roteiro dia a dia</span>
              <span className="small muted">2 minutos</span>
            </div>
            <div className="row">
              <span>Lugares marcados para conferência</span>
              <span className="small muted">premium</span>
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
            <h3 style={{ marginTop: 14 }}>Vou em grupo</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Mande o link no WhatsApp. Cada pessoa marca o que quer, e a IA remonta o roteiro
              equilibrando quem é vegetariano, quem odeia museu, quem chega depois e quem tem menos
              orçamento.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <span>Entrada com conta em segundos</span>
              <span className="small muted">e-mail e senha</span>
            </div>
            <div className="row">
              <span>Votação quando o grupo se divide</span>
              <span className="small muted">incluso</span>
            </div>
            <div className="row">
              <span>Divisão de despesas com acerto por Pix</span>
              <span className="small muted">roadmap</span>
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

      {/* PRODUTO REAL */}
      <section id="produto">
        <p className="eyebrow">Produto real</p>
        <h2 className="h2">Uma central viva para planejar, guardar e viajar.</h2>
        <p className="lead">
          Cada viagem vira um workspace privado com tudo que normalmente fica espalhado entre
          WhatsApp, e-mail, prints, PDFs, notas e planilhas.
        </p>

        <div className="grid3 product-grid" style={{ marginTop: 36 }}>
          <div className="card product-card">
            <span className="product-number">01</span>
            <h3>Central da viagem</h3>
            <p className="small">
              Roteiro, grupo, cofre, agenda, checklist e gastos conectados no mesmo link.
            </p>
          </div>
          <div className="card product-card">
            <span className="product-number">02</span>
            <h3>Agenda inteligente</h3>
            <p className="small">
              O dia a dia fica claro, com horários, deslocamentos, custos estimados e observações.
            </p>
          </div>
          <div className="card product-card">
            <span className="product-number">03</span>
            <h3>Cofre de reservas</h3>
            <p className="small">
              Guarde voo, hotel, ingressos, seguro, documentos, links e status de confirmação.
            </p>
          </div>
          <div className="card product-card">
            <span className="product-number">04</span>
            <h3>Checklist acionável</h3>
            <p className="small">
              Tarefas por prioridade, responsável e prazo para ninguém descobrir pendência na
              véspera.
            </p>
          </div>
          <div className="card product-card">
            <span className="product-number">05</span>
            <h3>Agente de viagem</h3>
            <p className="small">
              A IA lê o contexto da viagem e sugere próximos passos, alertas e tarefas prontas.
            </p>
          </div>
          <div className="card product-card">
            <span className="product-number">06</span>
            <h3>Gastos e acertos</h3>
            <p className="small">
              Registre quem pagou o quê e veja um resumo simples de quem deve quanto para quem.
            </p>
          </div>
        </div>
      </section>

      {/* TUDO JUNTO */}
      <section className="feature-strip">
        <div>
          <p className="eyebrow">O que entra</p>
          <h2 className="h2">A viagem deixa de ser uma pilha de abas abertas.</h2>
        </div>
        <div className="feature-strip-grid">
          <div>
            <b>Antes da viagem</b>
            <span>IA cria o roteiro, o grupo decide prioridades e o checklist mostra pendências.</span>
          </div>
          <div>
            <b>Durante</b>
            <span>Agenda, reservas e documentos ficam acessíveis no celular, no mesmo lugar.</span>
          </div>
          <div>
            <b>Depois</b>
            <span>Gastos ficam fechados com saldo por pessoa e histórico do que foi planejado.</span>
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
              Não é uma lista genérica de pontos turísticos. É um roteiro que considera o ritmo,
              o orçamento e as preferências do grupo — e mostra o raciocínio.
            </p>
            <div style={{ marginTop: 24 }}>
              <div className="row">
                <span>
                  <b>Respeita restrição alimentar</b>
                  <div className="small muted">A IA prioriza opções compatíveis com o grupo</div>
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
                  <b>Validação com transparência</b>
                  <div className="small muted">
                    Lugares conferidos são marcados; estimativas ficam claras
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
              <span className="badge b-ok">conferido</span>
            </div>
            <div className="row">
              <span>
                <b>Mosteiro dos Jerónimos</b>
                <div className="small muted">Belém</div>
              </span>
              <span className="badge b-ok">conferido</span>
            </div>
            <div className="row" style={{ opacity: 0.45 }}>
              <span>
                <b>Casa do Bacalhau</b>
                <div className="small muted">precisa de confirmação antes de reservar</div>
              </span>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>
              Os preços, horários e disponibilidade podem mudar. O Planvoro sinaliza o que é
              estimativa para você confirmar antes de fechar.
            </p>
          </div>
        </div>
      </section>

      {/* PRECOS */}
      <section id="precos">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }}>
          <p className="eyebrow">{betaAccessEnabled ? betaAccessLabel : "Preços"}</p>
          {betaAccessEnabled ? (
            <>
              <h2 className="h2">
                Teste tudo agora.
                <br />
                Sem pagar nada.
              </h2>
              <p className="lead" style={{ marginLeft: "auto", marginRight: "auto" }}>
                {betaAccessDescription} Queremos validar com grupos reais antes de ligar cobrança.
              </p>
            </>
          ) : (
            <>
              <h2 className="h2">
                Pague uma vez.
                <br />
                Ou nunca.
              </h2>
              <p className="lead" style={{ marginLeft: "auto", marginRight: "auto" }}>
                Sem mensalidade. O roteiro e o grupo são grátis para sempre; você só paga quando
                quiser guardar reservas, dividir gastos e usar o Planvoro durante a viagem.
              </p>
            </>
          )}
        </div>

        <div className="grid3" style={{ alignItems: "stretch" }}>
          <div className="plan hi">
            <span className="plan-badge">{betaAccessEnabled ? "BETA ATIVA" : "COMECE AQUI"}</span>
            <h3>Grátis</h3>
            <div className="price">R$ 0</div>
            <p className="tiny">Uma viagem ativa por vez</p>
            <div className="plan-compare">
              Roteiro de 7 dias, com grupo inteiro:{" "}
              <b>R$ 0 aqui</b>. Em ferramenta que só gera roteiro, o mesmo custa entre R$ 30 e
              R$ 70 por viagem.
            </div>
            <ul className="feat">
              <li>Roteiro por IA com verificação de lugar</li>
              <li>Grupo ilimitado, sem cobrar convidado</li>
              <li>Convite por link e por WhatsApp</li>
              <li>Ideias, votação e comentários</li>
              <li>Página pública do roteiro</li>
              <li>Convidado nunca paga nada</li>
            </ul>
            <a href="/entrar?mode=signup&next=%2Fnova" className="btn" style={{ marginTop: 20 }}>
              Começar de graça
            </a>
          </div>

          <div className="plan">
            <h3>Passe de viagem</h3>
            <div className="price">
              R$ 29 <small>uma vez</small>
            </div>
            <p className="tiny">Uma viagem inteira, o grupo todo</p>
            <ul className="feat">
              <li>Cofre de reservas com anexos</li>
              <li>Gastos com divisão e acerto</li>
              <li>Checklist e modo viagem</li>
              <li>Agente com próximos passos</li>
              <li>Só o organizador paga</li>
              <li>Vale até 90 dias depois da volta</li>
            </ul>
            <a href="/entrar?mode=signup&next=%2Fnova" className="btn ghost" style={{ marginTop: 20 }}>
              {betaAccessEnabled ? "Usar beta grátis" : "Liberar uma viagem"}
            </a>
          </div>

          <div className="plan plan-muted">
            <h3>Pro anual</h3>
            <div className="price">
              R$ 79 <small>por ano</small>
            </div>
            <p className="tiny">A partir da terceira viagem, sai mais barato</p>
            <ul className="feat">
              <li>Tudo do Passe, em viagens ilimitadas</li>
              <li>Importar reserva de PDF e print</li>
              <li>Alertas com previsão de orçamento</li>
              <li>Histórico das viagens antigas</li>
              <li>Recursos novos primeiro</li>
              <li>Sem mensalidade</li>
            </ul>
            <a href="/entrar?mode=signup&next=%2Fapp" className="btn ghost" style={{ marginTop: 20 }}>
              {betaAccessEnabled ? "Entrar na beta" : "Assinar o Pro"}
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
            <summary>Preciso pagar para testar?</summary>
            <p>
              Não. A beta está grátis para validar o produto com viagens reais. Os preços acima são
              o que valerá quando a cobrança for ligada.
            </p>
          </details>
          <details>
            <summary>Quem eu convidar vai precisar pagar?</summary>
            <p>
              Nunca. Entrar na viagem, preencher preferências, votar, comentar e ver o roteiro são
              grátis para sempre, para qualquer pessoa. Só o organizador paga, e só quando quiser
              liberar os recursos do Passe.
            </p>
          </details>
          <details>
            <summary>Por que não tem mensalidade?</summary>
            <p>
              Porque quem viaja duas ou três vezes por ano usa o Planvoro uns dois meses por ano.
              Cobrar todo mês por isso seria vender dez meses de nada. Você paga por viagem, ou uma
              vez ao ano se viaja bastante.
            </p>
          </details>
          <details>
            <summary>Quando vale mais a pena o Pro?</summary>
            <p>
              A partir da terceira viagem. Três passes custam R$ 87 e o Pro anual custa R$ 79 —
              é a mesma conta que você faria sozinho.
            </p>
          </details>
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
              Sim, mas o acesso fica mais confiável. A pessoa cria a conta, entra na viagem e passa
              a ter histórico, votos, comentários e gastos ligados ao próprio perfil.
            </p>
          </details>
          <details>
            <summary>A IA não vai inventar lugar que não existe?</summary>
            <p>
              O produto está preparado para marcar lugares conferidos e separar o que ainda precisa
              de confirmação. Mesmo assim, horários, preços e disponibilidade devem ser revisados
              antes de reservar.
            </p>
          </details>
          <details>
            <summary>Tem Pix?</summary>
            <p>
              Hoje o Planvoro calcula quem deve quanto para quem e organiza o resumo do acerto.
              Pix integrado ainda não está ativo; por enquanto ele ajuda o grupo a fechar as contas
              sem reconstruir tudo de memória.
            </p>
          </details>
          <details>
            <summary>Funciona no celular?</summary>
            <p>
              Sim. O Planvoro é web-first: funciona no navegador do celular, tablet ou computador,
              sem instalar aplicativo nativo.
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
              resumo final de quem deve quanto quando todo mundo volta.
            </p>
          </details>
          <details>
            <summary>Posso reservar voo e hotel por aqui?</summary>
            <p>
              Não. O foco do Planvoro é armazenar e organizar tudo que você já comprou ou decidiu:
              passagem, hotel, seguro, links, PDFs, horários, custos e pendências. A compra continua
              direto com o fornecedor.
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
          <h2 className="h2">Abra sua central de viagem.</h2>
          <p className="lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
            Leva dois minutos para criar o primeiro roteiro. Depois você adiciona reservas,
            checklist, gastos e chama o grupo quando quiser.
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
            <a href="/entrar?mode=signup&next=%2Fnova" className="btn lg">
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
