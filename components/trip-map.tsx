"use client";

import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/lib/route-order";

/** Ponto do mapa, com o que so a tela precisa: cor e grupo (o dia). */
export type MapPoint = GeoPoint & {
  /** Numero mostrado no pino. Padrao: a posicao na lista + 1. */
  label?: string;
  /** Cor do pino e do trajeto. */
  color?: string;
  /** Pontos do mesmo grupo sao ligados por um trajeto. */
  group?: string;
  /** Linha extra do popup, ex. "Dia 2 · 10:00". */
  subtitle?: string;
};

const BRAND = "#0e9c6b";

/** Link que abre o lugar no app de mapas do celular (ou no navegador). */
export function mapsUrl(point: Pick<GeoPoint, "lat" | "lng" | "title">) {
  const q = `${point.lat},${point.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Mapa da viagem, com Leaflet e tiles do OpenStreetMap.
 *
 * O Leaflet e carregado sob demanda (`import()` dentro do efeito) porque
 * ele so funciona no navegador e pesa ~150 KB. Quem nunca abre a aba do
 * mapa nao paga por isso.
 *
 * A politica de uso do OSM exige identificar a aplicacao e nao martelar
 * os servidores; por isso a atribuicao fica visivel e os tiles usam o
 * cache normal do navegador.
 *
 * `activeId` centraliza e abre o popup de um ponto — e o que liga a lista
 * ao lado ao mapa. Tocar num pino devolve o id por `onSelect`.
 */
export function TripMap({
  points,
  className,
  activeId,
  onSelect,
}: {
  points: MapPoint[];
  className?: string;
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Guarda a instancia para destruir no cleanup: sem isso, trocar de dia
  // deixa mapas empilhados no mesmo no e o Leaflet reclama do container.
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef(new Map<string, import("leaflet").Marker>());
  // O callback muda a cada render do pai; ler por ref evita redesenhar o
  // mapa inteiro so porque a funcao e outra.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /**
   * Assinatura do conteudo dos pontos.
   *
   * Quem usa o mapa monta a lista a cada render, entao o array muda de
   * identidade mesmo com os mesmos lugares. Com `[points]` como
   * dependencia, tocar num item da lista (que so muda `activeId`)
   * destruia e recriava o mapa, e o popup aberto sumia junto.
   */
  const assinatura = points
    .map((p) => `${p.id}:${p.lat}:${p.lng}:${p.label ?? ""}:${p.color ?? ""}:${p.group ?? ""}`)
    .join("|");
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const points = pointsRef.current;
      if (!containerRef.current || !points.length) return;

      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();

      const map = L.map(containerRef.current, {
        // Roda do mouse so depois de clicar no mapa: sem isso, rolar a
        // pagina por cima dele dava zoom sem querer.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;
      map.once("focus", () => map.scrollWheelZoom.enable());
      map.on("click", () => map.scrollWheelZoom.enable());

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Trajeto por grupo (dia), na cor do grupo, tracejado para nao
      // parecer rota de rua — as distancias sao em linha reta.
      const grupos = new Map<string, MapPoint[]>();
      for (const point of points) {
        const key = point.group ?? "unico";
        const lista = grupos.get(key) ?? [];
        lista.push(point);
        grupos.set(key, lista);
      }
      for (const lista of grupos.values()) {
        if (lista.length < 2) continue;
        L.polyline(
          lista.map((p) => [p.lat, p.lng] as [number, number]),
          { color: lista[0].color ?? BRAND, weight: 3, opacity: 0.7, dashArray: "6 8" }
        ).addTo(map);
      }

      points.forEach((point, index) => {
        // O icone padrao do Leaflet aponta para marker-icon.png com caminho
        // relativo, que aqui resolve para /v/marker-icon.png e da 404 — o
        // que aparecia era a palavra "Marker" cortada. Um divIcon nao busca
        // arquivo nenhum e ainda carrega a ordem da parada, que e a
        // informacao que o mapa existe para dar.
        const label = point.label ?? String(index + 1);
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "trip-map-pin",
            html: `<span style="background:${point.color ?? BRAND}">${escapeHtml(label)}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15],
          }),
          title: point.title,
          alt: `Parada ${label}: ${point.title}`,
          riseOnHover: true,
        }).addTo(map);

        marker.bindPopup(
          `<strong>${escapeHtml(label)}. ${escapeHtml(point.title)}</strong>${
            point.subtitle ? `<br><span>${escapeHtml(point.subtitle)}</span>` : ""
          }<br><a href="${mapsUrl(point)}" target="_blank" rel="noreferrer">Abrir no Google Maps →</a>`
        );
        marker.on("click", () => onSelectRef.current?.(point.id));
        markersRef.current.set(point.id, marker);
      });

      const latLngs = points.map((point) => [point.lat, point.lng] as [number, number]);
      if (latLngs.length > 1) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36] });
      } else {
        map.setView(latLngs[0], 15);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
    };
  }, [assinatura]);

  useEffect(() => {
    if (!activeId) return;
    const map = mapRef.current;
    const marker = markersRef.current.get(activeId);
    if (!map || !marker) return;
    // O popup abre ao fim do voo: aberto antes, o Leaflet o fechava no
    // meio da animacao e o clique na lista parecia nao fazer nada.
    map.once("moveend", () => marker.openPopup());
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [activeId]);

  if (!points.length) return null;

  return <div ref={containerRef} className={`trip-map ${className ?? ""}`} />;
}

/** O titulo vem do usuario e vai para dentro de HTML do popup. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
