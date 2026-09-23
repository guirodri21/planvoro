"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Icon } from "@/components/icons";
import { track } from "@/lib/analytics";
import { betaAccessEnabled } from "@/lib/beta";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";
import { abrirCheckout, comecarTesteGratis, type PlanoPago } from "@/lib/checkout-client";

type ViagemDoPainel = {
  slug: string;
  destination: string;
  start_date: string;
  end_date: string;
  billing: { status: string; access_expires_at: string | null; is_paid: boolean } | null;
  viewer_member: { is_organizer: boolean } | null;
};

type Painel = {
  trips: ViagemDoPainel[];
  account_billing: {
    is_pro_active: boolean;
    pro_expires_at: string | null;
    can_checkout: boolean;
    trial_used: boolean;
    trial_expires_at: string | null;
    trial_trip: string | null;
  };
};

const PASSE = BILLING_COPY.trip_pass.amount / 100;
const PRO = BILLING_COPY.pro_annual.amount / 100;

const RECURSOS_PAGOS = [
  "Cofre de reservas com anexos (voo, hotel, ingressos, seguro)",
  "Gastos do grupo com divisão e acerto por Pix",
  "Checklist com prazos e responsáveis",
  "Modo viagem: o que fazer agora, no celular",
  "Agente de viagem com próximos passos",
  "Importar reserva de PDF, print ou e-mail",
];

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlanosPage() {
  return (
    <Suspense fallback={<div className="card muted">Carregando planos...</div>}>
      <Planos />
    </Suspense>
  );
}

/**
 * Pagina de planos.
 *
 * A compra so existia dentro do painel, e so depois de ter viagem: quem
 * chegava pela tabela de precos da home e queria o Pro precisava criar
 * uma viagem antes de conseguir pagar. Aqui da para assinar a qualquer
 * momento — o Pro nao depende de viagem nenhuma, e o Passe mostra as
 * viagens que a pessoa organiza (ou manda criar uma, se ainda nao houver).
 */
function Planos() {
  const params = useSearchParams();
  const viagemPedida = params.get("viagem");
  const { session, user, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;

  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [acao, setAcao] = useState("");
  const [viagemEscolhida, setViagemEscolhida] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/me/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler seu plano.");
      setPainel(json as Painel);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler seu plano.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // De onde a pessoa veio: com ?viagem= e quase sempre de um recurso
  // trancado; sem, do menu ou da home.
  useEffect(() => {
    track("planos_vistos", { origem: viagemPedida ? "viagem" : "direto" });
  }, [viagemPedida]);

  const organizadas = useMemo(
    () => (painel?.trips ?? []).filter((trip) => trip.viewer_member?.is_organizer),
    [painel]
  );
  const liberaveis = organizadas.filter((trip) => !trip.billing?.is_paid);

  useEffect(() => {
    if (viagemEscolhida || !liberaveis.length) return;
    const pedida = liberaveis.find((trip) => trip.slug === viagemPedida);
    setViagemEscolhida((pedida ?? liberaveis[0]).slug);
  }, [liberaveis, viagemEscolhida, viagemPedida]);

  const conta = painel?.account_billing ?? null;
  const podePagar = Boolean(conta?.can_checkout);
  const proAtivo = Boolean(conta?.is_pro_active);
  const testeAtivo = Boolean(
    conta?.trial_expires_at && new Date(conta.trial_expires_at).getTime() > Date.now()
  );

  async function comprar(plan: PlanoPago) {
    if (!token || acao) return;
    if (plan === "trip_pass" && !viagemEscolhida) {
      setErro("Escolha a viagem que o Passe vai liberar.");
      return;
    }
    setErro("");
    setAcao(plan);
    track("checkout_iniciado", { plano: plan, origem: "planos" });
    try {
      await abrirCheckout({
        accessToken: token,
        plan,
        tripSlug: plan === "trip_pass" ? viagemEscolhida : undefined,
      });
      setAviso(
        "O pagamento abriu em outra aba. Assim que ele for confirmado, o acesso libera sozinho — pode levar alguns segundos no Pix."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setAcao("");
    }
  }

  async function testar() {
    if (!token || acao || !viagemEscolhida) return;
    setErro("");
    setAcao("trial");
    try {
      await comecarTesteGratis(token, viagemEscolhida);
      track("teste_gratis_iniciado");
      setAviso(`Pronto: essa viagem está liberada por ${TRIAL_DIAS} dias, sem cartão.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível começar o teste.");
    } finally {
      setAcao("");
    }
  }

  const logado = Boolean(user && token);
  const carregando = authLoading || (logado && !painel && !erro);
  const entrarPara = `/entrar?mode=signup&next=${encodeURIComponent("/planos")}`;

  return (
    <div className="planos-shell">
      <header className="planos-head">
        <p className="eyebrow">Planos</p>
        <h1>Libere tudo quando quiser — antes ou depois de criar a viagem</h1>
        <p className="sub">
          Roteiro, grupo, ideias e votação são grátis para sempre. Os planos liberam o que a viagem
          precisa para acontecer: reservas, gastos, checklist, modo viagem e agente. Sem
          mensalidade e sem renovação automática.
        </p>
        {logado && conta && (
          <p className="planos-status">
            <Icon name="cartao" size={16} />
            {proAtivo
              ? `Você está no Pro${conta.pro_expires_at ? ` até ${dataCurta(conta.pro_expires_at)}` : ""}.`
              : testeAtivo
                ? `Teste grátis ativo${conta.trial_trip ? ` em "${conta.trial_trip}"` : ""} até ${dataCurta(conta.trial_expires_at as string)}.`
                : betaAccessEnabled
                  ? "Beta grátis: tudo liberado por enquanto."
                  : "Você está no plano grátis."}
          </p>
        )}
      </header>

      {erro && <div className="err">{erro}</div>}
      {aviso && <div className="note">{aviso}</div>}

      {logado && conta && !podePagar && (
        <div className="note">
          <b>A cobrança ainda não está ligada.</b> Durante a beta, os recursos pagos estão liberados
          para todo mundo. Os botões de compra aparecem aqui assim que a cobrança for ativada.
        </div>
      )}

      <div className="planos-grid">
        <section className="plano-card">
          <h2>Grátis</h2>
          <p className="plano-preco">
            R$ 0 <small>para sempre</small>
          </p>
          <ul className="feat">
            <li>Roteiro por IA com lugares conferidos</li>
            <li>Grupo ilimitado, convidado nunca paga</li>
            <li>Ideias, votação e comentários</li>
            <li>Mapa e página pública do roteiro</li>
          </ul>
          <a className="btn ghost" href={logado ? "/nova" : entrarPara}>
            {logado ? "Criar viagem grátis" : "Criar conta grátis"}
          </a>
        </section>

        <section className="plano-card destaque">
          <span className="plano-selo">Mais escolhido</span>
          <h2>Passe de viagem</h2>
          <p className="plano-preco">
            R$ {PASSE} <small>uma vez, por viagem</small>
          </p>
          <p className="tiny">
            Libera uma viagem inteira para o grupo todo. Só quem organiza paga. Vale até 90 dias
            depois da volta.
          </p>
          <ul className="feat">
            {RECURSOS_PAGOS.slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {!logado ? (
            <a className="btn" href={entrarPara}>
              Criar conta e liberar
            </a>
          ) : carregando ? (
            <span className="sk" style={{ height: 44 }} />
          ) : proAtivo ? (
            <p className="tiny">O seu Pro já libera todas as viagens que você organiza.</p>
          ) : liberaveis.length === 0 ? (
            <>
              <p className="tiny">
                {organizadas.length
                  ? "Todas as viagens que você organiza já estão liberadas."
                  : "O Passe é por viagem. Crie a sua e libere em seguida — leva um minuto."}
              </p>
              <a className="btn" href="/nova">
                Criar viagem
              </a>
            </>
          ) : (
            <>
              <label htmlFor="viagem-passe">Viagem que vai ser liberada</label>
              <select
                id="viagem-passe"
                value={viagemEscolhida}
                onChange={(event) => setViagemEscolhida(event.target.value)}
              >
                {liberaveis.map((trip) => (
                  <option key={trip.slug} value={trip.slug}>
                    {trip.destination} · {dataCurta(`${trip.start_date}T12:00:00`)}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                type="button"
                onClick={() => comprar("trip_pass")}
                disabled={!podePagar || Boolean(acao)}
              >
                {acao === "trip_pass" ? "Abrindo pagamento..." : `Liberar por R$ ${PASSE}`}
              </button>
              {!conta?.trial_used && !testeAtivo && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={testar}
                  disabled={Boolean(acao) || betaAccessEnabled}
                >
                  {acao === "trial" ? "Liberando..." : `Testar ${TRIAL_DIAS} dias grátis`}
                </button>
              )}
            </>
          )}
        </section>

        <section className="plano-card">
          <h2>Pro anual</h2>
          <p className="plano-preco">
            R$ {PRO} <small>por ano</small>
          </p>
          <p className="tiny">
            Tudo do Passe em todas as viagens que você organizar durante um ano. A partir da
            terceira viagem, sai mais barato. Não precisa ter viagem criada para assinar.
          </p>
          <ul className="feat">
            <li>Viagens ilimitadas liberadas</li>
            <li>Importar reserva de PDF, print ou e-mail</li>
            <li>Histórico das viagens antigas</li>
            <li>Recursos novos primeiro</li>
          </ul>
          {!logado ? (
            <a className="btn ghost" href={entrarPara}>
              Criar conta e assinar
            </a>
          ) : carregando ? (
            <span className="sk" style={{ height: 44 }} />
          ) : proAtivo ? (
            <p className="planos-ativo">
              <Icon name="checklist" size={16} /> Pro ativo
            </p>
          ) : (
            <button
              className="btn ghost"
              type="button"
              onClick={() => comprar("pro_annual")}
              disabled={!podePagar || Boolean(acao)}
            >
              {acao === "pro_annual" ? "Abrindo pagamento..." : `Assinar por R$ ${PRO}/ano`}
            </button>
          )}
        </section>
      </div>

      <p className="tiny planos-rodape">
        Pagamento por Pix ou cartão, processado pela AbacatePay — os dados do pagamento não passam
        pelo Planvoro. Convidado nunca paga nada. Dúvidas? <a href="/contato">Fale com a gente</a>.
      </p>
    </div>
  );
}
