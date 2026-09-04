"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { userDisplayName } from "@/lib/user-name";

/**
 * Menu da conta.
 *
 * "Oi, Guilherme" era so um rotulo, e o "Sair" ficava solto ao lado —
 * ocupando espaco no topo para uma acao que quase ninguem usa. Pior:
 * quem tem mais de uma conta (a de teste e a de verdade) nao tinha como
 * saber em qual estava, porque so o primeiro nome aparecia.
 *
 * Agora o nome vira o gatilho, o e-mail aparece logo abaixo dele, e as
 * acoes raras ficam guardadas.
 */

type Plano = {
  beta: boolean;
  is_pro_active: boolean;
  expires_at: string | null;
};

export function ContaMenu({
  user,
  accessToken,
  onSignOut,
}: {
  user: User;
  accessToken: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [avisoSenha, setAvisoSenha] = useState("");
  const [enviandoSenha, setEnviandoSenha] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const nomeCompleto = userDisplayName(user);
  const primeiroNome = nomeCompleto.trim().split(/\s+/)[0];
  const inicial = primeiroNome.charAt(0).toUpperCase();

  // Fecha ao clicar fora e no Esc. Sem isso o menu fica aberto atras da
  // proxima tela e a pessoa clica em "Sair" sem querer.
  useEffect(() => {
    if (!aberto) return;

    function noDocumento(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    }
    function naTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", naTecla);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", naTecla);
    };
  }, [aberto]);

  // Busca uma vez, na primeira abertura: o plano nao muda enquanto a
  // pessoa navega, e pedir a cada clique seria chamada a toa.
  useEffect(() => {
    if (!aberto || plano || !accessToken) return;

    let vivo = true;
    fetch("/api/me/plan", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (vivo && json) setPlano(json as Plano);
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [aberto, accessToken, plano]);

  /**
   * Troca de senha por e-mail, e nao por formulario aqui dentro.
   *
   * Trocar a senha direto de uma sessao aberta deixaria qualquer pessoa
   * com acesso ao computador destrancado assumir a conta — e o Cofre
   * guarda passaporte e comprovante de reserva. O link no e-mail exige
   * provar que a caixa de entrada e sua, que e a barra normal para isso.
   */
  async function trocarSenha() {
    const email = user.email;
    if (!email || enviandoSenha) return;

    setEnviandoSenha(true);
    setAvisoSenha("");

    const client = supabaseBrowser();
    if (!client) {
      setAvisoSenha("Não consegui agora. Tente de novo.");
      setEnviandoSenha(false);
      return;
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setAvisoSenha(
      error ? "Não consegui enviar agora. Tente de novo." : "Link enviado para o seu e-mail."
    );
    setEnviandoSenha(false);
  }

  const planoRotulo = !plano
    ? "Carregando..."
    : plano.beta
      ? "Beta grátis"
      : plano.is_pro_active
        ? "Planvoro Pro"
        : "Grátis";

  const planoDetalhe = !plano
    ? ""
    : plano.beta
      ? "Tudo liberado, sem cobrança"
      : plano.is_pro_active && plano.expires_at
        ? `Vale até ${new Date(plano.expires_at).toLocaleDateString("pt-BR")}`
        : plano.is_pro_active
          ? "Ativo"
          : "Uma viagem ativa por vez";

  return (
    <div className="conta" ref={caixa}>
      <button
        type="button"
        className={`conta-gatilho ${aberto ? "on" : ""}`}
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        <span className="conta-inicial" aria-hidden="true">
          {inicial}
        </span>
        <span className="conta-nome">{primeiroNome}</span>
        <svg className="conta-seta" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {aberto && (
        <div className="conta-menu" role="menu">
          <div className="conta-quem">
            <b>{nomeCompleto}</b>
            {/* O e-mail responde "em qual conta eu estou", que era a
                pergunta que o primeiro nome sozinho nao respondia. */}
            <small title={user.email ?? ""}>{user.email}</small>
          </div>

          <div className="conta-plano">
            <span className="conta-plano-nome">{planoRotulo}</span>
            {planoDetalhe && <span className="conta-plano-detalhe">{planoDetalhe}</span>}
          </div>

          <div className="conta-acoes">
            <a href="/app" role="menuitem" onClick={() => setAberto(false)}>
              Minhas viagens
            </a>
            <a href="/historico" role="menuitem" onClick={() => setAberto(false)}>
              Histórico
            </a>
            <button type="button" role="menuitem" onClick={trocarSenha} disabled={enviandoSenha}>
              {enviandoSenha ? "Enviando..." : "Trocar senha"}
            </button>
          </div>

          {avisoSenha && <p className="conta-aviso">{avisoSenha}</p>}

          <div className="conta-acoes conta-sair">
            <button type="button" role="menuitem" onClick={() => onSignOut()}>
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
