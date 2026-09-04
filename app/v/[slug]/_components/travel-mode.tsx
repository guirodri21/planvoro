"use client";

/**
 * Agenda, Modo viagem e Mapa: as tres telas que se usam durante a viagem,
 * nao no planejamento.
 */

import { useState } from "react";
import { TripMap } from "@/components/trip-map";
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
      : "Use esta tela como checklist vivo antes de embarcar: reservas, horarios, documentos e pendências.";
  const statusLabel = isDuringTrip
    ? "em andamento"
    : isAfterTrip
      ? "pos-viagem"
      : daysToTrip > 1
        ? `faltam ${daysToTrip} dias`
        : daysToTrip === 1
          ? "amanha"
          : "comeca hoje";
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
      body: "No Cofre, mas sem data ou horario",
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
              <h3>Nenhum compromisso com horario ainda</h3>
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
      `${undatedVault.length} ${pluralItens(undatedVault.length)} do Cofre sem data ou horario.`,
    outsideTripDates > 0 &&
      `${outsideTripDates} ${pluralItens(outsideTripDates)} com data fora do periodo da viagem.`,
    attentionVault > 0 &&
      `${attentionVault} ${pluralItens(attentionVault)} marcado${attentionVault === 1 ? "" : "s"} para conferir.`,
    entries.length > 0 && routeEntryCount === 0 && "A Agenda ainda depende so do Cofre; gere o roteiro para ver os passeios.",
  ].filter(Boolean) as string[];

  return (
    <div className="agenda-shell">
      <div className="card agenda-hero">
        <div>
          <span className="badge b-ok">linha do tempo</span>
          <h2>Agenda da viagem</h2>
          <p className="sub">
            Roteiro, voos, hospedagens, reservas e documentos datados no mesmo lugar. O objetivo e
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
            <span className="stat-label">Cofre sem horario</span>
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
              <h3>A linha do tempo ainda esta vazia</h3>
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
  const [dayIndex, setDayIndex] = useState(0);

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

  const safeIndex = Math.min(dayIndex, mappable.length - 1);
  const active = mappable[safeIndex];
  const route = suggestRoute(active.points);

  return (
    <div className="map-layout">
      <div className="card map-card">
        <div className="map-head">
          <div>
            <span className="stat-label">
              {mappable.length === days.length
                ? `Dia ${safeIndex + 1} de ${days.length}`
                : `Dia ${safeIndex + 1} de ${mappable.length} com lugares no mapa`}
            </span>
            <h2>{active.day.title || formatVaultDate(`${active.day.day_date}T12:00:00`)}</h2>
          </div>
          <div className="map-nav">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
            >
              Anterior
            </button>
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setDayIndex((i) => Math.min(mappable.length - 1, i + 1))}
              disabled={safeIndex >= mappable.length - 1}
            >
              Proximo
            </button>
          </div>
        </div>

        <TripMap points={route.current} />

        <p className="tiny">
          {active.points.length === 1
            ? "1 lugar no mapa neste dia"
            : `${active.points.length} lugares no mapa · ${formatKm(route.currentKm)} de deslocamento em linha reta`}
        </p>

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

      <div className="card">
        <span className="badge b-ok">ordem do dia</span>
        <h3>Como está hoje</h3>
        <ol className="map-order">
          {route.current.map((point) => (
            <li key={point.id}>
              <strong>{point.title}</strong>
              {point.startTime && <span className="tiny">{point.startTime}</span>}
            </li>
          ))}
        </ol>

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
            A ordem atual já está boa: reorganizar economizaria pouco para o trabalho de remarcar
            tudo.
          </p>
        )}

        <p className="tiny">
          Distâncias em linha reta, não por rua. Servem para perceber travessia desnecessária da
          cidade, não para calcular tempo de trajeto.
        </p>
      </div>
    </div>
  );
}
