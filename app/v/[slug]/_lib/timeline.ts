/**
 * Linha do tempo da viagem.
 *
 * Junta roteiro e Cofre numa lista so, ordenada por hora. Sao as duas
 * fontes que tem horario, e para quem esta viajando a origem do item nao
 * importa — importa o que vem agora.
 */

import type { Itinerary, Trip, TripVaultItem } from "@/lib/types";
import {
  formatAgendaTime,
  isOutsideTripDates,
  localDateKey,
  vaultKindLabel,
  vaultStatusLabel,
} from "./format";
import type { TravelTimelineEntry } from "./workspace-types";

export function buildTravelTimeline(
  trip: Trip,
  itinerary: Itinerary | null,
  vaultItems: TripVaultItem[]
): TravelTimelineEntry[] {
  const routeEntries =
    itinerary?.itinerary_days.flatMap((day) =>
      day.itinerary_items.map((item, index) => {
        const time = item.start_time?.slice(0, 5) ?? null;
        const startTime = time
          ? new Date(`${day.day_date}T${time}:00`).getTime()
          : Number.MAX_SAFE_INTEGER - 1000 + index;
        const durationMs = Math.max(30, item.duration_min ?? 90) * 60_000;

        return {
          id: `route-${item.id}`,
          dayKey: day.day_date,
          sortTime: startTime,
          endTime: startTime + durationMs,
          timeLabel: time ?? `parada ${index + 1}`,
          source: "roteiro" as const,
          title: item.title,
          description: item.description,
          label: item.category ?? "Roteiro",
          place: item.place_query,
          statusLabel: item.verified ? "verificado" : item.needs_vote ? "votacao" : "planejado",
          amount: item.cost_estimate,
          url: null,
          attention: item.needs_vote,
        };
      })
    ) ?? [];

  const vaultEntries = vaultItems
    .filter((item) => item.status !== "canceled" && (item.starts_at || item.ends_at))
    .map((item) => {
      const dateValue = item.starts_at ?? item.ends_at ?? "";
      const startTime = new Date(dateValue).getTime();
      const endTime = item.ends_at ? new Date(item.ends_at).getTime() : startTime + 60 * 60_000;

      return {
        id: `vault-${item.id}`,
        dayKey: localDateKey(dateValue),
        sortTime: startTime,
        endTime,
        timeLabel: formatAgendaTime(dateValue),
        source: "cofre" as const,
        title: item.title,
        description: item.notes,
        label: vaultKindLabel(item.kind),
        place: item.location,
        statusLabel: vaultStatusLabel(item.status),
        amount: item.amount,
        currency: item.currency,
        url: item.url,
        attention: item.status === "attention" || isOutsideTripDates(item, trip),
      };
    });

  return [...routeEntries, ...vaultEntries].sort((a, b) => a.sortTime - b.sortTime);
}
