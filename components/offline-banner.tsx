"use client";

import { useEffect, useState } from "react";

/**
 * Aviso de que o aparelho esta sem conexao.
 *
 * Sem isso, quem tenta salvar offline recebe um erro de rede cru e acha
 * que o Planvoro quebrou. Dizer "voce esta sem sinal, o que ja carregou
 * continua aqui" muda completamente a leitura do mesmo momento.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const update = () => setOffline(!navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      Sem conexão. Você continua vendo o que já foi carregado; salvar volta quando o sinal voltar.
    </div>
  );
}
