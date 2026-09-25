import type { Day, Trip } from "./types";

/**
 * Roteiro em formato de calendario (.ics), para o Google Agenda, o
 * Calendario do iPhone e o Outlook.
 *
 * Os horarios saem "flutuantes" (sem fuso): 09:30 vira 09:30 no fuso em
 * que o celular estiver. E o certo para roteiro de viagem — o passeio e
 * as 09:30 de Buenos Aires, e quando a pessoa chega la o celular ja esta
 * no fuso de Buenos Aires. Com fuso fixo de Brasilia, uma viagem para
 * Lisboa apareceria tres horas adiantada.
 *
 * Item sem horario vira evento de dia inteiro, para nao inventar hora.
 */

const DURACAO_PADRAO_MIN = 60;

/** Escapa texto como a RFC 5545 pede: barra, ponto e virgula, virgula e quebra de linha. */
function escapar(texto: string) {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Linhas de no maximo 75 bytes, continuadas com espaco (RFC 5545, 3.1). */
function dobrar(linha: string) {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let tamanho = 0;
  for (const caractere of linha) {
    const t = new TextEncoder().encode(caractere).length;
    if (tamanho + t > (partes.length ? 74 : 75)) {
      partes.push(atual);
      atual = "";
      tamanho = 0;
    }
    atual += caractere;
    tamanho += t;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

function dataCompacta(iso: string) {
  return iso.slice(0, 10).replace(/-/g, "");
}

function somarMinutos(data: string, hora: string, minutos: number) {
  const [h, m] = hora.split(":").map(Number);
  const base = new Date(`${data}T00:00:00Z`);
  base.setUTCMinutes(h * 60 + m + minutos);
  const d = base.toISOString();
  return `${d.slice(0, 10).replace(/-/g, "")}T${d.slice(11, 13)}${d.slice(14, 16)}00`;
}

function diaSeguinte(data: string) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dataCompacta(d.toISOString());
}

export function roteiroParaIcs(trip: Pick<Trip, "slug" | "destination">, dias: Day[], origem: string) {
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planvoro//Roteiro//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(`Viagem: ${trip.destination}`)}`,
  ];

  for (const dia of [...dias].sort((a, b) => a.day_date.localeCompare(b.day_date))) {
    const itens = [...dia.itinerary_items].sort((a, b) => a.position - b.position);
    for (const item of itens) {
      const hora = /^\d{2}:\d{2}/.test(item.start_time ?? "") ? (item.start_time as string).slice(0, 5) : null;
      const descricao = [item.description, item.place_query ? `Local: ${item.place_query}` : null, `Planvoro: ${origem}`]
        .filter(Boolean)
        .join("\n");

      linhas.push("BEGIN:VEVENT");
      linhas.push(`UID:${item.id}@planvoro.com.br`);
      linhas.push(`DTSTAMP:${agora}`);
      if (hora) {
        linhas.push(`DTSTART:${somarMinutos(dia.day_date, hora, 0)}`);
        linhas.push(`DTEND:${somarMinutos(dia.day_date, hora, item.duration_min || DURACAO_PADRAO_MIN)}`);
      } else {
        linhas.push(`DTSTART;VALUE=DATE:${dataCompacta(dia.day_date)}`);
        linhas.push(`DTEND;VALUE=DATE:${diaSeguinte(dia.day_date)}`);
      }
      linhas.push(`SUMMARY:${escapar(item.title)}`);
      if (item.place_query) linhas.push(`LOCATION:${escapar(item.place_query)}`);
      linhas.push(`DESCRIPTION:${escapar(descricao)}`);
      linhas.push("END:VEVENT");
    }
  }

  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}
