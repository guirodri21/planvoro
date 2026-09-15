"use client";

import { track } from "@/lib/analytics";
import { betaAccessEnabled } from "@/lib/beta";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";

/**
 * Faixa de plano na area do usuario.
 *
 * O painel dizia so "Tudo liberado para testar" e oferecia um botao de
 * assinar. Quem nunca leu a home nao tinha como saber que existe um Passe
 * por viagem nem o que ele libera — e nao havia caminho nenhum para
 * descobrir sem sair da area logada.
 *
 * Aqui fica o essencial: o que a pessoa tem hoje, o teste gratis se ela
 * ainda nao usou, e um caminho para a tabela de precos. A tabela em si
 * vive na home e continua sendo um lugar so — duplicar os tres planos
 * aqui dentro criaria duas listas de preco para manter em sincronia.
 */
export function Planos({
  proAtivo,
  proExpiraEm,
  podeComprar,
  temTeste,
  testeExpiraEm,
  testeViagem,
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
  /** Destino da viagem que esta no teste. O teste vale para uma so. */
  testeViagem: string | null;
  acao: string;
  onPro: () => void;
  onTeste: () => void;
}) {
  const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  const testeAtivo = Boolean(testeExpiraEm && new Date(testeExpiraEm).getTime() > Date.now());

  const titulo = betaAccessEnabled
    ? "Tudo liberado para testar"
    : proAtivo
      ? "Planvoro Pro ativo"
      : testeAtivo
        ? "Teste grátis em uma viagem"
        : "Cresça quando precisar";

  const descricao = betaAccessEnabled
    ? "Durante a beta ninguém paga nada. A cobrança já está pronta para quando a gente ligar."
    : proAtivo
      ? proExpiraEm
        ? `Vale até ${data(proExpiraEm)}. Não renova sozinho.`
        : "Viagens ilimitadas, sem mensalidade."
      : testeAtivo && testeExpiraEm
        ? /*
             Nomeia a viagem, porque o teste vale para uma so.
             Sem o nome, esta linha anunciava "Cofre, gastos e checklist
             liberados" como se valesse para a conta inteira — e quem
             abria as outras viagens as encontrava trancadas, depois de
             ler no painel que tinha acesso.
          */
          `${
            testeViagem ? `"${testeViagem}"` : "Uma viagem"
          } está com Cofre, gastos e checklist liberados até ${data(
            testeExpiraEm
          )}. As outras seguem no plano grátis.`
        : `Roteiro e grupo são grátis para sempre. Libere uma viagem por R$ ${
            BILLING_COPY.trip_pass.amount / 100
          } ou pegue o Pro por R$ ${BILLING_COPY.pro_annual.amount / 100} ao ano.`;

  return (
    <div className="billing-panel">
      <div>
        <p className="eyebrow">{betaAccessEnabled ? "Beta grátis" : "Seu plano"}</p>
        <h2>{titulo}</h2>
        <p className="sub">{descricao}</p>
      </div>

      <div className="billing-actions">
        {/* O teste vem antes de qualquer botao de pagar: e o unico que nao
            custa nada para quem clica, e o que faz a pessoa entender o que
            esta comprando depois. */}
        {!proAtivo && !temTeste && !testeAtivo && (
          <button className="btn" type="button" onClick={onTeste} disabled={acao === "trial"}>
            {acao === "trial" ? "Liberando..." : `Testar ${TRIAL_DIAS} dias grátis`}
          </button>
        )}

        {proAtivo && <span className="badge b-ok">Pro ativo</span>}
        {testeAtivo && <span className="badge b-ok">Teste ativo</span>}

        {!proAtivo && podeComprar && (
          <button
            className="btn ghost"
            type="button"
            onClick={onPro}
            disabled={acao === "pro_annual"}
          >
            {acao === "pro_annual" ? "Abrindo checkout..." : "Pegar o Pro"}
          </button>
        )}

        {/* A tabela completa mora na home. Levar para la custa um clique e
            evita manter dois lugares dizendo quanto custa cada plano. */}
        <a className="btn ghost" href="/#precos" onClick={() => track("planos_abertos")}>
          Ver planos
        </a>
      </div>
    </div>
  );
}
