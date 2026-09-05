"use client";

import { betaAccessEnabled } from "@/lib/beta";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";

/**
 * Vitrine de planos na area do usuario.
 *
 * Antes havia uma faixa com um botao so, "Pegar o Pro por 1 ano". Quem
 * nunca leu a home nao fazia ideia de que existia um Passe por viagem, do
 * que ele libera, nem por que o Pro compensaria — e o unico caminho para
 * descobrir era voltar para a pagina inicial, que ninguem faz depois de
 * ja ter conta.
 *
 * Aqui os tres estados aparecem lado a lado, com o que a pessoa ja tem
 * marcado. O teste gratis fica no card do Passe porque e ele que o teste
 * libera: a promessa e "experimente exatamente isto".
 */

const reais = (centavos: number) => (centavos / 100).toFixed(0);

export function Planos({
  proAtivo,
  proExpiraEm,
  podeComprar,
  temTeste,
  testeExpiraEm,
  acao,
  onPro,
  onTeste,
}: {
  proAtivo: boolean;
  proExpiraEm: string | null;
  /** Falso durante a beta, quando ninguem consegue pagar. */
  podeComprar: boolean;
  /** Ja usou o teste gratis alguma vez. */
  temTeste: boolean;
  testeExpiraEm: string | null;
  acao: string;
  onPro: () => void;
  onTeste: () => void;
}) {
  const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

  const testeAtivo = Boolean(
    testeExpiraEm && new Date(testeExpiraEm).getTime() > Date.now()
  );

  return (
    <section className="planos">
      <div className="planos-topo">
        <div>
          <p className="eyebrow">{betaAccessEnabled ? "Beta grátis" : "Planos"}</p>
          <h2>
            {betaAccessEnabled
              ? "Tudo liberado para testar"
              : proAtivo
                ? "Planvoro Pro ativo"
                : "Cresça quando precisar"}
          </h2>
          <p className="sub">
            {betaAccessEnabled
              ? "Durante a beta ninguém paga nada. Os valores abaixo são o que passará a valer quando a cobrança for ligada."
              : "Roteiro e grupo são grátis para sempre. Você só paga para guardar reservas, dividir gastos e usar o Planvoro durante a viagem."}
          </p>
        </div>
      </div>

      <div className="planos-grade">
        <article className="plano">
          <header>
            <h3>Grátis</h3>
            <strong>R$ 0</strong>
            <small>uma viagem ativa por vez</small>
          </header>
          <ul>
            <li>Roteiro por IA</li>
            <li>Grupo ilimitado, convidado nunca paga</li>
            <li>Ideias, votação e comentários</li>
            <li>Página pública do roteiro</li>
          </ul>
          <span className="plano-marca">seu plano de base</span>
        </article>

        <article className={`plano ${!proAtivo ? "plano-destaque" : ""}`}>
          <header>
            <h3>{BILLING_COPY.trip_pass.label}</h3>
            <strong>R$ {reais(BILLING_COPY.trip_pass.amount)}</strong>
            <small>uma vez, por viagem</small>
          </header>
          <ul>
            <li>Cofre de reservas com anexos</li>
            <li>Gastos com divisão e acerto por Pix</li>
            <li>Checklist e modo viagem</li>
            <li>Vale até 90 dias depois da volta</li>
          </ul>

          {/*
            O teste vive aqui, e nao num banner solto, porque e este card
            que ele libera. "Experimente isto por 7 dias" e uma promessa
            que a pessoa consegue conferir na hora.
          */}
          {testeAtivo ? (
            <span className="plano-marca ok">
              Teste ativo até {testeExpiraEm ? data(testeExpiraEm) : "em breve"}
            </span>
          ) : temTeste ? (
            <span className="plano-marca">Você já usou seu teste grátis</span>
          ) : (
            <button
              className="btn full"
              type="button"
              onClick={onTeste}
              disabled={acao === "trial"}
            >
              {acao === "trial" ? "Liberando..." : `Testar ${TRIAL_DIAS} dias grátis`}
            </button>
          )}

          <p className="tiny plano-nota">
            Sem cartão e sem cobrança automática. No fim do teste a viagem tranca de novo, e nada
            do que você salvou é apagado.
          </p>
        </article>

        <article className={`plano ${proAtivo ? "plano-destaque" : ""}`}>
          <header>
            <h3>{BILLING_COPY.pro_annual.label}</h3>
            <strong>R$ {reais(BILLING_COPY.pro_annual.amount)}</strong>
            <small>por ano, sem mensalidade</small>
          </header>
          <ul>
            <li>Tudo do Passe, em viagens ilimitadas</li>
            <li>Importar reserva de PDF e print</li>
            <li>Alertas de orçamento</li>
            <li>Histórico das viagens antigas</li>
          </ul>

          {proAtivo ? (
            <span className="plano-marca ok">
              {proExpiraEm ? `Vale até ${data(proExpiraEm)}` : "Ativo"} · não renova sozinho
            </span>
          ) : podeComprar ? (
            <button
              className="btn full"
              type="button"
              onClick={onPro}
              disabled={acao === "pro_annual"}
            >
              {acao === "pro_annual" ? "Abrindo checkout..." : "Pegar o Pro por 1 ano"}
            </button>
          ) : (
            <span className="plano-marca">Liberado durante a beta</span>
          )}

          <p className="tiny plano-nota">
            A partir da terceira viagem sai mais barato que comprar Passes soltos.
          </p>
        </article>
      </div>
    </section>
  );
}
