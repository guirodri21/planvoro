"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BILLING_COPY, eventIdDaCompra } from "@/lib/billing";
import { initMetaPixel, metaPageview, metaTrack, META_PIXEL_ID } from "@/lib/meta-pixel";

/**
 * Purchase de quem volta do checkout pago (?billing=success&pedido=...).
 *
 * O servidor manda o mesmo evento quando a AbacatePay confirma o
 * pagamento (lib/billing-grant.ts), com o mesmo id: a Meta conta um.
 * Recarregar a pagina nao repete — o id do pedido fica marcado.
 */
function compraDeVolta() {
  const q = new URLSearchParams(window.location.search);
  const pedido = q.get("pedido");
  const plano = q.get("plano");
  if (q.get("billing") !== "success" || !pedido || !/^[a-zA-Z0-9-]{8,64}$/.test(pedido)) return;
  if (plano !== "trip_pass" && plano !== "pro_annual") return;

  const chave = `pv_compra_meta:${pedido}`;
  try {
    if (window.localStorage.getItem(chave)) return;
    window.localStorage.setItem(chave, "1");
  } catch {
    // Sem localStorage: manda assim mesmo; o id repetido a Meta descarta.
  }
  metaTrack("Purchase", { value: BILLING_COPY[plano].amount / 100, currency: "BRL" }, eventIdDaCompra(pedido));
}

/** Sobe o Pixel e registra pageview a cada troca de rota. */
export default function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    initMetaPixel();
    if (META_PIXEL_ID) compraDeVolta();
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID || !pathname) return;
    metaPageview();
  }, [pathname]);

  return null;
}
