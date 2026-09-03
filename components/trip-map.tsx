"use client";

import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/lib/route-order";

/**
 * Mapa do dia, com Leaflet e tiles do OpenStreetMap.
 *
 * O Leaflet e carregado sob demanda (`import()` dentro do efeito) porque
 * ele so funciona no navegador e pesa ~150 KB. Quem nunca abre a aba do
 * mapa nao paga por isso.
 *
 * A politica de uso do OSM exige identificar a aplicacao e nao martelar
 * os servidores; por isso a atribuicao fica visivel e os tiles usam o
 * cache normal do navegador.
 */
export function TripMap({
  points,
  className,
}: {
  points: GeoPoint[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Guarda a instancia para destruir no cleanup: sem isso, trocar de dia
  // deixa mapas empilhados no mesmo no e o Leaflet reclama do container.
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!containerRef.current || !points.length) return;

      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const latLngs: [number, number][] = points.map((point) => [point.lat, point.lng]);

      points.forEach((point, index) => {
        // O icone padrao do Leaflet aponta para marker-icon.png com caminho
        // relativo, que aqui resolve para /v/marker-icon.png e da 404 — o
        // que aparecia era a palavra "Marker" cortada. Um divIcon nao busca
        // arquivo nenhum e ainda carrega a ordem da parada, que e a
        // informacao que o mapa existe para dar.
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "trip-map-pin",
            html: `<span>${index + 1}</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14],
          }),
          title: point.title,
          alt: `Parada ${index + 1}: ${point.title}`,
        }).addTo(map);

        marker.bindPopup(
          `<strong>${index + 1}. ${escapeHtml(point.title)}</strong>${
            point.startTime ? `<br>${escapeHtml(point.startTime)}` : ""
          }`
        );
      });

      if (latLngs.length > 1) {
        L.polyline(latLngs, { weight: 3, opacity: 0.65 }).addTo(map);
        map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28] });
      } else {
        map.setView(latLngs[0], 14);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points]);

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
