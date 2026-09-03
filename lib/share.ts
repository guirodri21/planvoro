import type { Itinerary, Trip } from "@/lib/types";
import { formatBR, tripDays } from "@/lib/public";

/**
 * Resumo do roteiro para mandar no WhatsApp.
 *
 * O texto vai dentro de uma URL, entao precisa ser curto: mensagem longa
 * demais e recusada por alguns clientes e fica ilegivel no celular. Por
 * isso o resumo lista o dia e os primeiros itens, nao o roteiro inteiro —
 * quem quiser o detalhe abre o link.
 */

const MAX_ITEMS_PER_DAY = 3;
const MAX_DAYS = 8;

export function buildItinerarySummary(
  trip: Trip,
  itinerary: Itinerary | null,
  url: string
): string {
  const dias = tripDays(trip);
  const linhas: string[] = [];

  linhas.push(`*${dias} dias em ${trip.destination}*`);
  linhas.push(`${formatBR(trip.start_date)} a ${formatBR(trip.end_date)}`);
  linhas.push("");

  const days = itinerary?.itinerary_days ?? [];

  if (!days.length) {
    linhas.push("O roteiro ainda esta sendo montado.");
    linhas.push("");
    linhas.push(url);
    return linhas.join("\n");
  }

  for (const day of days.slice(0, MAX_DAYS)) {
    const titulo = day.title ? ` - ${day.title}` : "";
    linhas.push(`*${formatBR(day.day_date)}*${titulo}`);

    for (const item of day.itinerary_items.slice(0, MAX_ITEMS_PER_DAY)) {
      linhas.push(`${item.start_time} ${item.title}`);
    }

    const sobrando = day.itinerary_items.length - MAX_ITEMS_PER_DAY;
    if (sobrando > 0) {
      linhas.push(`+${sobrando} no roteiro completo`);
    }

    linhas.push("");
  }

  if (days.length > MAX_DAYS) {
    linhas.push(`...e mais ${days.length - MAX_DAYS} dias.`);
    linhas.push("");
  }

  const total = days.reduce(
    (soma, day) => soma + day.itinerary_items.reduce((a, i) => a + (i.cost_estimate ?? 0), 0),
    0
  );
  if (total > 0) {
    linhas.push(`Estimativa: ~R$ ${total.toFixed(0)} por pessoa`);
    linhas.push("");
  }

  linhas.push("Roteiro completo:");
  linhas.push(url);

  return linhas.join("\n");
}

export function whatsappShareUrl(text: string) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
