"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LayerGroup as LeafletLayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Day, Item } from "@/lib/types";

// ------------------------------------------------------------- Mapa do roteiro
//
// O fundo de ruas vem de um servidor de tiles. O padrao e o servidor comunitario
// do OpenStreetMap: nao exige cadastro nem cartao, e na escala da beta o uso e
// irrisorio. A politica deles desencoraja uso pesado, entao quando o trafego
// crescer basta apontar NEXT_PUBLIC_MAP_TILE_URL para um provedor com cota
// (MapTiler, Stadia) — e so trocar a variavel, sem tocar em codigo.
const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Uma cor por dia, na ordem do roteiro. Repete depois de 8 dias, que ja e
// viagem longa o bastante para o filtro por dia ser o jeito util de olhar.
const DAY_COLORS = [
  "#10b981",
  "#06b6d4",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
];

type MapPoint = {
  item: Item;
  dayId: string;
  dayIndex: number;
  order: number;
  lat: number;
  lng: number;
};

export function RouteMap({ days }: { days: Day[] }) {
  const [activeDay, setActiveDay] = useState<string>("all");
  const [failed, setFailed] = useState(false);
  // O Leaflet chega por import assincrono. Sem este estado, o efeito que
  // desenha os marcadores roda antes do mapa existir, desiste, e nunca e
  // reexecutado — o mapa so aparecia depois de mexer no filtro de dia.
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  // Um item so entra no mapa se a verificacao antialucinacao achou o lugar.
  // Item sem coordenada nao e escondido do usuario: e contado logo abaixo.
  const allPoints = useMemo(() => {
    const points: MapPoint[] = [];
    days.forEach((day, dayIndex) => {
      let order = 0;
      day.itinerary_items.forEach((item) => {
        if (item.lat == null || item.lng == null) return;
        order += 1;
        points.push({ item, dayId: day.id, dayIndex, order, lat: item.lat, lng: item.lng });
      });
    });
    return points;
  }, [days]);

  const points = useMemo(
    () => (activeDay === "all" ? allPoints : allPoints.filter((p) => p.dayId === activeDay)),
    [allPoints, activeDay]
  );

  const totalItems = useMemo(
    () => days.reduce((sum, day) => sum + day.itinerary_items.length, 0),
    [days]
  );
  const missing = totalItems - allPoints.length;

  // Carrega o Leaflet so no browser. Ele mexe em window/document direto, entao
  // um import estatico quebraria a renderizacao no servidor.
  useEffect(() => {
    if (!allPoints.length) return;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          scrollWheelZoom: false,
          attributionControl: true,
        });
        L.tileLayer(MAP_TILE_URL, { attribution: MAP_TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

        leafletRef.current = L;
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        setFailed(false);
        setMapReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allPoints.length]);

  // Desmonta o mapa ao sair da aba, senao o Leaflet deixa listeners no window.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // Redesenha marcadores e trajeto quando o filtro de dia muda.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    if (!points.length) return;

    // Uma linha por dia, ligando os itens na ordem em que serao visitados.
    const byDay = new Map<string, MapPoint[]>();
    points.forEach((point) => {
      const list = byDay.get(point.dayId);
      if (list) list.push(point);
      else byDay.set(point.dayId, [point]);
    });

    byDay.forEach((dayPoints) => {
      if (dayPoints.length < 2) return;
      L.polyline(
        dayPoints.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: DAY_COLORS[dayPoints[0].dayIndex % DAY_COLORS.length],
          weight: 4,
          // Mapa de rua carregado engole linha fraca: no OSM o traco some entre
          // as vias e as rotas de barca, que ja sao tracejadas.
          opacity: 0.9,
          dashArray: "7 7",
        }
      ).addTo(layer);
    });

    points.forEach((point) => {
      const color = DAY_COLORS[point.dayIndex % DAY_COLORS.length];
      const pin = document.createElement("span");
      pin.className = "route-map-pin";
      pin.style.setProperty("--pin", color);
      pin.textContent = String(point.order);

      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          html: pin.outerHTML,
          className: "route-map-pin-wrap",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: point.item.title,
      });

      // Monta o popup como DOM em vez de string: o titulo vem da IA, entao
      // interpolar em HTML seria injecao esperando acontecer.
      const popup = document.createElement("div");
      popup.className = "route-map-popup";

      const heading = document.createElement("strong");
      heading.textContent = point.item.title;
      popup.appendChild(heading);

      const meta = [
        days[point.dayIndex]?.day_date,
        point.item.start_time,
        point.item.category,
      ].filter(Boolean);
      if (meta.length) {
        const metaEl = document.createElement("span");
        metaEl.textContent = meta.join(" · ");
        popup.appendChild(metaEl);
      }

      if (point.item.place_query) {
        const place = document.createElement("em");
        place.textContent = point.item.place_query;
        popup.appendChild(place);
      }

      marker.bindPopup(popup);
      marker.addTo(layer);
    });

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (points.length === 1) map.setView(bounds.getCenter(), 15);
    else map.fitBounds(bounds, { padding: [36, 36] });

    // O container so ganha altura depois que a aba aparece; sem isso o Leaflet
    // calcula o tamanho errado e o mapa fica cortado.
    setTimeout(() => map.invalidateSize(), 0);
  }, [points, days, mapReady]);

  if (!allPoints.length) {
    return (
      <div className="note route-map-empty">
        <b>Mapa indisponivel</b>
        <br />
        Nenhum item do roteiro tem coordenada ainda. O mapa aparece quando a verificacao de
        lugares reconhecer os enderecos — gere o roteiro de novo se isso persistir.
      </div>
    );
  }

  return (
    <div className="route-map">
      <div className="route-map-bar">
        <button
          type="button"
          className={activeDay === "all" ? "chip on" : "chip"}
          onClick={() => setActiveDay("all")}
        >
          Viagem toda
        </button>
        {days.map((day, index) => {
          const count = allPoints.filter((p) => p.dayId === day.id).length;
          if (!count) return null;
          return (
            <button
              key={day.id}
              type="button"
              className={activeDay === day.id ? "chip on" : "chip"}
              style={{ "--pin": DAY_COLORS[index % DAY_COLORS.length] } as CSSProperties}
              onClick={() => setActiveDay(day.id)}
            >
              <span className="route-map-dot" />
              {day.day_date}
            </button>
          );
        })}
      </div>

      {failed ? (
        <div className="note route-map-empty">
          <b>O mapa nao carregou</b>
          <br />
          Verifique a conexao e recarregue a pagina. O roteiro abaixo continua funcionando.
        </div>
      ) : (
        <div ref={containerRef} className="route-map-canvas" />
      )}

      <p className="muted route-map-foot">
        Numeros seguem a ordem do dia. A linha tracejada liga os itens na sequencia planejada.
        {missing > 0 &&
          ` ${missing} ${missing === 1 ? "item ainda nao tem" : "itens ainda nao tem"} coordenada e ${
            missing === 1 ? "nao aparece" : "nao aparecem"
          } aqui.`}
      </p>
    </div>
  );
}
