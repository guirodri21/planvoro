"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Icon } from "@/components/icons";
import { DashboardSkeleton } from "@/components/skeleton";
import { useAuth } from "@/components/auth-provider";
import { betaAccessDescription, betaAccessEnabled, betaAccessLabel } from "@/lib/beta";
import { Confirmar } from "@/components/confirmar";
import { track } from "@/lib/analytics";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";
import { Planos } from "./_components/planos";
import { PrimeiroAcesso } from "./_components/primeiro-acesso";
import { supabaseBrowser } from "@/lib/supabase-browser";
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

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
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
  const stats = useMemo(() => {
    const generatedTrips = trips.filter((trip) => trip.latest_itinerary).length;
    const groupTrips = trips.filter((trip) => !trip.is_solo).length;
    const totalExpenses = trips.reduce((sum, trip) => sum + trip.expenses_total, 0);

    return { activeTrips: activeTrips.length, generatedTrips, groupTrips, totalExpenses };
  }, [trips]);

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
    const alvo =
      (slugEscolhido &&
        trips.find((trip) => trip.slug === slugEscolhido && trip.viewer_member?.is_organizer)?.slug) ||
      trips.find((trip) => trip.viewer_member?.is_organizer)?.slug;
    if (!alvo) {
      setBillingError("Crie uma viagem primeiro para usar o teste grátis.");
      return;
    }

    setBillingAction("trial");
    setBillingError("");

    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: authJsonHeaders(session.access_token),
        body: JSON.stringify({ trip_slug: alvo }),
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
   * Painel em duas colunas.
   *
   * Cabecalho, plano, quatro numeros e as viagens vinham empilhados no
   * centro: a primeira viagem so aparecia depois de uma tela inteira de
   * rolagem. Agora quem voce e, o plano e os numeros moram na lateral, e a
   * coluna principal comeca direto pelo que a pessoa veio fazer — abrir
   * uma viagem.
   */
  return (
    <div className="app-shell dash-shell">
      <aside className="dash-sidebar" aria-label="Sua conta">
        <div className="dash-hello">
          <p className="eyebrow">Área do usuário</p>
          <h1>Minhas viagens</h1>
          <p className="sub">Oi, {userDisplayName(user)}.</p>
        </div>

        <a className="btn full" href="/nova">
          <Icon name="mais" />
          Criar viagem
        </a>

        <nav className="ws-nav dash-nav" aria-label="Seções do painel">
          <div className="ws-nav-group">
            <span className="ws-nav-title">Viagens</span>
            <a className="ws-nav-item" href="#ativas">
              <Icon name="viagem" />
              <span>Ativas</span>
              {activeTrips.length > 0 && <em className="tab-alerta">{activeTrips.length}</em>}
            </a>
            {archivedTrips.length > 0 && (
              <a className="ws-nav-item" href="#finalizadas">
                <Icon name="arquivo" />
                <span>Finalizadas</span>
                <em className="tab-alerta">{archivedTrips.length}</em>
              </a>
            )}
            <a className="ws-nav-item" href="/historico">
              <Icon name="agenda" />
              <span>Histórico</span>
            </a>
          </div>
        </nav>

        <dl className="dash-stats">
          <div>
            <dt>Viagens ativas</dt>
            <dd>{stats.activeTrips}</dd>
          </div>
          <div>
            <dt>Em grupo</dt>
            <dd>{stats.groupTrips}</dd>
          </div>
          <div>
            <dt>Roteiros gerados</dt>
            <dd>{stats.generatedTrips}</dd>
          </div>
          <div>
            <dt>Gastos registrados</dt>
            <dd>{moneyFormatter.format(stats.totalExpenses)}</dd>
          </div>
        </dl>

        <Planos
          proAtivo={Boolean(accountBilling?.is_pro_active)}
          proExpiraEm={accountBilling?.pro_expires_at ?? null}
          podeComprar={Boolean(accountBilling?.can_checkout)}
          temTeste={Boolean(accountBilling?.trial_used)}
          testeExpiraEm={accountBilling?.trial_expires_at ?? null}
          testeViagem={accountBilling?.trial_trip ?? null}
          acao={billingAction}
          onPro={() => startCheckout("pro_annual")}
          onTeste={() => comecarTeste(liberarSlug ?? undefined)}
        />

        <button className="btn ghost sm full" type="button" onClick={loadDashboard} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar lista"}
        </button>
      </aside>

      <div className="dash-main">
      {error && <div className="err">{error}</div>}
      {billingError && <div className="err">{billingError}</div>}

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

      {!data && loading ? (
        <div className="card muted">Buscando suas viagens...</div>
      ) : trips.length === 0 ? (
        <div className="dashboard-empty">
          <div>
            <p className="eyebrow">Primeiro roteiro</p>
            <h2>Crie sua primeira viagem</h2>
            <p className="sub">
              Comece sozinho ou em grupo. Depois que a viagem existir, ela aparece aqui com o
              progresso do roteiro, pessoas e gastos.
            </p>
          </div>
          <a className="btn lg" href="/nova">
            Criar viagem grátis
          </a>
        </div>
      ) : (
        <div className="dashboard-stack">
          {/*
            A proxima viagem em destaque, no lugar do bloco "Continue
            planejando", que repetia as mesmas viagens dos cartoes logo
            abaixo. Aqui ha uma so: a que embarca primeiro.
          */}
          {proximaViagem && (
            <NextTripHero
              trip={proximaViagem}
              accountBilling={accountBilling}
            />
          )}

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

          <TripSection
            id="ativas"
            title={termo ? "Viagens encontradas" : "Viagens ativas"}
            description="Da mais próxima para a mais distante."
            badge={`${activeTrips.length} ativa${activeTrips.length === 1 ? "" : "s"}`}
            trips={activeTrips}
            accountBilling={accountBilling}
            billingAction={billingAction}
            startCheckout={startCheckout}
            onApagar={setConfirmarApagar}
          />

          {archivedTrips.length > 0 && (
            <TripSection
              id="finalizadas"
              title="Viagens finalizadas"
              description="Histórico para consultar roteiros, gastos e decisões depois da volta."
              badge={`${archivedTrips.length} no histórico`}
              trips={archivedTrips}
              accountBilling={accountBilling}
              billingAction={billingAction}
              startCheckout={startCheckout}
              onApagar={setConfirmarApagar}
            />
          )}
        </div>
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
    </div>
  );
}

function TripSection({
  id,
  title,
  description,
  badge,
  trips,
  accountBilling,
  billingAction,
  startCheckout,
  onApagar,
}: {
  id?: string;
  title: string;
  description: string;
  badge: string;
  trips: DashboardTrip[];
  accountBilling: DashboardResponse["account_billing"] | null;
  billingAction: string;
  startCheckout: (plan: "trip_pass" | "pro_annual", tripSlug?: string) => Promise<void>;
  onApagar: (trip: DashboardTrip) => void;
}) {
  return (
    <section className="trip-board" id={id}>
      <div className="trip-board-head">
        <div>
          <h2>{title}</h2>
          <p className="sub">{description}</p>
        </div>
        <span className={`badge ${trips.length ? "b-ok" : "b-warn"}`}>{trips.length ? badge : "vazio"}</span>
      </div>

      {trips.length === 0 ? (
        <div className="mini-empty">
          <span>Nada por aqui ainda.</span>
          <a className="btn sm" href="/nova">
            Criar viagem
          </a>
        </div>
      ) : (
        <div className="trip-list">
          {trips.map((trip) => (
            <TripCard
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
    </section>
  );
}

/**
 * Cartao de viagem.
 *
 * Antes: tres caixas de numero, uma barra de progresso sem legenda e ate
 * tres botoes que mudavam de lugar conforme a viagem — "Apagar" com o
 * mesmo peso de "Abrir". Agora a leitura segue a pergunta de quem abre o
 * painel: quando e, o que falta, e abrir. Apagar vira link discreto no
 * rodape, porque e a acao mais rara e a unica sem volta.
 */
function TripCard({
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
  const pessoas = trip.is_solo ? 1 : Math.max(trip.members_count, trip.party_size);
  const prefsOk = trip.preferences_count >= pessoas;
  const podeLiberar = !plano.liberada && organizador;
  const acaoPasse = `trip_pass:${trip.slug}`;

  return (
    <article className="trip-card trip-card-v2">
      <header className="trip-card-top">
        <div>
          <h3>
            <a href={`/v/${trip.slug}`}>{trip.destination}</a>
          </h3>
          <p className="small">
            {formatTripDate(trip.start_date, trip.end_date)} ·{" "}
            {trip.is_solo ? "só você" : `${trip.members_count}/${trip.party_size} pessoas`}
          </p>
        </div>
        <span className={`trip-timing ${timing.tone}`}>{timing.label}</span>
      </header>

      <ul className="trip-checks">
        <li className={prefsOk ? "ok" : ""}>
          <span aria-hidden="true">{prefsOk ? "✓" : "•"}</span>
          Preferências {trip.preferences_count}/{pessoas}
        </li>
        <li className={trip.latest_itinerary ? "ok" : ""}>
          <span aria-hidden="true">{trip.latest_itinerary ? "✓" : "•"}</span>
          {trip.latest_itinerary ? `Roteiro v${trip.latest_itinerary.version}` : "Roteiro a gerar"}
        </li>
        <li className={trip.expenses_total > 0 ? "ok" : ""}>
          <span aria-hidden="true">{trip.expenses_total > 0 ? "✓" : "•"}</span>
          Gastos {moneyFormatter.format(trip.expenses_total)}
        </li>
      </ul>

      {timing.tone !== "passado" && (
        <a className="trip-next" href={`/v/${trip.slug}#${step.tab}`}>
          <span className="stat-label">Próximo passo</span>
          <strong>{step.title}</strong>
          <span className="small">{step.description}</span>
        </a>
      )}

      <div className="trip-card-actions-v2">
        <a className="btn sm" href={`/v/${trip.slug}`}>
          Abrir viagem
        </a>
        {podeLiberar &&
          (accountBilling?.can_checkout ? (
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => startCheckout("trip_pass", trip.slug)}
              disabled={billingAction === acaoPasse}
            >
              {billingAction === acaoPasse
                ? "Abrindo..."
                : `Liberar R$ ${BILLING_COPY.trip_pass.amount / 100}`}
            </button>
          ) : (
            <a className="btn ghost sm" href={`/planos?viagem=${encodeURIComponent(trip.slug)}`}>
              Ver planos
            </a>
          ))}
      </div>

      <footer className="trip-card-foot">
        <span className={`trip-plan ${plano.liberada ? "on" : ""}`}>{plano.label}</span>
        <span className="tiny">{organizador ? "você organiza" : "você participa"}</span>
        {trip.is_public && (
          <a className="tiny" href={`/r/${trip.slug}`} target="_blank" rel="noreferrer">
            Link público
          </a>
        )}
        {/* So quem organiza apaga: a acao leva junto o Cofre e os gastos de
            todo o grupo. */}
        {organizador && (
          <button
            className="trip-apagar"
            type="button"
            onClick={() => onApagar(trip)}
            aria-label={`Apagar a viagem para ${trip.destination}`}
          >
            Apagar
          </button>
        )}
      </footer>
    </article>
  );
}

/** A viagem que embarca primeiro, com atalhos para as abas do dia a dia. */
function NextTripHero({
  trip,
  accountBilling,
}: {
  trip: DashboardTrip;
  accountBilling: DashboardResponse["account_billing"] | null;
}) {
  const timing = tripTiming(trip);
  const step = nextTripStep(trip);
  const plano = tripPlanLabel(trip, accountBilling);
  const atalhos: Array<{ tab: string; label: string; icon: "roteiro" | "cofre" | "gastos" | "grupo" | "mapa" }> = [
    { tab: "roteiro", label: "Roteiro", icon: "roteiro" },
    { tab: "mapa", label: "Mapa", icon: "mapa" },
    { tab: "cofre", label: "Cofre", icon: "cofre" },
    { tab: "gastos", label: "Gastos", icon: "gastos" },
    { tab: "grupo", label: trip.is_solo ? "Ajustes" : "Grupo", icon: "grupo" },
  ];

  return (
    <section className="next-trip" aria-label="Próxima viagem">
      <div className="next-trip-main">
        <p className="eyebrow">{timing.tone === "agora" ? "Viagem em andamento" : "Próxima viagem"}</p>
        <h2>
          <a href={`/v/${trip.slug}`}>{trip.destination}</a>
        </h2>
        <p className="sub">
          {formatTripDate(trip.start_date, trip.end_date)} ·{" "}
          {trip.is_solo ? "só você" : `${trip.members_count} pessoa${trip.members_count === 1 ? "" : "s"}`}
        </p>
        <div className="next-trip-tags">
          <span className={`trip-timing ${timing.tone}`}>{timing.label}</span>
          <span className={`trip-plan ${plano.liberada ? "on" : ""}`}>{plano.label}</span>
        </div>
      </div>

      <a className="next-trip-step" href={`/v/${trip.slug}#${step.tab}`}>
        <span className="stat-label">Próximo passo</span>
        <strong>{step.title}</strong>
        <span className="small">{step.description}</span>
        <em>Continuar →</em>
      </a>

      <nav className="next-trip-links" aria-label={`Atalhos de ${trip.destination}`}>
        {atalhos.map((atalho) => (
          <a key={atalho.tab} href={`/v/${trip.slug}#${atalho.tab}`}>
            <Icon name={atalho.icon} size={16} />
            {atalho.label}
          </a>
        ))}
      </nav>
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
