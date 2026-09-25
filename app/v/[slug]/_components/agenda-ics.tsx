"use client";

import { track } from "@/lib/analytics";
import { roteiroParaIcs } from "@/lib/ics";
import type { Itinerary, Trip } from "@/lib/types";

/**
 * Baixa o roteiro como .ics. No iPhone o Safari oferece "Adicionar ao
 * Calendario"; no Android e no computador o arquivo abre no Google
 * Agenda ou no Outlook. Gerado aqui mesmo, com o roteiro que a tela ja
 * tem: nao precisa de rota nem de login em link de calendario.
 */
export function AgendaDoCelular({ trip, itinerary }: { trip: Trip; itinerary: Itinerary | null }) {
  const itens = itinerary?.itinerary_days.reduce((n, d) => n + d.itinerary_items.length, 0) ?? 0;
  if (!itinerary || itens === 0) return null;

  function baixar() {
    const texto = roteiroParaIcs(trip, itinerary!.itinerary_days, `${window.location.origin}/v/${trip.slug}`);
    const url = URL.createObjectURL(new Blob([texto], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `planvoro-${trip.slug}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    track("roteiro_compartilhado", { canal: "agenda" });
  }

  return (
    <div className="agenda-ics card">
      <div>
        <b>Leve o roteiro para a agenda do celular</b>
        <p className="tiny">
          {itens} {itens === 1 ? "parada vira evento" : "paradas viram eventos"} no Google Agenda ou no
          Calendário do iPhone, no horário local da viagem. Se o roteiro mudar, baixe de novo.
        </p>
      </div>
      <button className="btn ghost" type="button" onClick={baixar}>
        Adicionar à agenda
      </button>
    </div>
  );
}
