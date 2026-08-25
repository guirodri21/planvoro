"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { useAuth } from "@/components/auth-provider";
import { betaAccessDescription, betaAccessEnabled, betaAccessLabel } from "@/lib/beta";
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
    subscription: {
      status: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
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

function formatTripDate(start: string, end: string) {
  return `${dateFormatter.format(new Date(`${start}T00:00:00`))} - ${dateFormatter.format(
    new Date(`${end}T00:00:00`)
  )}`;
}

function tripStatus(trip: DashboardTrip) {
  const today = new Date();
  const start = new Date(`${trip.start_date}T00:00:00`);
  const end = new Date(`${trip.end_date}T23:59:59`);

  if (today < start) return { label: "planejando", className: "b-vote" };
  if (today <= end) return { label: "em viagem", className: "b-ok" };
  return { label: "finalizada", className: "b-warn" };
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
    };
  }

  if (trip.expenses_total === 0) {
    return {
      title: "Registrar primeiros gastos",
      description: "Adicione reserva, transporte ou mercado para o saldo do grupo ficar claro.",
    };
  }

  return {
    title: "Revisar e viajar",
    description: "Abra o workspace para votar, ajustar o roteiro e acompanhar próximos passos.",
  };
}

export default function AppPage() {
  const { session, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billingAction, setBillingAction] = useState("");
  const [billingError, setBillingError] = useState("");

  async function loadDashboard() {
    if (!session?.access_token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/me/dashboard", {
        headers: authHeaders(session.access_token),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar suas viagens.");
      setData(json);
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
  const activeTrips = trips.filter(isActiveTrip);
  const archivedTrips = trips.filter((trip) => !isActiveTrip(trip));
  const continueTrips = activeTrips.slice(0, 3);
  const accountBilling = data?.account_billing ?? null;
  const stats = useMemo(() => {
    const generatedTrips = trips.filter((trip) => trip.latest_itinerary).length;
    const groupTrips = trips.filter((trip) => !trip.is_solo).length;
    const totalExpenses = trips.reduce((sum, trip) => sum + trip.expenses_total, 0);

    return { activeTrips: activeTrips.length, generatedTrips, groupTrips, totalExpenses };
  }, [trips]);

  async function startCheckout(plan: "trip_pass" | "pro_annual", tripSlug?: string) {
    if (!session?.access_token) return;

    const actionKey = tripSlug ? `${plan}:${tripSlug}` : plan;
    setBillingAction(actionKey);
    setBillingError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: authJsonHeaders(session.access_token),
        body: JSON.stringify({ plan, trip_slug: tripSlug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível iniciar o pagamento.");
      window.location.href = json.url;
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
      setBillingAction("");
    }
  }

  async function openBillingPortal() {
    if (!session?.access_token) return;

    setBillingAction("portal");
    setBillingError("");

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: authJsonHeaders(session.access_token),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível abrir o portal.");
      window.location.href = json.url;
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : "Não foi possível abrir o portal.");
      setBillingAction("");
    }
  }

  if (authLoading) {
    return <div className="card muted">Carregando sua conta...</div>;
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

  return (
    <div className="dashboard-shell">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">Área do usuário</p>
          <h1>Minhas viagens</h1>
          <p className="sub">
            Oi, {userDisplayName(user)}. Aqui ficam as viagens que você criou ou entrou pelo
            convite.
          </p>
        </div>

        <div className="dashboard-actions">
          <button className="btn ghost" type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <a className="btn" href="/nova">
            Criar viagem
          </a>
        </div>
      </div>

      {error && <div className="err">{error}</div>}
      {billingError && <div className="err">{billingError}</div>}

      <div className="billing-panel">
        <div>
          <p className="eyebrow">{betaAccessEnabled ? betaAccessLabel : "Plano"}</p>
          <h2>
            {betaAccessEnabled
              ? "Tudo liberado para testar"
              : accountBilling?.is_pro_active
                ? "Planvoro Pro ativo"
                : "Cresça quando precisar"}
          </h2>
          <p className="sub">
            {betaAccessEnabled
              ? `${betaAccessDescription} O Stripe continua pronto para quando a gente decidir cobrar.`
              : "Use grátis para começar. Quando a viagem ficar séria, libere um grupo por R$79 ou assine o Pro anual por R$149."}
          </p>
        </div>
        <div className="billing-actions">
          {betaAccessEnabled ? (
            <>
              <span className="badge b-ok">Acesso beta ativo</span>
              <a className="btn" href="/nova">
                Criar viagem
              </a>
            </>
          ) : accountBilling?.is_pro_active ? (
            <>
              <span className="badge b-ok">Pro ativo</span>
              <button
                className="btn ghost"
                type="button"
                onClick={openBillingPortal}
                disabled={billingAction === "portal"}
              >
                {billingAction === "portal" ? "Abrindo..." : "Gerenciar assinatura"}
              </button>
            </>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => startCheckout("pro_annual")}
              disabled={billingAction === "pro_annual"}
            >
              {billingAction === "pro_annual" ? "Abrindo checkout..." : "Assinar Pro anual"}
            </button>
          )}
        </div>
      </div>

      <div className="grid4 dashboard-stats">
        <div className="card stat-card">
          <span className="stat-label">Viagens ativas</span>
          <strong className="stat-value">{stats.activeTrips}</strong>
          <span className="tiny">Planejamento em andamento</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Em grupo</span>
          <strong className="stat-value">{stats.groupTrips}</strong>
          <span className="tiny">Com convite e colaboração</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Roteiros gerados</span>
          <strong className="stat-value">{stats.generatedTrips}</strong>
          <span className="tiny">Versões prontas para revisar</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Gastos registrados</span>
          <strong className="stat-value">{moneyFormatter.format(stats.totalExpenses)}</strong>
          <span className="tiny">Somando todas as viagens</span>
        </div>
      </div>

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
          {continueTrips.length > 0 && (
            <section className="dashboard-section">
              <div className="trip-board-head">
                <div>
                  <h2>Continue planejando</h2>
                  <p className="sub">Os próximos passos mais úteis para tirar cada viagem do rascunho.</p>
                </div>
                <span className="badge b-vote">próximos passos</span>
              </div>

              <div className="next-step-grid">
                {continueTrips.map((trip) => {
                  const step = nextTripStep(trip);
                  return (
                    <a className="next-step-card" href={`/app/trips/${trip.slug}`} key={trip.id}>
                      <span className="stat-label">{trip.destination}</span>
                      <strong>{step.title}</strong>
                      <span className="small">{step.description}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          <TripSection
            title="Viagens ativas"
            description="Continue de onde parou ou acompanhe o grupo."
            badge={`${activeTrips.length} ativa${activeTrips.length === 1 ? "" : "s"}`}
            trips={activeTrips}
            accountBilling={accountBilling}
            billingAction={billingAction}
            startCheckout={startCheckout}
          />

          {archivedTrips.length > 0 && (
            <TripSection
              title="Viagens finalizadas"
              description="Histórico para consultar roteiros, gastos e decisões depois da volta."
              badge={`${archivedTrips.length} no histórico`}
              trips={archivedTrips}
              accountBilling={accountBilling}
              billingAction={billingAction}
              startCheckout={startCheckout}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TripSection({
  title,
  description,
  badge,
  trips,
  accountBilling,
  billingAction,
  startCheckout,
}: {
  title: string;
  description: string;
  badge: string;
  trips: DashboardTrip[];
  accountBilling: DashboardResponse["account_billing"] | null;
  billingAction: string;
  startCheckout: (plan: "trip_pass" | "pro_annual", tripSlug?: string) => Promise<void>;
}) {
  if (trips.length === 0) {
    return (
      <section className="trip-board">
        <div className="trip-board-head">
          <div>
            <h2>{title}</h2>
            <p className="sub">{description}</p>
          </div>
          <span className="badge b-warn">vazio</span>
        </div>
        <div className="mini-empty">
          <span>Nada por aqui ainda.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="trip-board">
      <div className="trip-board-head">
        <div>
          <h2>{title}</h2>
          <p className="sub">{description}</p>
        </div>
        <span className="badge b-ok">{badge}</span>
      </div>

      <div className="trip-list">
        {trips.map((trip) => {
          const status = tripStatus(trip);
          const preferenceTarget = trip.members_count || trip.party_size;
          const preferenceProgress = preferenceTarget
            ? Math.round((trip.preferences_count / preferenceTarget) * 100)
            : 0;
          const proCoversTrip = betaAccessEnabled || Boolean(accountBilling?.is_pro_active);
          const tripPaid = betaAccessEnabled || Boolean(trip.billing?.is_paid || proCoversTrip);
          const canBuyTripPass = !betaAccessEnabled && trip.viewer_member?.is_organizer && !tripPaid;
          const tripBillingAction = `trip_pass:${trip.slug}`;

          return (
            <article className="trip-card" key={trip.id}>
              <div className="trip-card-main">
                <div>
                  <div className="trip-card-title">
                    <h3>{trip.destination}</h3>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                    <span className={`badge ${tripPaid ? "b-ok" : "b-warn"}`}>
                      {betaAccessEnabled
                        ? "beta grátis"
                        : proCoversTrip
                          ? "Pro"
                          : tripPaid
                            ? "liberada"
                            : "grátis"}
                    </span>
                  </div>
                  <p className="small">
                    {formatTripDate(trip.start_date, trip.end_date)} ·{" "}
                    {trip.is_solo ? "viagem solo" : `${trip.members_count}/${trip.party_size} pessoas`}
                  </p>
                </div>
                <div className="trip-card-actions">
                  {canBuyTripPass && (
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => startCheckout("trip_pass", trip.slug)}
                      disabled={billingAction === tripBillingAction}
                    >
                      {billingAction === tripBillingAction ? "Abrindo..." : "Liberar R$79"}
                    </button>
                  )}
                  <a className="btn sm" href={`/app/trips/${trip.slug}`}>
                    Abrir
                  </a>
                </div>
              </div>

              <div className="trip-meta-grid">
                <div>
                  <span className="stat-label">Preferências</span>
                  <strong>
                    {trip.preferences_count}/{preferenceTarget}
                  </strong>
                </div>
                <div>
                  <span className="stat-label">Roteiro</span>
                  <strong>{trip.latest_itinerary ? `v${trip.latest_itinerary.version}` : "a gerar"}</strong>
                </div>
                <div>
                  <span className="stat-label">Gastos</span>
                  <strong>{moneyFormatter.format(trip.expenses_total)}</strong>
                </div>
              </div>

              <div className="progress-line" aria-hidden="true">
                <span style={{ width: `${Math.min(preferenceProgress, 100)}%` }} />
              </div>

              <div className="trip-foot">
                <span className="tiny">
                  Seu papel: {trip.viewer_member?.is_organizer ? "organizador" : "participante"}
                </span>
                <a className="tiny" href={`/r/${trip.slug}`} target="_blank" rel="noreferrer">
                  Link público
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
