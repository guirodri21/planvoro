"use client";

import { track } from "@/lib/analytics";
import { betaAccessEnabled } from "@/lib/beta";
import { TRIAL_DIAS } from "@/lib/billing";

/**
 * O plano da conta, numa linha.
 *
 * Era um cartao com titulo, paragrafo e tres botoes empilhados ("Testar",
 * "Pegar o Pro", "Ver planos") — um dos blocos mais chamativos do painel,
 * disputando atencao com as viagens. Quem so quer abrir a viagem nao
 * precisa de uma vitrine a cada visita. Aqui fica o que a pessoa tem hoje,
 * o teste gratis se ainda existir, e o caminho para /planos, onde mora a
 * tabela de precos (um lugar so, para nao manter duas listas de preco).
 */
export function Planos({
  proAtivo,
  proExpiraEm,
  temTeste,
  testeExpiraEm,
  testeViagem,
  testeConta = false,
  passesGuardados = 0,
  acao,
  erro = "",
  onTeste,
}: {
  proAtivo: boolean;
  proExpiraEm: string | null;
  /** Ja usou o teste gratis alguma vez. */
  temTeste: boolean;
  testeExpiraEm: string | null;
  /** Destino da viagem que esta no teste. O teste vale para uma so. */
  testeViagem: string | null;
  /** O teste vale para a conta toda (comecou sem viagem propria). */
  testeConta?: boolean;
  /** Passes pagos antes de existir viagem, esperando a proxima. */
  passesGuardados?: number;
  acao: string;
  /**
   * Erro do teste ou do pagamento, dentro da faixa, colado no botao. Fora
   * dela, no celular, o aviso ia parar em outra ponta da pagina e quem
   * clicava achava que o botao nao fazia nada.
   */
  erro?: string;
  onTeste: () => void;
}) {
  const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const testeAtivo = Boolean(testeExpiraEm && new Date(testeExpiraEm).getTime() > Date.now());

  const [titulo, detalhe] = betaAccessEnabled
    ? ["Beta grátis", "tudo liberado, sem cobrança"]
    : proAtivo
      ? ["Planvoro Pro", proExpiraEm ? `até ${data(proExpiraEm)}` : "viagens ilimitadas"]
      : testeAtivo && testeExpiraEm
        ? [
            "Teste grátis",
            /*
              Nomeia a viagem quando o teste e de uma so: sem o nome, a
              linha soava como acesso da conta inteira, e quem abria as
              outras viagens as encontrava trancadas.
            */
            testeConta
              ? `todas as suas viagens até ${data(testeExpiraEm)}`
              : `${testeViagem ? `"${testeViagem}"` : "uma viagem"} até ${data(testeExpiraEm)}`,
          ]
        : ["Plano grátis", "roteiro e grupo grátis para sempre"];

  const podeTestar = !betaAccessEnabled && !proAtivo && !temTeste && !testeAtivo;

  return (
    <div className="billing-panel painel-plano">
      <p className="painel-plano-texto">
        <strong>{titulo}</strong> <span>· {detalhe}</span>
      </p>

      <div className="painel-plano-acoes">
        {podeTestar && (
          <button className="btn ghost sm" type="button" onClick={onTeste} disabled={acao === "trial"}>
            {acao === "trial" ? "Liberando..." : `Testar ${TRIAL_DIAS} dias grátis`}
          </button>
        )}
        <a className="painel-plano-link" href="/planos" onClick={() => track("planos_abertos")}>
          {proAtivo ? "Ver plano" : "Ver planos"}
        </a>
      </div>

      {passesGuardados > 0 && (
        <p className="painel-plano-nota">
          {passesGuardados === 1 ? "Você tem 1 Passe pago guardado" : `Você tem ${passesGuardados} Passes pagos guardados`}
          : a próxima viagem que você criar já nasce liberada. <a href="/nova">Criar viagem</a>
        </p>
      )}

      {erro && (
        <div className="err" role="alert">
          {erro}
        </div>
      )}
    </div>
  );
}
