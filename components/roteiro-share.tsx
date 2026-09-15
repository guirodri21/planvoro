"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { whatsappShareUrl } from "@/lib/share";

/**
 * Barra de compartilhamento do roteiro publico.
 *
 * O PDF sai pela impressao do proprio navegador, nao por biblioteca: o
 * dialogo de impressao tem "Salvar como PDF" no desktop e no celular, e
 * assim o arquivo acompanha a pagina sem virar um segundo renderizador
 * para manter em sincronia.
 *
 * Quando o aparelho tem compartilhamento nativo (Web Share API), ele e
 * preferido: abre a folha do sistema, com WhatsApp, e-mail e o resto.
 */
export function RoteiroShare({ summary, url }: { summary: string; url: string }) {
  const [copied, setCopied] = useState(false);

  // O workspace manda para ca com ?print=1 quando a pessoa pede o PDF de
  // dentro da viagem: a impressao precisa acontecer nesta pagina, que e a
  // que tem o layout de papel.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("print")) return;

    // Um respiro para o layout assentar antes de o dialogo abrir.
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  async function share() {
    track("roteiro_compartilhado", { canal: "nativo" });

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: summary, url });
        return;
      } catch {
        // Cancelar o menu do sistema cai aqui. Seguir para o WhatsApp
        // seria abrir algo que a pessoa acabou de fechar.
        return;
      }
    }

    window.open(whatsappShareUrl(summary), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("roteiro_compartilhado", { canal: "link" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="roteiro-share no-print">
      <button className="btn ghost sm" type="button" onClick={share}>
        Enviar para o grupo
      </button>
      <button
        className="btn ghost sm"
        type="button"
        onClick={() => {
          track("roteiro_compartilhado", { canal: "pdf" });
          window.print();
        }}
      >
        Salvar em PDF
      </button>
      <button className="btn ghost sm" type="button" onClick={copyLink}>
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
