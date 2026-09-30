import type { Metadata } from "next";
import Image from "next/image";
import { DEFAULT_OPEN_GRAPH } from "@/lib/site";
import { betaAccessDescription, betaAccessEnabled } from "@/lib/beta";
import { RevelarAoRolar } from "@/components/revelar-ao-rolar";

/**
 * Canonical e og:url moravam no layout raiz, e todo filho herdava os dois
 * apontando para a home: /termos, /experimente e cada roteiro publico
 * diziam ao Google "a versao oficial desta pagina e a home". Agora cada
 * pagina declara o seu.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...DEFAULT_OPEN_GRAPH, url: "/" },
};

export default function Home() {
  return (
    <>
      <RevelarAoRolar />
      {/* HERO
          Mesmo texto e um botao so. O "print" do produto mostra o app como
          ele e hoje (capa com a cor do destino, contagem, roteiro com preco
          por parada) — o anterior era uma tela antiga, cheia de numeros. */}
      <section className="hero home-hero">
        <div className="glow" />
        <div className="hero-grid">
          <div>
            <div className="pill">
              <span className="dot-live" />{" "}
              {betaAccessEnabled ? "Beta aberta · tudo liberado, sem cobrança" : "Roteiro pronto sem criar conta"}
            </div>
            <h1 className="h1 hero-title">
              O roteiro sai em 1&nbsp;minuto.{" "}
              <span className="hero-title-soft">A viagem fica organizada até o fim.</span>
            </h1>
            <p className="lead">
              Diga para onde vai e a IA monta o roteiro dia a dia, com horário e preço de cada
              parada. Depois, reservas, gastos e o grupo ficam no mesmo lugar — e não em 200
              mensagens no WhatsApp.
            </p>

            <div className="hero-cta">
              <a href="/experimente" className="btn lg">
                Ver um roteiro agora
              </a>
              <span className="cta-selo">sem conta · 1 minuto · grátis</span>
            </div>
            <p className="tiny hero-alt">
              Ou{" "}
              <a href="/entrar?mode=signup&next=%2Fnova" className="linklike">
                criar minha viagem de verdade
              </a>
              {betaAccessEnabled ? " — na beta, tudo liberado e ninguém paga nada." : " — também grátis."}
            </p>
          </div>

          <div className="home-mock" aria-hidden="true" data-revelar data-revelar-atraso="2">
            <div className="home-mock-capa">
              <strong>12</strong>
              <span>dias para embarcar</span>
            </div>
            <div className="home-mock-corpo">
              <p className="home-mock-rotulo">Próxima viagem</p>
              <h3>Lisboa</h3>
              <p className="small">13 a 18 de out · 8 pessoas</p>

              <div className="home-mock-dia">
                <div className="home-mock-dia-h">
                  <b>Dia 1 · Baixa e Alfama</b>
                  <span>~R$ 235</span>
                </div>
                <div className="home-mock-item">
                  <span>09:30</span>
                  <b>Elétrico 28 até a Sé</b>
                  <em>~R$ 20</em>
                </div>
                <div className="home-mock-item">
                  <span>12:30</span>
                  <b>Almoço no Time Out Market</b>
                  <em>~R$ 95</em>
                </div>
                <div className="home-mock-item">
                  <span>17:00</span>
                  <b>Pôr do sol no Miradouro da Graça</b>
                  <em>grátis</em>
                </div>
                <div className="home-mock-item">
                  <span>20:00</span>
                  <b>Jantar com fado em Alfama</b>
                  <em>~R$ 120</em>
                </div>
              </div>

              <p className="home-mock-grupo">
                <span className="home-mock-avs">
                  <i style={{ background: "#4ade80" }}>A</i>
                  <i style={{ background: "#22d3ee" }}>J</i>
                  <i style={{ background: "#fbbf24" }}>M</i>
                </span>
                6 de 8 já votaram no jantar
              </p>
            </div>
          </div>
        </div>

        <ul className="hero-trust">
          <li>Sem cartão de crédito</li>
          <li>Lugares conferidos no mapa</li>
          <li>Funciona no celular</li>
        </ul>
      </section>

      {/* O PROBLEMA — a conversa do grupo e o que da errado nela. Eram
          quatro cartoes; tres frases curtas dizem o mesmo. */}
      <section className="home-problema">
        <div className="home-problema-grid">
          <div className="wa" data-revelar>
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

          <div>
            <h2 className="h2" data-revelar data-revelar-atraso="1">
              Viagem em grupo não cabe num grupo de WhatsApp.
            </h2>
            <ul className="home-dores" data-revelar data-revelar-atraso="2">
              <li>
                <b>O que foi decidido some.</b> Três dias depois alguém pergunta tudo de novo.
              </li>
              <li>
                <b>Sempre tem alguém de fora.</b> Quem é vegetariano, quem chega depois, quem
                tem menos orçamento.
              </li>
              <li>
                <b>No fim, ninguém sabe quem deve quanto.</b> E a volta começa com uma planilha.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA — tres passos no lugar de "Dois jeitos de usar",
          seis cartoes de funcionalidade e a faixa "O que entra", que
          contavam a mesma historia tres vezes. */}
      <section id="como" className="home-passos">
        <h2 className="h2" data-revelar>
          Como funciona
        </h2>
        <ol>
          <li data-revelar data-revelar-atraso="1">
            <span>1</span>
            <h3>Diga o destino</h3>
            <p>
              A IA monta o roteiro dia a dia em cerca de um minuto: horário, preço de cada parada e
              lugares próximos no mesmo dia. Dá para testar sem criar conta.
            </p>
          </li>
          <li data-revelar data-revelar-atraso="2">
            <span>2</span>
            <h3>Chame o grupo</h3>
            <p>
              Um link no WhatsApp. Cada pessoa marca o que quer e o que não pode, e a IA remonta o
              roteiro equilibrando todo mundo. Quando o grupo se divide, vota.
            </p>
          </li>
          <li data-revelar data-revelar-atraso="3">
            <span>3</span>
            <h3>Viaje com tudo junto</h3>
            <p>
              Voos, hotel e ingressos no Cofre, checklist com responsáveis, gastos divididos com
              acerto por Pix e um agente que sabe o que falta.
            </p>
          </li>
        </ol>
      </section>

      {/* ROTEIRO */}
      <section id="roteiro">
        <div className="grid2" style={{ alignItems: "center", gap: 48 }}>
          <div data-revelar>
            <h2 className="h2">A IA explica por que ficou assim</h2>
            <p className="lead">
              Não é uma lista genérica de pontos turísticos. O roteiro considera o ritmo, o
              orçamento e as preferências do grupo — e mostra o raciocínio.
            </p>
            <ul className="home-regras">
              <li>Respeita restrição alimentar</li>
              <li>No máximo 4 atividades por dia</li>
              <li>Lugares próximos no mesmo dia</li>
              <li>O que é estimativa fica marcado</li>
            </ul>
          </div>

          <div className="card home-conferido" data-revelar data-revelar-atraso="2">
            <div className="row">
              <span>
                <b>Time Out Market</b>
                <div className="small muted">Cais do Sodré</div>
              </span>
              <span className="home-ok">✓ conferido</span>
            </div>
            <div className="row">
              <span>
                <b>Mosteiro dos Jerónimos</b>
                <div className="small muted">Belém</div>
              </span>
              <span className="home-ok">✓ conferido</span>
            </div>
            <div className="row" style={{ opacity: 0.5 }}>
              <span>
                <b>Casa do Bacalhau</b>
                <div className="small muted">confirme antes de reservar</div>
              </span>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>
              Preço, horário e disponibilidade podem mudar. O Planvoro marca o que é estimativa para
              você confirmar antes de fechar.
            </p>
          </div>
        </div>
      </section>

      {/* PRECOS */}
      <section id="precos">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }} data-revelar>
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
          <div className="plan hi" data-revelar data-revelar-atraso="1">
            <span className="plan-badge">{betaAccessEnabled ? "BETA ATIVA" : "COMECE AQUI"}</span>
            <h3>Grátis</h3>
            <div className="price">R$ 0</div>
            <p className="tiny">Até 2 viagens ativas ao mesmo tempo</p>
            <div className="plan-compare">
              {/* Era "Roteiro de 7 dias" ao lado de um teste de 7 dias:
                  o mesmo numero com dois significados, um em cima do
                  outro. Trocado por 5 para desfazer a colisao. */}
              Roteiro de 5 dias, com grupo inteiro:{" "}
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

          <div className="plan" data-revelar data-revelar-atraso="2">
            {betaAccessEnabled && <span className="plan-badge">LIBERADO NA BETA</span>}
            <h3>Passe de viagem</h3>
            <div className="price">
              {betaAccessEnabled ? (
                <>
                  R$ 0 <small>na beta</small>
                </>
              ) : (
                <>
                  R$ 29 <small>uma vez</small>
                </>
              )}
            </div>
            <p className="tiny">
              {betaAccessEnabled
                ? "Uma viagem inteira, o grupo todo. Vai custar R$ 29 quando a cobrança ligar."
                : "Uma viagem inteira, o grupo todo"}
            </p>
            <ul className="feat">
              <li>Cofre de reservas com anexos</li>
              <li>Gastos com divisão e acerto</li>
              <li>Checklist e modo viagem</li>
              <li>Agente com próximos passos</li>
              <li>Só o organizador paga</li>
              <li>Vale até 90 dias depois da volta</li>
            </ul>
            {/* Fora da beta, os botoes pagos levam a /planos, onde da para
                comprar na hora — com ou sem viagem criada. */}
            <a
              href={betaAccessEnabled ? "/entrar?mode=signup&next=%2Fnova" : "/planos"}
              className="btn ghost"
              style={{ marginTop: 20 }}
            >
              {betaAccessEnabled ? "Usar beta grátis" : "Liberar uma viagem"}
            </a>
            {/* O teste era o principal argumento para experimentar o Cofre
                e nao aparecia em lugar nenhum da home: quem chegava pelo
                site nao descobria que existe. */}
            {!betaAccessEnabled && (
              <p className="tiny" style={{ marginTop: 10, textAlign: "center" }}>
                Ou teste 7 dias grátis, sem cartão.
              </p>
            )}
          </div>

          <div className={betaAccessEnabled ? "plan" : "plan plan-muted"} data-revelar data-revelar-atraso="3">
            {betaAccessEnabled && <span className="plan-badge">LIBERADO NA BETA</span>}
            <h3>Pro anual</h3>
            <div className="price">
              {betaAccessEnabled ? (
                <>
                  R$ 0 <small>na beta</small>
                </>
              ) : (
                <>
                  R$ 79 <small>por ano</small>
                </>
              )}
            </div>
            <p className="tiny">
              {betaAccessEnabled
                ? "Viagens ilimitadas. Vai custar R$ 79 por ano quando a cobrança ligar."
                : "A partir da terceira viagem, sai mais barato"}
            </p>
            <ul className="feat">
              <li>Tudo do Passe, em viagens ilimitadas</li>
              <li>Importar reserva de PDF e print</li>
              <li>Alertas com previsão de orçamento</li>
              <li>Histórico das viagens antigas</li>
              <li>Recursos novos primeiro</li>
              <li>Sem mensalidade</li>
            </ul>
            <a
              href={betaAccessEnabled ? "/entrar?mode=signup&next=%2Fapp" : "/planos"}
              className="btn ghost"
              style={{ marginTop: 20 }}
            >
              {betaAccessEnabled ? "Entrar na beta" : "Assinar o Pro"}
            </a>
          </div>
        </div>

        {betaAccessEnabled && (
          <p className="beta-aviso">
            <b>Ninguém paga nada agora.</b> Os valores acima são o que passará a valer quando a
            cobrança for ligada, e não há cartão nem cobrança automática esperando por você:
            hoje não existe forma de pagar no site, mesmo querendo.
          </p>
        )}
      </section>

      {/* FAQ */}
      <section id="faq" className="faq">
        <div className="faq-head" data-revelar>
          <h2 className="h2">Perguntas, respostas</h2>
          <p className="lead">
            Não achou o que procurava?{" "}
            <a href="/contato" className="linklike">
              Fale com a gente
            </a>
          </p>
        </div>
        <div className="faq-list">
          <details>
            <summary>Preciso pagar para testar?</summary>
            <p>
              {betaAccessEnabled
                ? "Não. A beta está grátis para validar o produto com viagens reais. Os preços acima são o que valerá quando a cobrança for ligada."
                : "Não. Montar o roteiro, chamar o grupo e votar são grátis para sempre, sem cartão. Para experimentar o Cofre, os gastos e o checklist, você tem 7 dias grátis em uma viagem — também sem cartão, e sem cobrança automática quando acabar."}
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
              Tem. Na aba de gastos, o Planvoro calcula quem deve quanto para quem e, se quem vai
              receber cadastrou a chave, gera o Pix copia e cola com o valor certo. O dinheiro vai
              direto de uma pessoa para a outra — o Planvoro não intermedia nada.
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
        <div className="cta-box" style={{ textAlign: "center" }} data-revelar>
          <Image
            src="/logo.png"
            alt=""
            width={60}
            height={60}
            style={{ margin: "0 auto 20px", display: "block" }}
          />
          <h2 className="h2">Abra sua central de viagem.</h2>
          <p className="lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
            Leva cerca de um minuto para criar o primeiro roteiro. Depois você adiciona reservas,
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
