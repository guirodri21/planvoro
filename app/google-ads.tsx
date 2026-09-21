"use client";

import { useEffect } from "react";
import { initGoogleAds } from "@/lib/google-ads";

/**
 * Sobe o gtag do Google Ads, uma vez.
 *
 * Nao registra pageview a cada rota, diferente do MetaPixel: o gtag ja
 * cuida disso sozinho no `config`, e chamar na mao geraria visita
 * duplicada em toda troca de tela.
 */
export default function GoogleAds() {
  useEffect(() => {
    initGoogleAds();
  }, []);

  return null;
}
