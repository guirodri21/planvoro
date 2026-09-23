"use client";

/**
 * Agenda, Modo viagem e Mapa: as tres telas que se usam durante a viagem,
 * nao no planejamento.
 */

import { useState } from "react";
import { TripMap, mapsUrl, type MapPoint } from "@/components/trip-map";
import { formatKm, suggestRoute, type GeoPoint } from "@/lib/route-order";
import type { Itinerary, Trip, TripChecklistItem, TripVaultItem } from "@/lib/types";
import { buildTravelTimeline } from "../_lib/timeline";
import {
  checklistCategoryLabel,
  dateKeyFromDate,
  formatCurrency,
  isOutsideTripDates,
  pluralItens,
  formatAgendaDay,
  formatMoney,
  formatVaultDate,
  vaultKindLabel,
  vaultStatusLabel,
} from "../_lib/format";

export function TravelModeView({
  trip,
  itinerary,
  vaultItems,
  checklistItems,
  generating,
  onGenerate,
  onGoToAgenda,
  onGoToChecklist,
  onGoToVault,
}: {
  trip: Trip;
  itinerary: Itinerary | null;
  vaultItems: TripVaultItem[];
  checklistItems: TripChecklistItem[];
  generating: boolean;
  onGenerate: () => void;
  onGoToAgenda: () => void;
  onGoToChecklist: () => void;
  onGoToVault: () => void;
}) {
  const now = new Date();
  const todayKey = dateKeyFromDate(now);
  const tripStart = new Date(`${trip.start_date}T00:00:00`);
  const tripEnd = new Date(`${trip.end_date}T23:59:59`);
  const entries = buildTravelTimeline(trip, itinerary, vaultItems);
  const todayEntries = entries.filter((entry) => entry.dayKey === todayKey);
  const currentEntry = entries.find((entry) => entry.sortTime <= now.getTime() && entry.endTime >= now.getTime());
  const nextEntry = entries.find((entry) => entry.sortTime > now.getTime());
  const upcomingToday = todayEntries.filter((entry) => entry.sortTime >= now.getTime()).slice(0, 5);
  const activeVaultItems = vaultItems.filter((item) => item.status !== "canceled");
  const attentionVault = activeVaultItems.filter((item) => item.status === "attention" || isOutsideTripDates(item, trip));
  const overdueChecklist = checklistItems.filter(
    (item) => item.status === "open" && item.due_date && item.due_date < todayKey
  );
  const dueTodayChecklist = checklistItems.filter(
    (item) => item.status === "open" && item.due_date === todayKey
  );
  const openChecklist = checklistItems.filter((item) => item.status === "open");
  const undatedVault = activeVaultItems.filter((item) => !item.starts_at && !item.ends_at);
  const daysToTrip = Math.ceil((tripStart.getTime() - now.getTime()) / 86_400_000);
  const isDuringTrip = now >= tripStart && now <= tripEnd;
  const isAfterTrip = now > tripEnd;
  const heroTitle = isDuringTrip
    ? "Modo viagem ligado"
    : isAfterTrip
      ? "Viagem concluida, hora de fechar a organizacao"
      : daysToTrip <= 1
        ? "Pre-embarque final"
        : "Sala de preparo da viagem";
  const heroSubtitle = isDuringTrip
    ? "Acompanhe o que esta acontecendo agora, o que vem em seguida e qualquer alerta operacional."
    : isAfterTrip
      ? "Revise gastos, guarde comprovantes finais e use o histórico como memória da viagem."
      : "Use esta tela como checklist vivo antes de embarcar: reservas, horários, documentos e pendências.";
  const statusLabel = isDuringTrip
    ? "em andamento"
    : isAfterTrip
      ? "pós-viagem"
      : daysToTrip > 1
        ? `faltam ${daysToTrip} dias`
        : daysToTrip === 1
          ? "amanhã"
          : "começa hoje";
  const focusEntry = currentEntry ?? nextEntry;
  const firstChecklist = overdueChecklist[0] ?? dueTodayChecklist[0] ?? openChecklist[0] ?? null;
  const alerts = [
    ...overdueChecklist.slice(0, 3).map((item) => ({
      title: item.title,
      body: `Checklist atrasado · ${checklistCategoryLabel(item.category)}`,
      action: onGoToChecklist,
    })),
    ...dueTodayChecklist.slice(0, 3).map((item) => ({
      title: item.title,
      body: `Para hoje · ${checklistCategoryLabel(item.category)}`,
      action: onGoToChecklist,
    })),
    ...attentionVault.slice(0, 4).map((item) => ({
      title: item.title,
      body: `${vaultKindLabel(item.kind)} · ${vaultStatusLabel(item.status)}`,
      action: onGoToVault,
    })),
    ...undatedVault.slice(0, 2).map((item) => ({
      title: item.title,
      body: "No Cofre, mas sem data ou horário",
      action: onGoToVault,
    })),
  ].slice(0, 6);

  return (
    <div className="travel-mode-shell">
      <section className="travel-mode-hero">
        <div className="travel-mode-map">
          <span className="travel-pulse" />
          <span className="travel-route-line" />
          <span className="travel-dot d1" />
          <span className="travel-dot d2" />
          <span className="travel-dot d3" />
        </div>
        <div className="travel-mode-copy">
          <span className="badge b-ok">modo viagem</span>
          <h2>{heroTitle}</h2>
          <p>{heroSubtitle}</p>
          <div className="travel-mode-actions">
            {!itinerary && (
              <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
                {generating ? "Gerando..." : "Gerar roteiro"}
              </button>
            )}
            <button className="btn ghost" type="button" onClick={onGoToAgenda}>
              Abrir agenda completa
            </button>
            <button className="btn ghost" type="button" onClick={onGoToVault}>
              Ver reservas
            </button>
          </div>
        </div>
        <div className="travel-mode-status-card">
          <span className="stat-label">Status da viagem</span>
          <strong>{statusLabel}</strong>
          <small>
            {entries.length
              ? `${entries.length} marco${entries.length === 1 ? "" : "s"} entre roteiro e cofre`
              : "Sem agenda montada ainda"}
          </small>
        </div>
      </section>

      <div className="travel-mode-grid">
        <div className="card travel-now-card">
          <span className="stat-label">{currentEntry ? "Acontecendo agora" : "Próximo passo"}</span>
          {focusEntry ? (
            <>
              <h3>{focusEntry.title}</h3>
              <p className="sub">
                {focusEntry.timeLabel} · {formatAgendaDay(focusEntry.dayKey)} ·{" "}
                {focusEntry.source === "cofre" ? "Cofre" : "Roteiro"}
              </p>
              <div className="travel-now-meta">
                <span>{focusEntry.label}</span>
                <span>{focusEntry.statusLabel}</span>
                {focusEntry.place && <span>{focusEntry.place}</span>}
                {focusEntry.amount != null && (
                  <span>
                    {focusEntry.currency
                      ? formatCurrency(Number(focusEntry.amount), focusEntry.currency ?? "BRL")
                      : formatMoney(Number(focusEntry.amount))}
                  </span>
                )}
              </div>
              {focusEntry.description && <p className="item-d">{focusEntry.description}</p>}
              {focusEntry.url && (
                <a className="btn ghost sm" href={focusEntry.url} target="_blank" rel="noreferrer">
                  Abrir link salvo
                </a>
              )}
            </>
          ) : (
            <>
              <h3>Nenhum compromisso com horário ainda</h3>
              <p className="sub">
                Adicione horários no Cofre ou gere um roteiro para esta tela virar o copiloto do dia.
              </p>
              <button className="btn ghost" type="button" onClick={onGoToVault}>
                Guardar reserva no Cofre
              </button>
            </>
          )}
        </div>

        <div className="card travel-next-card">
          <span className="stat-label">Hoje</span>
          <h3>{todayEntries.length ? `${todayEntries.length} marco${todayEntries.length === 1 ? "" : "s"}` : "Dia livre"}</h3>
          {upcomingToday.length ? (
            <div className="travel-mini-timeline">
              {upcomingToday.map((entry) => (
                <button type="button" key={entry.id} onClick={onGoToAgenda}>
                  <strong>{entry.timeLabel}</strong>
                  <span>{entry.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sub">
              {todayEntries.length
                ? "Os marcos de hoje já passaram. Se ainda estiver na rua, confira a agenda completa."
                : "Nada datado para hoje. Bom para explorar, descansar ou completar pendências."}
            </p>
          )}
        </div>

        <div className="card travel-alert-card">
          <div className="travel-card-head">
            <div>
              <span className="stat-label">Radar de campo</span>
              <h3>{alerts.length ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"}` : "Tudo calmo"}</h3>
            </div>
            <button className="btn ghost sm" type="button" onClick={onGoToChecklist}>
              Checklist
            </button>
          </div>
          {alerts.length ? (
            <div className="travel-alert-list">
              {alerts.map((alert) => (
                <button type="button" key={`${alert.title}-${alert.body}`} onClick={alert.action}>
                  <strong>{alert.title}</strong>
                  <span>{alert.body}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sub">Sem checklist atrasado e sem reserva marcada para conferir. O raro sabor da ordem.</p>
          )}
        </div>

        <div className="card travel-quick-card">
          <span className="stat-label">Atalhos uteis</span>
          <h3>Se algo apertar</h3>
          <div className="travel-quick-grid">
            <button type="button" onClick={onGoToVault}>
              <strong>Reservas</strong>
              <span>voo, hotel, códigos e links</span>
            </button>
            <button type="button" onClick={onGoToAgenda}>
              <strong>Agenda</strong>
              <span>dia por dia em ordem</span>
            </button>
            <button type="button" onClick={onGoToChecklist}>
              <strong>Pendências</strong>
              <span>{firstChecklist ? firstChecklist.title : "nada urgente agora"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TripAgendaView({
  trip,
  itinerary,
  vaultItems,
  generating,
  onGenerate,
  onGoToRoute,
  onGoToVault,
}: {
  trip: Trip;
  itinerary: Itinerary | null;
  vaultItems: TripVaultItem[];
  generating: boolean;
  onGenerate: () => void;
  onGoToRoute: () => void;
  onGoToVault: () => void;
}) {
  const activeVaultItems = vaultItems.filter((item) => item.status !== "canceled");
  const entries = buildTravelTimeline(trip, itinerary, vaultItems);
  const routeEntryCount = entries.filter((entry) => entry.source === "roteiro").length;
  const dayKeys = Array.from(new Set(entries.map((entry) => entry.dayKey))).sort();
  const undatedVault = activeVaultItems.filter((item) => !item.starts_at && !item.ends_at);
  const outsideTripDates = activeVaultItems.filter((item) => isOutsideTripDates(item, trip)).length;
  const attentionVault = activeVaultItems.filter((item) => item.status === "attention").length;
  const routeDays = itinerary?.itinerary_days.length ?? 0;

  const radar = [
    !itinerary && "Roteiro ainda não foi gerado.",
    activeVaultItems.length > 0 &&
      undatedVault.length > 0 &&
      `${undatedVault.length} ${pluralItens(undatedVault.length)} do Cofre sem data ou horário.`,
    outsideTripDates > 0 &&
      `${outsideTripDates} ${pluralItens(outsideTripDates)} com data fora do periodo da viagem.`,
    attentionVault > 0 &&
      `${attentionVault} ${pluralItens(attentionVault)} marcado${attentionVault === 1 ? "" : "s"} para conferir.`,
    entries.length > 0 && routeEntryCount === 0 && "A Agenda ainda depende só do Cofre; gere o roteiro para ver os passeios.",
  ].filter(Boolean) as string[];

  return (
    <div className="agenda-shell">
      <div className="card agenda-hero">
        <div>
          <span className="badge b-ok">linha do tempo</span>
          <h2>Agenda da viagem</h2>
          <p className="sub">
            Roteiro, voos, hospedagens, reservas e documentos datados no mesmo lugar. O objetivo é
            enxergar a viagem como ela vai acontecer, dia por dia.
          </p>
        </div>
        <div className="agenda-hero-actions">
          {!itinerary && (
            <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
              {generating ? "Gerando..." : "Gerar roteiro"}
            </button>
          )}
          <button className="btn ghost" type="button" onClick={onGoToRoute}>
            Abrir roteiro
          </button>
          <button className="btn ghost" type="button" onClick={onGoToVault}>
            Abrir Cofre
          </button>
        </div>

        <div className="agenda-stats">
          <div>
            <span className="stat-label">Dias roteirizados</span>
            <strong>{routeDays || "a gerar"}</strong>
          </div>
          <div>
            <span className="stat-label">Marcos na agenda</span>
            <strong>{entries.length}</strong>
          </div>
          <div>
            <span className="stat-label">Cofre sem horário</span>
            <strong>{undatedVault.length}</strong>
          </div>
          <div>
            <span className="stat-label">Alertas</span>
            <strong>{radar.length}</strong>
          </div>
        </div>
      </div>

      <div className="agenda-layout">
        <div className="agenda-days">
          {entries.length === 0 ? (
            <div className="card agenda-empty">
              <h3>A linha do tempo ainda está vazia</h3>
              <p className="sub">
                Gere o roteiro ou adicione datas nos itens do Cofre para a Agenda virar o painel
                cronologico da viagem.
              </p>
              <div className="agenda-empty-actions">
                <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
                  {generating ? "Gerando roteiro..." : "Gerar roteiro"}
                </button>
                <button className="btn ghost" type="button" onClick={onGoToVault}>
                  Guardar reserva no Cofre
                </button>
              </div>
            </div>
          ) : (
            dayKeys.map((dayKey) => {
              const dayEntries = entries.filter((entry) => entry.dayKey === dayKey);
              return (
                <div className="agenda-day-card" key={dayKey}>
                  <div className="agenda-day-head">
                    <div>
                      <span className="stat-label">Dia da viagem</span>
                      <h3>{formatAgendaDay(dayKey)}</h3>
                    </div>
                    <span className="badge b-ok">
                      {dayEntries.length} marco{dayEntries.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="agenda-entry-list">
                    {dayEntries.map((entry) => (
                      <div className={`agenda-entry ${entry.source} ${entry.attention ? "attention" : ""}`} key={entry.id}>
                        <div className="agenda-time">
                          <strong>{entry.timeLabel}</strong>
                          <span>{entry.source === "roteiro" ? "roteiro" : "cofre"}</span>
                        </div>
                        <div className="agenda-entry-body">
                          <div className="agenda-entry-head">
                            <div>
                              <span className="stat-label">{entry.label}</span>
                              <h4>{entry.title}</h4>
                            </div>
                            <span className={`badge ${entry.attention ? "b-warn" : "b-ok"}`}>
                              {entry.statusLabel}
                            </span>
                          </div>
                          {entry.description && <p className="item-d">{entry.description}</p>}
                          <div className="agenda-entry-meta">
                            {entry.place && <span>{entry.place}</span>}
                            {entry.amount != null && (
                              <span>
                                {"currency" in entry
                                  ? formatCurrency(Number(entry.amount), entry.currency ?? "BRL")
                                  : formatMoney(Number(entry.amount))}
                              </span>
                            )}
                            {entry.url && (
                              <a href={entry.url} target="_blank" rel="noreferrer">
                                Abrir link
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="agenda-side">
          <div className="card agenda-radar">
            <span className="badge b-warn">radar</span>
            <h3>O que observar</h3>
            {radar.length ? (
              <div className="agenda-radar-list">
                {radar.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : (
              <p className="sub">Agenda sem alertas obvios agora. Bom sinal, capitão.</p>
            )}
          </div>

          <div className="card agenda-radar">
            <span className="badge b-ok">sem data</span>
            <h3>Cofre ainda solto</h3>
            {undatedVault.length ? (
              <div className="agenda-loose-list">
                {undatedVault.slice(0, 6).map((item) => (
                  <button type="button" key={item.id} onClick={onGoToVault}>
                    <strong>{item.title}</strong>
                    <span>
                      {vaultKindLabel(item.kind)} · {vaultStatusLabel(item.status)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="sub">Tudo que está ativo no Cofre já tem data ou horário.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Aba Mapa: um dia por vez, com os lugares que a verificacao geolocalizou.
 *
 * Item sem coordenada nao aparece, e isso e dito na tela. Plotar um
 * chute no meio do mapa seria pior do que nao plotar: a pessoa iria ate
 * o lugar errado.
 */
export function TripMapView({ itinerary }: { itinerary: Itinerary | null }) {
  const days = itinerary?.itinerary_days ?? [];
  /** -1 = todos os dias no mesmo mapa. */
  const [dayIndex, setDayIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const daysWithPoints = days.map((day) => ({
    day,
    points: day.itinerary_items
      .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
      .map<GeoPoint>((item, index) => ({
        id: item.id,
        title: item.title,
        lat: item.lat as number,
        lng: item.lng as number,
        startTime: item.start_time,
        position: item.position ?? index,
      })),
  }));

  const mappable = daysWithPoints.filter((entry) => entry.points.length > 0);

  if (!itinerary) {
    return (
      <div className="card">
        <h2>Mapa</h2>
        <p className="sub">Gere o roteiro primeiro. O mapa usa os lugares que a IA verificou.</p>
      </div>
    );
  }

  /**
   * Quantos lugares nem chegaram a ser conferidos.
   *
   * A conferencia acontece na hora de gerar e respeita 1 consulta por
   * segundo, exigencia do servico de mapas. Roteiro longo estoura esse
   * orcamento, e o que sobra fica sem coordenada — sem que ninguem tenha
   * dito que aquele lugar nao existe.
   *
   * Contar isso na tela e a diferenca entre "o Planvoro nao achou o
   * Instituto Ricardo Brennand" e "o Planvoro ainda nao olhou".
   */
  const naoConferidos = days.reduce(
    (soma, day) =>
      soma + day.itinerary_items.filter((item) => item.verified === null).length,
    0
  );

  if (!mappable.length) {
    return (
      <div className="card">
        <h2>Mapa</h2>
        <p className="sub">
          {naoConferidos > 0
            ? `Nenhum lugar deste roteiro foi conferido ainda — a conferência de endereços respeita um limite de uma consulta por segundo e não alcançou nenhum item. Regerar o roteiro tenta de novo.`
            : "Nenhum item do roteiro tem coordenada confirmada. Só entram no mapa os lugares que a verificação conseguiu localizar — plotar um palpite levaria você ao endereço errado."}
        </p>
      </div>
    );
  }

  const safeIndex = dayIndex < 0 ? -1 : Math.min(dayIndex, mappable.length - 1);
  const todos = safeIndex === -1;
  const active = todos ? null : mappable[safeIndex];
  const route = active ? suggestRoute(active.points) : null;

  /**
   * Pontos que vao para o mapa.
   *
   * No dia: numerados na ordem da visita, na cor da marca. Em "Todos os
   * dias": cada dia com a sua cor e o pino com o numero do dia, para ver
   * de relance se dois dias cruzam a cidade para o mesmo bairro.
   */
  const pontosDoMapa: MapPoint[] = todos
    ? mappable.flatMap((entry, diaIndex) =>
        entry.points.map((point) => ({
          ...point,
          label: String(diaIndex + 1),
          color: corDoDia(diaIndex),
          group: entry.day.id,
          subtitle: `Dia ${diaIndex + 1}${point.startTime ? ` · ${point.startTime}` : ""}`,
        }))
      )
    : (route?.current ?? []).map((point, index) => ({
        ...point,
        label: String(index + 1),
        color: corDoDia(safeIndex),
        group: "dia",
        subtitle: point.startTime ?? undefined,
      }));

  const totalLugares = mappable.reduce((soma, entry) => soma + entry.points.length, 0);

  return (
    <div className="map-shell">
      <div className="card map-toolbar">
        <div className="map-toolbar-head">
          <div>
            <span className="stat-label">Mapa da viagem</span>
            <h2>
              {todos
                ? "Todos os dias"
                : active?.day.title || formatVaultDate(`${active?.day.day_date}T12:00:00`)}
            </h2>
          </div>
          <p className="tiny">
            {todos
              ? `${totalLugares} lugares em ${mappable.length} dia${mappable.length === 1 ? "" : "s"}`
              : active && route
                ? active.points.length === 1
                  ? "1 lugar neste dia"
                  : `${active.points.length} lugares · ${formatKm(route.currentKm)} em linha reta`
                : ""}
          </p>
        </div>

        {/* Um chip por dia, no lugar de "Anterior/Próximo": em viagem de
            dez dias, chegar ao sétimo eram seis cliques. */}
        <div className="map-days" role="tablist" aria-label="Escolher o dia no mapa">
          <button
            type="button"
            role="tab"
            aria-selected={todos}
            className={`map-day ${todos ? "on" : ""}`}
            onClick={() => {
              setDayIndex(-1);
              setActiveId(null);
            }}
          >
            Todos
          </button>
          {mappable.map((entry, index) => (
            <button
              key={entry.day.id}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              title={entry.day.title ?? undefined}
              className={`map-day ${index === safeIndex ? "on" : ""}`}
              onClick={() => {
                setDayIndex(index);
                setActiveId(null);
              }}
            >
              <i style={{ background: corDoDia(index) }} aria-hidden="true" />
              Dia {days.indexOf(entry.day) + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="map-layout">
        <div className="card map-card">
          <TripMap points={pontosDoMapa} activeId={activeId} onSelect={setActiveId} />

          {naoConferidos > 0 && (
            <p className="tiny map-aviso">
              {naoConferidos === 1
                ? "1 lugar do roteiro ainda não foi conferido"
                : `${naoConferidos} lugares do roteiro ainda não foram conferidos`}{" "}
              — a conferência de endereço aceita uma consulta por segundo e não alcançou todos. Não
              quer dizer que não existam.
            </p>
          )}
        </div>

        <div className="card map-side">
          {todos ? (
            mappable.map((entry, diaIndex) => (
              <div className="map-group" key={entry.day.id}>
                <button
                  type="button"
                  className="map-group-head"
                  onClick={() => {
                    setDayIndex(diaIndex);
                    setActiveId(null);
                  }}
                >
                  <i style={{ background: corDoDia(diaIndex) }} aria-hidden="true" />
                  <strong>Dia {days.indexOf(entry.day) + 1}</strong>
                  <span>{entry.day.title}</span>
                </button>
                <ListaDeLugares
                  pontos={entry.points}
                  cor={corDoDia(diaIndex)}
                  activeId={activeId}
                  onSelect={setActiveId}
                  rotulo={String(diaIndex + 1)}
                />
              </div>
            ))
          ) : route ? (
            <>
              <span className="stat-label">Ordem do dia</span>
              <ListaDeLugares
                pontos={route.current}
                cor={corDoDia(safeIndex)}
                activeId={activeId}
                onSelect={setActiveId}
                numerar
              />

              {route.worthIt ? (
                <div className="note">
                  <b>Dá para andar {formatKm(route.savedKm)} a menos</b>
                  <br />
                  Visitando nesta ordem: {route.suggested.map((point) => point.title).join(" → ")}.
                  {route.fixedCount > 0 && (
                    <>
                      {" "}
                      Confira antes: {route.fixedCount} item{route.fixedCount === 1 ? "" : "s"} tem
                      horário marcado e talvez não possa mudar de lugar.
                    </>
                  )}
                </div>
              ) : (
                <p className="tiny">
                  A ordem atual já está boa: reorganizar economizaria pouco para o trabalho de
                  remarcar tudo.
                </p>
              )}
            </>
          ) : null}

          <p className="tiny">
            Distâncias em linha reta, não por rua. Servem para perceber travessia desnecessária da
            cidade, não para calcular tempo de trajeto.
          </p>
        </div>
      </div>
    </div>
  );
}

const CORES_DOS_DIAS = [
  "#0e9c6b",
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#dc2626",
];

function corDoDia(index: number) {
  return CORES_DOS_DIAS[Math.max(0, index) % CORES_DOS_DIAS.length];
}

/**
 * Lista ao lado do mapa. Tocar num lugar centraliza o mapa nele; o link
 * abre o endereco no Google Maps, que e o que a pessoa quer na rua.
 */
function ListaDeLugares({
  pontos,
  cor,
  activeId,
  onSelect,
  numerar = false,
  rotulo = "•",
}: {
  pontos: GeoPoint[];
  cor: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  numerar?: boolean;
  /** O que vai no pino quando a lista nao e numerada (o dia, em "Todos"). */
  rotulo?: string;
}) {
  return (
    <ol className="map-list">
      {pontos.map((point, index) => (
        <li key={point.id} className={activeId === point.id ? "on" : ""}>
          <button type="button" onClick={() => onSelect(point.id)}>
            <span className="map-list-pin" style={{ background: cor }}>
              {numerar ? index + 1 : rotulo}
            </span>
            <span className="map-list-text">
              <strong>{point.title}</strong>
              {point.startTime && <small>{point.startTime}</small>}
            </span>
          </button>
          <a href={mapsUrl(point)} target="_blank" rel="noreferrer" aria-label={`Abrir ${point.title} no Google Maps`}>
            Maps ↗
          </a>
        </li>
      ))}
    </ol>
  );
}
