"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Exclusao de conta (LGPD art. 18, VI).
 *
 * Vivia como um cartao vermelho no rodape do painel, onde ficava a vista
 * de quem so queria olhar as viagens e ficava escondido de quem
 * realmente procurava. Agora sai do menu da conta, junto do resto que e
 * sobre a conta, e abre aqui — em janela propria, porque a confirmacao
 * por digitacao nao cabe num menu de 264px.
 *
 * A confirmacao existe porque a acao e irreversivel e leva junto as
 * viagens que a pessoa organiza para o grupo inteiro.
 */
export function ApagarConta({
  accessToken,
  onFechar,
}: {
  accessToken: string | null;
  onFechar: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    function naTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !apagando) onFechar();
    }
    document.addEventListener("keydown", naTecla);
    return () => document.removeEventListener("keydown", naTecla);
  }, [apagando, onFechar]);

  async function apagar() {
    if (!accessToken || apagando) return;

    setApagando(true);
    setErro("");

    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmacao }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível apagar a conta.");

      // A conta ja nao existe: se o cliente nao subir, a sessao local morre
      // no proximo refresh de token de qualquer forma.
      await supabaseBrowser()?.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao apagar a conta.");
      setApagando(false);
    }
  }

  const podeApagar = confirmacao.trim().toUpperCase() === "APAGAR";

  return (
    <div
      className="modal-fundo"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !apagando) onFechar();
      }}
    >
      <div className="modal modal-perigo" role="dialog" aria-modal="true" aria-label="Apagar minha conta">
        <h2>Apagar minha conta</h2>
        <p className="sub">
          Remove seu cadastro, as viagens que você criou e todos os anexos delas. Viagens em que
          você só participa continuam existindo para o resto do grupo. Não dá para desfazer.
        </p>

        <label className="modal-rotulo" htmlFor="confirmar-apagar">
          Digite <b>APAGAR</b> para confirmar
        </label>
        <input
          id="confirmar-apagar"
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
          placeholder="APAGAR"
          autoComplete="off"
          autoFocus
        />

        {erro && <div className="err">{erro}</div>}

        <div className="modal-acoes">
          <button className="btn ghost" type="button" onClick={onFechar} disabled={apagando}>
            Cancelar
          </button>
          <button
            className="btn btn-perigo"
            type="button"
            onClick={apagar}
            disabled={apagando || !podeApagar}
          >
            {apagando ? "Apagando..." : "Apagar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
