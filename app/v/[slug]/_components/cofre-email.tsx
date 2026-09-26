"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Endereco do Cofre para encaminhar e-mails de reserva. O caminho mais
 * curto entre a confirmacao da companhia aerea e o Cofre: encaminhar,
 * em vez de abrir o app, copiar e colar.
 */
export function CofreEmail({ endereco }: { endereco: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      track("cofre_email_copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissao de copiar: o endereco continua selecionavel na tela.
    }
  }

  return (
    <div className="cofre-email card">
      <div>
        <b>Encaminhe a confirmação da reserva para cá</b>
        <p className="tiny">
          Voo, hotel, ingresso: encaminhe o e-mail (com o PDF, se tiver) e ele vira um item do Cofre
          em segundos. Só funciona a partir do e-mail da sua conta no Planvoro.
        </p>
        <code className="cofre-email-endereco">{endereco}</code>
      </div>
      <button className="btn ghost" type="button" onClick={copiar}>
        {copiado ? "Copiado ✓" : "Copiar endereço"}
      </button>
    </div>
  );
}
