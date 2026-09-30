"use client";

import { useEffect, useRef, useState } from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Icon } from "@/components/icons";
import { DashboardSkeleton } from "@/components/skeleton";
import { useAuth } from "@/components/auth-provider";
import { betaAccessEnabled } from "@/lib/beta";
import { Confirmar } from "@/components/confirmar";
import { track } from "@/lib/analytics";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";
import { Planos } from "./_components/planos";
import { PrimeiroAcesso } from "./_components/primeiro-acesso";
import { capaDoDestino, contagemDaViagem } from "@/lib/capa";
import { userDisplayName } from "@/lib/user-name";

type DashboardTrip = {
  id: string;
  slug: string;
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  budget_band: string | null;
  styles: string[];
  is_solo: boolean;
  is_public: boolean;
  created_at: string;
  view_count: number | null;
  members_count: number;
  preferences_count: number;
  expenses_total: number;
  latest_itinerary: {
    version: number;
    created_at: string;
  } | null;
  billing: {
    status: string;
    paid_at: string | null;
    access_expires_at: string | null;
    is_paid: boolean;
  } | null;
  viewer_member: {
    id: string;
    name: string;
    is_organizer: boolean;
  } | null;
};

type DashboardResponse = {
  trips: DashboardTrip[];
  account_billing: {
    is_pro_active: boolean;
    pro_expires_at: string | null;
    can_checkout: boolean;
    trial_used: boolean;
    trial_expires_at: string | null;
    trial_trip: string | null;
    /** Teste da conta inteira (sem viagem), e nao de uma viagem. */
    trial_conta?: boolean;
    /** Passes pagos antes de existir viagem, esperando a proxima. */
    passes_guardados?: number;
    subscription: {
      status: string;
      provider: string | null;
      provider_subscription_id: string | null;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
    } | null;
  };
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});


function authHeaders(accessToken: string | null) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function authJsonHeaders(accessToken: string | null) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/**
 * Le a resposta sem quebrar quando ela nao e JSON.
 *
 * Timeout da Vercel devolve HTML; `res.json()` estourava com "Unexpected
 * token <", e era essa a mensagem que aparecia na tela.
 */
async function lerJson(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "O servidor demorou para responder. Tente de novo em instantes." };
  }
}

function formatTripDate(start: string, end: string) {
  return `${dateFormatter.format(new Date(`${start}T00:00:00`))} - ${dateFormatter.format(
    new Date(`${end}T00:00:00`)
  )}`;
}

function isActiveTrip(trip: DashboardTrip) {
  return new Date(`${trip.end_date}T23:59:59`) >= new Date();
}

function nextTripStep(trip: DashboardTrip) {
  const expectedPreferences = trip.is_solo ? 1 : Math.max(trip.members_count, trip.party_size);

  if (!trip.latest_itinerary) {
    return {
      title: "Gerar roteiro inicial",
      description: "A viagem já tem base suficiente para virar um roteiro dia a dia.",
      tab: "grupo",
    };
  }

  if (!trip.is_solo && trip.preferences_count < expectedPreferences) {
    const missingPreferences = expectedPreferences - trip.preferences_count;

    return {
      title: "Chamar o grupo",
      description:
        missingPreferences === 1
          ? "Falta 1 pessoa preencher preferências."
          : `Faltam ${missingPreferences} pessoas preencherem preferências.`,
      tab: "grupo",
    };
  }

  if (trip.expenses_total === 0) {
    return {
      title: "Registrar primeiros gastos",
      description: "Adicione reserva, transporte ou mercado para o saldo do grupo ficar claro.",
      tab: "gastos",
    };
  }

  return {
    title: "Revisar e viajar",
    description: "Abra o workspace para votar, ajustar o roteiro e acompanhar próximos passos.",
    tab: "roteiro",
  };
}

const DIA_MS = 86_400_000;

/** "faltam 48 dias", "amanhã", "em viagem · dia 2 de 5", "finalizada". */
function tripTiming(trip: DashboardTrip) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(`${trip.start_date}T00:00:00`);
  const fim = new Date(`${trip.end_date}T00:00:00`);
  const faltam = Math.round((inicio.getTime() - hoje.getTime()) / DIA_MS);

  if (faltam > 1) return { label: `faltam ${faltam} dias`, tone: "futuro" as const };
  if (faltam === 1) return { label: "amanhã", tone: "perto" as const };
  if (hoje.getTime() <= fim.getTime()) {
    const dia = Math.round((hoje.getTime() - inicio.getTime()) / DIA_MS) + 1;
    const total = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
    return { label: `em viagem · dia ${dia} de ${total}`, tone: "agora" as const };
  }
  return { label: "finalizada", tone: "passado" as const };
}

/** O que libera esta viagem, em uma palavra, para o selo do cartão. */
function tripPlanLabel(
  trip: DashboardTrip,
  accountBilling: DashboardResponse["account_billing"] | null
) {
  if (betaAccessEnabled) return { label: "beta grátis", liberada: true };
  if (trip.billing?.is_paid) return { label: "Passe", liberada: true };
  if (
    trip.billing?.status === "trial" &&
    trip.billing.access_expires_at &&
    new Date(trip.billing.access_expires_at).getTime() > Date.now()
  ) {
    return {
      label: `teste até ${new Date(trip.billing.access_expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
      liberada: true,
    };
  }
  if (accountBilling?.is_pro_active && trip.viewer_member?.is_organizer) return { label: "Pro", liberada: true };
  if (
    accountBilling?.trial_conta &&
    trip.viewer_member?.is_organizer &&
    accountBilling.trial_expires_at &&
    new Date(accountBilling.trial_expires_at).getTime() > Date.now()
  ) {
    return {
      label: `teste até ${new Date(accountBilling.trial_expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
      liberada: true,
    };
  }
  return { label: "plano grátis", liberada: false };
}

export default function AppPage() {
  const { session, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billingAction, setBillingAction] = useState("");
  /** Viagem aguardando confirmacao de exclusao. */
  const [confirmarApagar, setConfirmarApagar] = useState<DashboardTrip | null>(null);
  const [apagandoViagem, setApagandoViagem] = useState("");
  const [erroApagar, setErroApagar] = useState("");
  const [billingError, setBillingError] = useState("");
  /**
   * Viagem que a pessoa veio liberar.
   *
   * O botao "Liberar esta viagem", no Cofre, nos Gastos e no Checklist,
   * manda para `/app?liberar=<slug>`. O painel nunca leu esse parametro:
   * a pessoa caia na lista geral e precisava achar sozinha a viagem e o
   * botao certo — no meio de outras viagens e de um cartao do Pro.
   */
  const [liberarSlug, setLiberarSlug] = useState<string | null>(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("liberar");
    if (slug) setLiberarSlug(slug);
  }, []);

  async function loadDashboard() {
    if (!session?.access_token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/me/dashboard", {
        headers: authHeaders(session.access_token),
      });
      const json = await lerJson(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar suas viagens.");
      setData(json as unknown as DashboardResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar suas viagens.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [session?.access_token]);

  const trips = data?.trips ?? [];
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? trips.filter((trip) => trip.destination.toLowerCase().includes(termo))
    : trips;
  // Ativas pela data de ida, a mais proxima primeiro; finalizadas da mais
  // recente para a mais antiga. Antes seguiam a ordem de criacao, e uma
  // viagem de 2027 aparecia antes da que embarca no mes que vem.
  const activeTrips = filtradas
    .filter(isActiveTrip)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const archivedTrips = filtradas
    .filter((trip) => !isActiveTrip(trip))
    .sort((a, b) => b.end_date.localeCompare(a.end_date));
  const proximaViagem = termo ? null : activeTrips[0] ?? null;
  const accountBilling = data?.account_billing ?? null;
  const liberarTrip = liberarSlug ? trips.find((trip) => trip.slug === liberarSlug) ?? null : null;

  async function startCheckout(plan: "trip_pass" | "pro_annual", tripSlug?: string) {
    if (!session?.access_token || billingAction) return;

    const actionKey = tripSlug ? `${plan}:${tripSlug}` : plan;
    track("checkout_iniciado", { plano: plan });
    setBillingAction(actionKey);
    setBillingError("");

    /**
     * A aba abre agora, ainda dentro do clique, e recebe o endereco depois.
     *
     * `window.open` chamado depois de um `await` ja nao conta como gesto
     * da pessoa: Safari no iPhone e varios bloqueadores engolem a janela
     * sem avisar, e o botao ficava em "Abrindo..." para sempre. Se mesmo
     * assim a aba for bloqueada, o checkout abre nesta mesma aba.
     */
    const aba = window.open("", "_blank");
    if (aba) aba.opener = null;

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: authJsonHeaders(session.access_token),
        body: JSON.stringify({ plan, trip_slug: tripSlug }),
      });
      const json = await lerJson(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível iniciar o pagamento.");
      /**
       * Aba nova, e nao a mesma.
       *
       * Na mesma aba, quem desiste de pagar precisa voltar e recarregar
       * para reencontrar o painel. Numa aba separada, fechar basta — e o
       * contexto de onde a pessoa estava continua intacto atras.
       */
      const url = String(json.url ?? "");
      if (!url) throw new Error("O checkout não devolveu um endereço de pagamento.");
      if (aba && !aba.closed) {
        aba.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (e) {
      aba?.close();
      setBillingError(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setBillingAction("");
    }
  }


  if (authLoading || (session?.access_token && !data && !error)) {
    return <DashboardSkeleton label="Carregando suas viagens..." />;
  }

  if (!user || !session?.access_token) {
    return (
      <AuthRequiredCard
        title="Entre para ver suas viagens"
        description="Sua área logada junta viagens criadas, convites aceitos, roteiros e gastos em um único lugar."
        nextPath="/app"
      />
    );
  }

  /**
   * Apaga uma viagem.
   *
   * Nao existia rota para isso: a unica forma de sumir com uma viagem era
   * apagar a conta inteira. Quem testou o produto ficava com o lixo do
   * teste no painel para sempre.
   */
  async function apagarViagem(slug: string) {
    if (!session?.access_token) return;

    setApagandoViagem(slug);
    setErroApagar("");

    try {
      const res = await fetch(`/api/trips/${slug}`, {
        method: "DELETE",
        headers: authJsonHeaders(session.access_token),
        body: JSON.stringify({ confirm: "APAGAR" }),
      });
      const json = await lerJson(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível apagar a viagem.");

      setConfirmarApagar(null);
      await loadDashboard();
    } catch (e) {
      setErroApagar(e instanceof Error ? e.message : "Erro ao apagar a viagem.");
    } finally {
      setApagandoViagem("");
    }
  }

  async function comecarTeste(slugEscolhido?: string) {
    if (!session?.access_token) return;

    // O teste vale para uma viagem so. Se a pessoa veio pelo "Liberar esta
    // viagem", e aquela; senao, a primeira que ela organiza — pedir para
    // escolher agora seria uma pergunta a mais no caminho de quem so quer
    // experimentar.
    //
    // Sem viagem propria, o teste vale para a conta. Antes este clique
    // parava num "crie uma viagem primeiro" que, no celular, aparecia
    // fora da tela: para quem clicou, o botao simplesmente nao fazia nada.
    const alvo =
      (slugEscolhido &&
        trips.find((trip) => trip.slug === slugEscolhido && trip.viewer_member?.is_organizer)?.slug) ||
      trips.find((trip) => trip.viewer_member?.is_organizer)?.slug;

    setBillingAction("trial");
    setBillingError("");

    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: authJsonHeaders(session.access_token),
        body: JSON.stringify(alvo ? { trip_slug: alvo } : {}),
      });
      const json = await lerJson(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível começar o teste.");

      track("teste_gratis_iniciado");
      await loadDashboard();
      if (slugEscolhido) setLiberarSlug(null);
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : "Erro ao começar o teste.");
    } finally {
      setBillingAction("");
    }
  }

  if (!loading && data && trips.length === 0) {
    return (
      <div className="dashboard-shell">
        {error && <div className="err">{error}</div>}
        <PrimeiroAcesso nome={userDisplayName(user)} />
      </div>
    );
  }

  /**
   * Painel numa coluna so.
   *
   * A versao de duas colunas mostrava a proxima viagem duas vezes (no
   * destaque e na lista, com o mesmo "proximo passo"), quatro numeros que
   * nao ajudavam a decidir nada, "Criar viagem" repetido e cinco botoes
   * verdes disputando o olho. No celular, os numeros vinham antes da
   * propria viagem. Agora: quem voce e, o plano numa linha, a proxima
   * viagem em destaque e o resto em lista compacta.
   */
  const outrasAtivas = proximaViagem ? activeTrips.filter((trip) => trip.id !== proximaViagem.id) : activeTrips;

  return (
    <div className="app-shell painel">
      <header className="painel-topo">
        <h1>Minhas viagens</h1>
        <p className="sub">Oi, {userDisplayName(user)}.</p>
      </header>

      <Planos
        proAtivo={Boolean(accountBilling?.is_pro_active)}
        proExpiraEm={accountBilling?.pro_expires_at ?? null}
        temTeste={Boolean(accountBilling?.trial_used)}
        testeExpiraEm={accountBilling?.trial_expires_at ?? null}
        testeViagem={accountBilling?.trial_trip ?? null}
        testeConta={Boolean(accountBilling?.trial_conta)}
        passesGuardados={accountBilling?.passes_guardados ?? 0}
        acao={billingAction}
        erro={liberarTrip ? "" : billingError}
        onTeste={() => comecarTeste(liberarSlug ?? undefined)}
      />

      {error && <div className="err">{error}</div>}
      {billingError && liberarTrip && <div className="err">{billingError}</div>}

      {liberarTrip && (
        <LiberarViagem
          trip={liberarTrip}
          proAtivo={Boolean(accountBilling?.is_pro_active)}
          podeTestar={
            !betaAccessEnabled &&
            !accountBilling?.is_pro_active &&
            !accountBilling?.trial_used &&
            Boolean(liberarTrip.viewer_member?.is_organizer)
          }
          podeComprar={Boolean(accountBilling?.can_checkout) && Boolean(liberarTrip.viewer_member?.is_organizer)}
          acao={billingAction}
          onTeste={() => comecarTeste(liberarTrip.slug)}
          onPasse={() => startCheckout("trip_pass", liberarTrip.slug)}
          onFechar={() => {
            setLiberarSlug(null);
            window.history.replaceState(null, "", "/app");
          }}
        />
      )}

      {proximaViagem && <NextTripHero trip={proximaViagem} />}

      {trips.length > 4 && (
        <div className="dash-busca">
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar viagem pelo destino"
            aria-label="Buscar viagem pelo destino"
          />
          {termo && (
            <span className="tiny">
              {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {(outrasAtivas.length > 0 || termo) && (
        <TripSection
          id="ativas"
          title={termo ? "Viagens encontradas" : proximaViagem ? "Depois dessa" : "Viagens ativas"}
          trips={outrasAtivas}
          accountBilling={accountBilling}
          billingAction={billingAction}
          startCheckout={startCheckout}
          onApagar={setConfirmarApagar}
        />
      )}

      {archivedTrips.length > 0 && (
        <TripSection
          id="finalizadas"
          title="Finalizadas"
          trips={archivedTrips}
          accountBilling={accountBilling}
          billingAction={billingAction}
          startCheckout={startCheckout}
          onApagar={setConfirmarApagar}
        />
      )}

      {/*
        Exige digitar APAGAR, como a exclusao de conta. Apagar uma viagem
        leva junto o roteiro, o Cofre e os gastos de todo o grupo — pessoas
        que nao foram consultadas e nao tem como recuperar nada.
      */}
      {confirmarApagar && (
        <Confirmar
          titulo={`Apagar "${confirmarApagar.destination}"?`}
          descricao="Some o roteiro, o Cofre com os anexos, os gastos e o checklist — para você e para todo o grupo. Não dá para desfazer."
          acao="Apagar viagem"
          exigirTexto="APAGAR"
          trabalhando={apagandoViagem === confirmarApagar.slug}
          erro={erroApagar}
          onConfirmar={() => apagarViagem(confirmarApagar.slug)}
          onCancelar={() => {
            setConfirmarApagar(null);
            setErroApagar("");
          }}
        />
      )}
    </div>
  );
}

function TripSection({
  id,
  title,
  trips,
  accountBilling,
  billingAction,
  startCheckout,
  onApagar,
}: {
  id?: string;
  title: string;
  trips: DashboardTrip[];
  accountBilling: DashboardResponse["account_billing"] | null;
  billingAction: string;
  startCheckout: (plan: "trip_pass" | "pro_annual", tripSlug?: string) => Promise<void>;
  onApagar: (trip: DashboardTrip) => void;
}) {
  return (
    // div, e nao section: "section" tem borda e 82px de respiro globais,
    // feitos para a home.
    <div className="painel-secao" id={id} role="region" aria-label={title}>
      <h2>
        {title} <span>{trips.length}</span>
      </h2>

      {trips.length === 0 ? (
        <p className="sub">Nenhuma viagem por aqui.</p>
      ) : (
        <div className="trip-rows">
          {trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              accountBilling={accountBilling}
              billingAction={billingAction}
              startCheckout={startCheckout}
              onApagar={onApagar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function pessoasDaViagem(trip: DashboardTrip) {
  if (trip.is_solo) return "só você";
  return `${trip.members_count} de ${trip.party_size} pessoas`;
}

/**
 * Viagem em lista.
 *
 * Uma linha: capa, destino, quando e o proximo passo. As acoes raras
 * (liberar, link publico, apagar) ficam no menu "⋯" — Apagar solto no
 * rodape de cada cartao era a acao mais rara e a unica sem volta, com o
 * mesmo destaque das outras.
 */
function TripRow({
  trip,
  accountBilling,
  billingAction,
  startCheckout,
  onApagar,
}: {
  trip: DashboardTrip;
  accountBilling: DashboardResponse["account_billing"] | null;
  billingAction: string;
  startCheckout: (plan: "trip_pass" | "pro_annual", tripSlug?: string) => Promise<void>;
  onApagar: (trip: DashboardTrip) => void;
}) {
  const timing = tripTiming(trip);
  const plano = tripPlanLabel(trip, accountBilling);
  const step = nextTripStep(trip);
  const organizador = Boolean(trip.viewer_member?.is_organizer);
  const podeLiberar = !plano.liberada && organizador;
  const acaoPasse = `trip_pass:${trip.slug}`;
  const temMenu = podeLiberar || trip.is_public || organizador;
  const menu = useRef<HTMLDetailsElement | null>(null);

  // O menu fecha ao tocar fora dele; "details" sozinho so fecha no proprio
  // gatilho, e ficava aberto por cima da viagem de baixo.
  useEffect(() => {
    function fora(evento: MouseEvent) {
      const aberto = menu.current;
      if (aberto?.open && !aberto.contains(evento.target as Node)) aberto.open = false;
    }
    document.addEventListener("click", fora);
    return () => document.removeEventListener("click", fora);
  }, []);

  return (
    <article className="trip-row" style={capaDoDestino(trip.destination)}>
      <a className="trip-row-capa" href={`/v/${trip.slug}`} tabIndex={-1} aria-hidden="true">
        {trip.destination.trim().charAt(0).toUpperCase()}
      </a>

      <div className="trip-row-info">
        <h3>
          <a href={`/v/${trip.slug}`}>{trip.destination}</a>
        </h3>
        <p className="small">
          {formatTripDate(trip.start_date, trip.end_date)} · {pessoasDaViagem(trip)}
          {plano.liberada && <span className="trip-row-plano"> · {plano.label}</span>}
        </p>
        {timing.tone !== "passado" && (
          <a className="trip-row-passo" href={`/v/${trip.slug}#${step.tab}`}>
            {step.title} →
          </a>
        )}
      </div>

      <span className={`trip-row-quando ${timing.tone}`}>{timing.label}</span>

      {temMenu && (
        <details className="trip-row-menu" ref={menu}>
          <summary aria-label={`Mais opções de ${trip.destination}`}>
            <span aria-hidden="true">⋯</span>
          </summary>
          {/* Escolher uma opcao fecha o menu. */}
          <div
            className="trip-row-menu-lista"
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            {podeLiberar &&
              (accountBilling?.can_checkout ? (
                <button
                  type="button"
                  onClick={() => startCheckout("trip_pass", trip.slug)}
                  disabled={billingAction === acaoPasse}
                >
                  {billingAction === acaoPasse
                    ? "Abrindo pagamento..."
                    : `Liberar esta viagem · R$ ${BILLING_COPY.trip_pass.amount / 100}`}
                </button>
              ) : (
                <a href={`/planos?viagem=${encodeURIComponent(trip.slug)}`}>Ver planos</a>
              ))}
            {trip.is_public && (
              <a href={`/r/${trip.slug}`} target="_blank" rel="noreferrer">
                Abrir link público
              </a>
            )}
            {/* So quem organiza apaga: leva junto o Cofre e os gastos do grupo. */}
            {organizador && (
              <button type="button" className="perigo" onClick={() => onApagar(trip)}>
                Apagar viagem
              </button>
            )}
          </div>
        </details>
      )}
    </article>
  );
}

/**
 * A viagem que embarca primeiro.
 *
 * A contagem ("faltam 30 dias") era uma etiqueta pequena entre outras
 * quatro; e o que faz alguem abrir o painel com vontade, entao vira o
 * numero grande da capa. Um botao cheio so — Abrir viagem — e os atalhos
 * para as abas do dia a dia.
 */
function NextTripHero({ trip }: { trip: DashboardTrip }) {
  const timing = tripTiming(trip);
  const step = nextTripStep(trip);
  const conta = contagemDaViagem(trip.start_date, trip.end_date);
  const atalhos: Array<{ tab: string; label: string; icon: "roteiro" | "cofre" | "gastos" | "grupo" | "mapa" }> = [
    { tab: "roteiro", label: "Roteiro", icon: "roteiro" },
    { tab: "mapa", label: "Mapa", icon: "mapa" },
    { tab: "cofre", label: "Cofre", icon: "cofre" },
    { tab: "gastos", label: "Gastos", icon: "gastos" },
    { tab: "grupo", label: trip.is_solo ? "Ajustes" : "Grupo", icon: "grupo" },
  ];

  return (
    <section className="next-trip" aria-label="Próxima viagem" style={capaDoDestino(trip.destination)}>
      <div className="next-trip-capa">
        <span className="next-trip-numero">{conta.numero}</span>
        <span className="next-trip-legenda">{conta.legenda}</span>
      </div>

      <div className="next-trip-corpo">
        <p className="next-trip-rotulo">{timing.tone === "agora" ? "Viagem em andamento" : "Próxima viagem"}</p>
        <h2>
          <a href={`/v/${trip.slug}`}>{trip.destination}</a>
        </h2>
        <p className="sub">
          {formatTripDate(trip.start_date, trip.end_date)} · {pessoasDaViagem(trip)}
        </p>

        <a className="next-trip-passo" href={`/v/${trip.slug}#${step.tab}`}>
          <span>Próximo passo</span>
          <strong>{step.title}</strong>
          <em>{step.description}</em>
        </a>

        <div className="next-trip-acoes">
          <a className="btn" href={`/v/${trip.slug}`}>
            Abrir viagem
          </a>
          <nav className="next-trip-links" aria-label={`Atalhos de ${trip.destination}`}>
            {atalhos.map((atalho) => (
              <a key={atalho.tab} href={`/v/${trip.slug}#${atalho.tab}`}>
                <Icon name={atalho.icon} size={15} />
                {atalho.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

/**
 * Cartao de quem chegou por "Liberar esta viagem".
 *
 * Mostra so o que resolve aquela viagem, na ordem do que custa menos: o
 * teste gratis, se ainda existe, e depois o Passe dela.
 */
function LiberarViagem({
  trip,
  proAtivo,
  podeTestar,
  podeComprar,
  acao,
  onTeste,
  onPasse,
  onFechar,
}: {
  trip: DashboardTrip;
  proAtivo: boolean;
  podeTestar: boolean;
  podeComprar: boolean;
  acao: string;
  onTeste: () => void;
  onPasse: () => void;
  onFechar: () => void;
}) {
  const emTeste =
    trip.billing?.status === "trial" &&
    Boolean(trip.billing.access_expires_at) &&
    new Date(trip.billing.access_expires_at as string).getTime() > Date.now();
  const liberada = betaAccessEnabled || proAtivo || emTeste || Boolean(trip.billing?.is_paid);
  const organizador = Boolean(trip.viewer_member?.is_organizer);
  const acaoPasse = `trip_pass:${trip.slug}`;

  return (
    <section className="card liberar-card" aria-live="polite">
      <div className="liberar-head">
        <div>
          <p className="eyebrow">Liberar viagem</p>
          <h2>{trip.destination}</h2>
        </div>
        <button className="btn ghost sm" type="button" onClick={onFechar} aria-label="Fechar">
          Fechar
        </button>
      </div>

      {liberada ? (
        <p className="sub">
          Esta viagem já está liberada: Cofre, gastos e checklist funcionam para o grupo todo.
        </p>
      ) : !organizador ? (
        <p className="sub">
          Só quem organiza a viagem pode liberar. Você não precisa pagar nada — avise o
          organizador.
        </p>
      ) : (
        <>
          <p className="sub">
            Libera Cofre, gastos e checklist para todo o grupo desta viagem. Roteiro, ideias e
            votação continuam grátis.
          </p>
          <div className="invite-actions">
            {podeTestar && (
              <button className="btn" type="button" onClick={onTeste} disabled={Boolean(acao)}>
                {acao === "trial" ? "Liberando..." : `Testar ${TRIAL_DIAS} dias grátis`}
              </button>
            )}
            {podeComprar && (
              <button
                className={`btn ${podeTestar ? "ghost" : ""}`}
                type="button"
                onClick={onPasse}
                disabled={Boolean(acao)}
              >
                {acao === acaoPasse
                  ? "Abrindo checkout..."
                  : `Passe da viagem · R$ ${BILLING_COPY.trip_pass.amount / 100}`}
              </button>
            )}
          </div>
          {!podeTestar && !podeComprar && (
            <p className="tiny">
              O pagamento ainda não está aberto. Assim que ligarmos, o botão aparece aqui.
            </p>
          )}
        </>
      )}

      <a className="tiny" href={`/v/${trip.slug}`}>
        Voltar para a viagem
      </a>
    </section>
  );
}
