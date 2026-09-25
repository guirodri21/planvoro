"use client";

import { useEffect } from "react";

const JA_ENVIADOS = new Set<string>();
const MAXIMO_POR_PAGINA = 5;

/**
 * Manda para o servidor erro que aconteceu no navegador (e que antes
 * ninguem via). Cada mensagem vai uma vez por carregamento de pagina, e
 * no maximo cinco: um loop de erro nao vira enxurrada de requisicoes.
 */
export function reportarErroNavegador(erro: unknown) {
  if (typeof window === "undefined") return;
  const mensagem = (erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro)).slice(0, 400);
  if (!mensagem || JA_ENVIADOS.has(mensagem) || JA_ENVIADOS.size >= MAXIMO_POR_PAGINA) return;
  JA_ENVIADOS.add(mensagem);

  const corpo = JSON.stringify({ mensagem, pagina: `${location.pathname}${location.hash}` });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/erros-cliente", new Blob([corpo], { type: "application/json" }));
      return;
    }
  } catch {
    // cai no fetch abaixo
  }
  void fetch("/api/erros-cliente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpo,
    keepalive: true,
  }).catch(() => undefined);
}

export function ErrosNavegador() {
  useEffect(() => {
    function aoErro(evento: ErrorEvent) {
      // Erro de script de outro dominio chega sem arquivo e sem detalhe.
      if (!evento.filename || evento.filename.startsWith(location.origin)) {
        reportarErroNavegador(evento.error ?? evento.message);
      }
    }
    function aoRejeitar(evento: PromiseRejectionEvent) {
      reportarErroNavegador(evento.reason);
    }
    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRejeitar);
    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeitar);
    };
  }, []);
  return null;
}
