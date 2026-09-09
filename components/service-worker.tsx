"use client";

import { useEffect } from "react";

/**
 * Registra o service worker.
 *
 * Fica fora do desenvolvimento de proposito: um worker cacheando durante
 * o `next dev` faz o navegador servir codigo velho e cria uma hora de
 * caca a fantasma.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem service worker o app continua inteiro, so perde o offline.
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
