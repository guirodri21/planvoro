"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { useAuth } from "@/components/auth-provider";
import { DuplicateTrip } from "@/components/duplicate-trip";

type HistoryTrip = {
  id: string;
  slug: string;
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  is_solo: boolean;
  expenses_total: number;
  members_count: number;
  latest_itinerary: { id: string } | null;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatRange(start: string, end: string) {
  const from = dateFormatter.format(new Date(`${start}T12:00:00`));
  const to = dateFormatter.format(new Date(`${end}T12:00:00`));
  return `${from} a ${to}`;
}

/** Dias contados de ponta a ponta, incluindo o dia da volta. */
function tripLength(start: string, end: string) {
  const from = new Date(`${start}T12:00:00`).getTime();
  const to = new Date(`${end}T12:00:00`).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

function isFinished(trip: HistoryTrip) {
  return new Date(`${trip.end_date}T23:59:59`) < new Date();
}

export default function HistoricoPage() {
  const { session, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<HistoryTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = session?.access_token;
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/me/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar o histórico.");

      setTrips((json.trips ?? []) as HistoryTrip[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) {
    return <div className="card"><p className="sub">Carregando...</p></div>;
  }

  if (!session) {
    return (
      <AuthRequiredCard
        title="Entre para ver seu histórico"
        description="As viagens que já terminaram ficam guardadas na sua conta."
        nextPath="/historico"
      />
    );
  }

  const finished = trips.filter(isFinished).sort((a, b) => b.end_date.localeCompare(a.end_date));

  const totalDays = finished.reduce((sum, trip) => sum + tripLength(trip.start_date, trip.end_date), 0);
  const totalSpent = finished.reduce((sum, trip) => sum + Number(trip.expenses_total ?? 0), 0);
  const destinations = new Set(finished.map((trip) => trip.destination.trim().toLowerCase())).size;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">Histórico</p>
          <h1>Onde você já esteve</h1>
          <p className="sub">
            As viagens que já terminaram, com o que foi gasto e o roteiro que vocês seguiram.
          </p>
        </div>
        <div className="dashboard-actions">
          <a className="btn ghost" href="/app">
            Viagens ativas
          </a>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      {loading && !finished.length ? (
        <div className="card"><p className="sub">Carregando...</p></div>
      ) : !finished.length ? (
        <div className="card">
          <h3>Nada no histórico ainda</h3>
          <p className="sub">
            Quando a primeira viagem terminar, ela aparece aqui — com gastos, roteiro e tudo que
            vocês guardaram no caminho.
          </p>
          <a className="btn" href="/nova">
            Criar viagem
          </a>
        </div>
      ) : (
        <>
          <div className="history-stats">
            <div>
              <span className="stat-label">Viagens</span>
              <strong className="stat-value">{finished.length}</strong>
            </div>
            <div>
              <span className="stat-label">Dias viajados</span>
              <strong className="stat-value">{totalDays}</strong>
            </div>
            <div>
              <span className="stat-label">Destinos</span>
              <strong className="stat-value">{destinations}</strong>
            </div>
            <div>
              <span className="stat-label">Gasto registrado</span>
              <strong className="stat-value">{moneyFormatter.format(totalSpent)}</strong>
            </div>
          </div>

          <div className="history-list">
            {finished.map((trip) => (
              <article className="card history-card" key={trip.id}>
                <div className="history-card-head">
                  <div>
                    <h3>{trip.destination}</h3>
                    <p className="tiny">{formatRange(trip.start_date, trip.end_date)}</p>
                  </div>
                  <span className="badge b-ok">
                    {tripLength(trip.start_date, trip.end_date)} dias
                  </span>
                </div>

                <div className="history-meta">
                  <div>
                    <span>Gastos</span>
                    <strong>{moneyFormatter.format(Number(trip.expenses_total ?? 0))}</strong>
                  </div>
                  <div>
                    <span>Pessoas</span>
                    <strong>{trip.is_solo ? "solo" : trip.members_count}</strong>
                  </div>
                  <div>
                    <span>Roteiro</span>
                    <strong>{trip.latest_itinerary ? "gerado" : "sem roteiro"}</strong>
                  </div>
                </div>

                <div className="history-actions">
                  <a className="btn ghost sm" href={`/v/${trip.slug}`}>
                    Abrir
                  </a>
                  {trip.latest_itinerary && (
                    <DuplicateTrip slug={trip.slug} label="Repetir esta viagem" />
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
