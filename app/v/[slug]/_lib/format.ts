/**
 * Formatacao de tela do workspace da viagem.
 *
 * Tudo aqui e funcao pura: entra dado, sai texto. Ficava misturado no
 * page.tsx, que passou de cinco mil linhas — e num arquivo desse tamanho
 * a busca por um nome de funcao devolve dezenas de resultados, o que ja
 * causou substituicao no componente errado mais de uma vez.
 */

import type { Trip } from "@/lib/types";
import {
  TRIP_CHECKLIST_CATEGORIES,
  TRIP_CHECKLIST_STATUSES,
  TRIP_VAULT_KINDS,
  TRIP_VAULT_STATUSES,
  type TripChecklistCategory,
  type TripChecklistStatus,
  type TripVaultItem,
  type TripVaultKind,
  type TripVaultStatus,
} from "@/lib/types";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const expenseDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const vaultDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const agendaDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});

const agendaTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatScore(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function formatExpenseDate(value: string) {
  return expenseDateFormatter.format(new Date(value));
}

export function formatVaultDate(value: string | null) {
  if (!value) return "sem data";
  return vaultDateFormatter.format(new Date(value));
}

export function formatVaultRange(item: TripVaultItem) {
  if (!item.starts_at && !item.ends_at) return "sem data";
  if (!item.ends_at) return formatVaultDate(item.starts_at);
  if (!item.starts_at) return `até ${formatVaultDate(item.ends_at)}`;
  return `${formatVaultDate(item.starts_at)} → ${formatVaultDate(item.ends_at)}`;
}

/** "2026-08-21" vira "21/08/2026". O formato ISO cru na tela e ruido. */
export function formatTripDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

/** "2026-11-12T22:40" — sem Z e sem deslocamento de fuso. */
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/**
 * Valor para um input datetime-local.
 *
 * Item vindo do banco e um instante com fuso e precisa ser convertido para
 * o relogio de quem olha. Rascunho vindo da importacao ja e hora de parede
 * copiada da confirmacao — converter de novo tiraria as horas do fuso e
 * mostraria um embarque que nunca existiu.
 */
export function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  if (NAIVE_DATETIME.test(value)) return value.slice(0, 16);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function vaultKindLabel(kind: TripVaultKind) {
  return TRIP_VAULT_KINDS.find((item) => item.value === kind)?.label ?? "Outro";
}

export function vaultStatusLabel(status: TripVaultStatus) {
  return TRIP_VAULT_STATUSES.find((item) => item.value === status)?.label ?? "Salvo";
}

export function checklistCategoryLabel(category: TripChecklistCategory) {
  return TRIP_CHECKLIST_CATEGORIES.find((item) => item.value === category)?.label ?? "Planejamento";
}

export function checklistStatusLabel(status: TripChecklistStatus) {
  return TRIP_CHECKLIST_STATUSES.find((item) => item.value === status)?.label ?? "Pendente";
}

export function formatDueDate(value: string | null) {
  if (!value) return "sem prazo";
  return expenseDateFormatter.format(new Date(`${value}T00:00:00`));
}

export function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return dateKeyFromDate(date);
}

export function formatAgendaDay(dateKey: string) {
  return agendaDayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

export function formatAgendaTime(value: string | null) {
  if (!value) return "sem horário";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return agendaTimeFormatter.format(date);
}

export function isOutsideTripDates(item: TripVaultItem, trip: Trip) {
  if (!item.starts_at && !item.ends_at) return false;

  const tripStart = new Date(`${trip.start_date}T00:00:00`);
  const tripEnd = new Date(`${trip.end_date}T23:59:59`);
  const itemDates = [item.starts_at, item.ends_at]
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));

  return itemDates.some((date) => date < tripStart || date > tripEnd);
}
