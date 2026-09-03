"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, pageview } from "@/lib/analytics";

/**
 * Sobe o PostHog e registra pageview a cada troca de rota.
 * O App Router nao recarrega a pagina ao navegar, entao o pageview
 * automatico do PostHog perderia tudo depois da primeira tela.
 */
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    // rota generica: /v/abc-123 vira /v/[slug], senao cada viagem
    // viraria uma rota diferente no relatorio e o funil ficaria ilegivel
    const rota = pathname
      .replace(/^\/v\/[^/]+/, "/v/[slug]")
      .replace(/^\/r\/[^/]+/, "/r/[slug]");
    pageview(rota);
  }, [pathname]);

  return null;
}
