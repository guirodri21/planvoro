/**
 * Ordem de visita dentro de um dia.
 *
 * Nao chama servico de rotas: usa distancia em linha reta entre os
 * pontos. Isso subestima o trajeto real, que anda por ruas, mas serve
 * para o que importa aqui — perceber que o roteiro manda a pessoa
 * atravessar a cidade e voltar. Um erro de 30% na distancia nao muda
 * essa conclusao, e evita depender de API paga com limite de uso.
 *
 * A ordem sugerida NUNCA e aplicada sozinha. Horario marcado manda mais
 * que economia de deslocamento: um voo as 14h nao vira o terceiro item
 * porque fica mais perto do museu.
 */

export type GeoPoint = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  /** Horario no formato HH:MM, quando houver. */
  startTime?: string | null;
  position: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Distancia em linha reta, em quilometros (formula de haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Soma o deslocamento de um percurso, na ordem dada. */
export function totalDistanceKm(points: GeoPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceKm(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Reordena por vizinho mais proximo, partindo do primeiro ponto.
 *
 * Nao e a rota otima — achar a otima e o problema do caixeiro viajante,
 * caro e desnecessario para seis paradas. O vizinho mais proximo resolve
 * o caso que interessa: separar o que esta do mesmo lado da cidade.
 */
export function optimizeOrder(points: GeoPoint[]): GeoPoint[] {
  if (points.length < 3) return [...points];

  const remaining = [...points];
  const ordered: GeoPoint[] = [remaining.shift() as GeoPoint];

  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((candidate, index) => {
      const distance = distanceKm(current, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

export type RouteSuggestion = {
  current: GeoPoint[];
  suggested: GeoPoint[];
  currentKm: number;
  suggestedKm: number;
  savedKm: number;
  /** Vale sugerir? So quando a economia e sensivel de verdade. */
  worthIt: boolean;
  /** Quantos itens tem horario marcado e nao deveriam ser movidos. */
  fixedCount: number;
};

/**
 * Compara a ordem atual com a sugerida.
 *
 * `worthIt` exige economia de pelo menos 20% E de 1 km. So percentual
 * transformaria 300 metros de ganho em alarde; so quilometro esconderia
 * ganho grande em cidade pequena.
 */
export function suggestRoute(points: GeoPoint[]): RouteSuggestion {
  const current = [...points].sort((a, b) => a.position - b.position);
  const suggested = optimizeOrder(current);

  const currentKm = totalDistanceKm(current);
  const suggestedKm = totalDistanceKm(suggested);
  const savedKm = currentKm - suggestedKm;

  const fixedCount = current.filter((point) => Boolean(point.startTime)).length;

  return {
    current,
    suggested,
    currentKm,
    suggestedKm,
    savedKm,
    worthIt: currentKm > 0 && savedKm >= 1 && savedKm / currentKm >= 0.2,
    fixedCount,
  };
}

export function formatKm(value: number) {
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toFixed(1).replace(".", ",")} km`;
}
