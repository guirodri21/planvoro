import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DuplicateTrip } from "@/components/duplicate-trip";
import { RoteiroShare } from "@/components/roteiro-share";
import { formatBR, getPublicTrip, tripDays } from "@/lib/public";
import { buildItinerarySummary } from "@/lib/share";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro-app.vercel.app";

export const revalidate = 3600;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicTrip(slug);
  if (!data) return { title: "Roteiro não encontrado — Planvoro" };

  const { trip } = data;
  const dias = tripDays(trip);
  const title = `Roteiro de ${dias} dias em ${trip.destination}`;
  const description = trip.is_solo
    ? `Roteiro dia a dia em ${trip.destination}, com horários e custo estimado. Monte o seu de graça.`
    : `Roteiro de grupo em ${trip.destination} para ${trip.party_size} pessoas, equilibrando as preferências de todo mundo. Monte o seu de graça.`;

  return {
    title: `${title} — Planvoro`,
    description,
    alternates: { canonical: `/r/${slug}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function RoteiroPublico({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicTrip(slug);
  if (!data) notFound();

  const { trip, itinerary } = data;
  const dias = tripDays(trip);
  const shareUrl = `${BASE}/r/${slug}`;
  const summary = buildItinerarySummary(trip, itinerary, shareUrl);

  const total =
    itinerary?.itinerary_days.reduce(
      (s, d) => s + d.itinerary_items.reduce((a, i) => a + (i.cost_estimate ?? 0), 0),
      0
    ) ?? 0;

  return (
    <>
      <div className="card">
        <p className="eyebrow">Roteiro público</p>
        <h1 style={{ marginBottom: 6 }}>
          {dias} dias em {trip.destination}
        </h1>
        <p className="sub" style={{ margin: 0 }}>
          {formatBR(trip.start_date)} a {formatBR(trip.end_date)}
          {trip.is_solo ? " · viagem individual" : ` · ${trip.party_size} pessoas`}
          {total > 0 && ` · ~R$ ${total.toFixed(0)} por pessoa`}
        </p>

        <RoteiroShare summary={summary} url={shareUrl} />

        <p className="tiny print-only">
          Roteiro gerado por IA no Planvoro. Confira precos, horarios e regras oficiais na fonte
          antes de reservar. {shareUrl}
        </p>
      </div>

      {!itinerary ? (
        <div className="card">
          <p className="sub" style={{ margin: 0 }}>
            Esse roteiro ainda não foi gerado.
          </p>
        </div>
      ) : (
        <div className="card">
          {itinerary.rationale && (
            <div className="note" style={{ marginBottom: 18 }}>
              <b>Por que ficou assim</b>
              <br />
              {itinerary.rationale}
            </div>
          )}

          {itinerary.itinerary_days.map((day) => {
            const soma = day.itinerary_items.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
            return (
              <div className="day" key={day.id}>
                <div className="day-h">
                  <b>
                    {formatBR(day.day_date)}
                    {day.title ? ` · ${day.title}` : ""}
                  </b>
                  <span className="muted">~R$ {soma.toFixed(0)}</span>
                </div>
                {day.itinerary_items.map((item) => (
                  <div className="item" key={item.id}>
                    <div className="time">{item.start_time}</div>
                    <div className="item-b">
                      <div className="item-t">
                        {item.title}
                        {item.verified && <span className="badge b-ok">conferido</span>}
                      </div>
                      <div className="item-d">{item.description}</div>
                    </div>
                    <div className="cost">
                      {item.cost_estimate ? `R$ ${item.cost_estimate.toFixed(0)}` : "grátis"}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="card cta-box no-print">
        <h2 style={{ margin: "0 0 6px" }}>Gostou deste roteiro?</h2>
        <p className="sub">
          Leve para a sua conta e edite à vontade: troque dias, ajuste horários, convide o grupo e
          gere de novo com as preferências de todo mundo. Grátis para começar.
        </p>

        {itinerary && <DuplicateTrip slug={slug} />}

        <p className="tiny" style={{ marginTop: 14 }}>
          Ou <a href="/nova">comece uma viagem do zero</a>.
        </p>
      </div>
    </>
  );
}
