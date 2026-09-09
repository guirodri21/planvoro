/**
 * Chamadas do workspace para a propria API.
 *
 * Cabecalho de autenticacao e leitura de resposta ficam num lugar so
 * porque toda aba do workspace faz as mesmas duas coisas, e ter isso
 * espalhado significa corrigir o mesmo tratamento de erro em dez lugares.
 */

import type { Trip } from "@/lib/types";

export function authHeaders(accessToken: string | null) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export function authJsonHeaders(accessToken: string | null) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/**
 * Le a resposta como JSON.
 *
 * O corpo e lido como texto primeiro porque uma rota que estourou o tempo
 * limite devolve HTML, e `res.json()` quebraria com um erro de sintaxe que
 * nao diz nada a quem esta na tela.
 */
export async function readApiJson<T extends { error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "O servidor respondeu em um formato inesperado."
        : "O servidor demorou demais ou retornou uma resposta inesperada. Tente gerar de novo em alguns instantes."
    );
  }
}

export function buildTripInviteMessage(trip: Trip, inviteUrl: string, senderName?: string) {
  const intro = senderName
    ? `${senderName} está organizando a viagem para ${trip.destination} no Planvoro.`
    : `Estou organizando a viagem para ${trip.destination} no Planvoro.`;

  return `${intro}

Entra por esse link para preencher suas preferências, votar nas ideias, ver o roteiro e acompanhar reservas/gastos:
${inviteUrl}`;
}

export function buildPublicRouteMessage(trip: Trip, publicUrl: string) {
  return `Roteiro da viagem para ${trip.destination} no Planvoro:
${publicUrl}`;
}
