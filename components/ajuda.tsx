"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { track } from "@/lib/analytics";
import { SUPORTE_MAX, SUPORTE_MIN, whatsappSuporteUrl, type SuporteTipo } from "@/lib/suporte";

/** Evento para abrir a ajuda de qualquer lugar (menu da conta, por exemplo). */
export const ABRIR_AJUDA = "planvoro:abrir-ajuda";

export function abrirAjuda(tipo: SuporteTipo = "ajuda") {
  window.dispatchEvent(new CustomEvent(ABRIR_AJUDA, { detail: tipo }));
}

function paginaAtual() {
  return `${window.location.pathname}${window.location.hash}`.slice(0, 300);
}

/** "celular · Safari iOS 17" basta para reproduzir; o user agent inteiro vai junto, cortado. */
function dispositivoAtual() {
  const ua = navigator.userAgent;
  const tipo = /Mobi|Android|iPhone|iPad/i.test(ua) ? "celular" : "computador";
  return `${tipo} · ${window.innerWidth}×${window.innerHeight} · ${ua}`.slice(0, 200);
}

/**
 * Formulario de ajuda ou sugestao.
 *
 * Logado, o e-mail vem da conta (o servidor ignora o do corpo). Sem conta
 * — na pagina /contato — pede o e-mail, que e para onde a resposta vai.
 */
export function SuporteForm({
  tipoInicial = "ajuda",
  focar = false,
  onEnviado,
}: {
  tipoInicial?: SuporteTipo;
  /** Foco na caixa ao abrir: sim na janela, nao na pagina /contato. */
  focar?: boolean;
  onEnviado?: () => void;
}) {
  const { session, user, loading } = useAuth();
  const token = session?.access_token ?? null;
  const [tipo, setTipo] = useState<SuporteTipo>(tipoInicial);
  const [mensagem, setMensagem] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  useEffect(() => setTipo(tipoInicial), [tipoInicial]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/suporte", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tipo,
          mensagem,
          email: user ? undefined : email,
          pagina: paginaAtual(),
          dispositivo: dispositivoAtual(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não conseguimos enviar agora.");
      track("ajuda_enviada", { tipo, logado: Boolean(user) });
      setEnviado(true);
      onEnviado?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não conseguimos enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="ajuda-ok" role="status">
        <b>{tipo === "sugestao" ? "Obrigado pela sugestão!" : "Mensagem recebida!"}</b>
        <p className="sub">
          {tipo === "sugestao"
            ? "A gente lê tudo que chega e usa para decidir o que construir."
            : `Respondemos no seu e-mail${user?.email ? ` (${user.email})` : ""} em até 2 dias úteis — normalmente bem antes.`}
        </p>
      </div>
    );
  }

  const curta = mensagem.trim().length < SUPORTE_MIN;

  return (
    <form className="ajuda-form" onSubmit={enviar}>
      <div className="ajuda-tipos" role="radiogroup" aria-label="Tipo de mensagem">
        {(
          [
            ["ajuda", "Preciso de ajuda"],
            ["sugestao", "Tenho uma sugestão"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={tipo === valor}
            className={`ajuda-tipo ${tipo === valor ? "on" : ""}`}
            onClick={() => setTipo(valor)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <label className="modal-rotulo" htmlFor="ajuda-mensagem">
        {tipo === "sugestao" ? "O que deixaria o Planvoro melhor para você?" : "O que aconteceu?"}
      </label>
      <textarea
        id="ajuda-mensagem"
        rows={5}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        maxLength={SUPORTE_MAX}
        autoFocus={focar}
        placeholder={
          tipo === "sugestao"
            ? "Ex.: queria poder exportar o roteiro em PDF."
            : "Conte o que tentou fazer e o que apareceu. A página e o aparelho já vão junto."
        }
      />

      {!loading && !user && (
        <>
          <label className="modal-rotulo" htmlFor="ajuda-email">
            Seu e-mail, para a resposta
          </label>
          <input
            id="ajuda-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@exemplo.com"
            autoComplete="email"
            required
          />
        </>
      )}

      {erro && <div className="err">{erro}</div>}

      <button className="btn full" type="submit" disabled={enviando || curta}>
        {enviando ? "Enviando..." : "Enviar"}
      </button>
      <p className="tiny">Não mande senha nem número de cartão — nunca pedimos isso.</p>
    </form>
  );
}

/** Link do WhatsApp do suporte, com a primeira mensagem ja escrita. */
export function WhatsappSuporte({ className = "btn ghost full" }: { className?: string }) {
  const [texto, setTexto] = useState("Oi! Preciso de ajuda com o Planvoro.");
  useEffect(() => {
    const caminho = window.location.pathname;
    if (caminho.startsWith("/v/")) {
      setTexto(`Oi! Preciso de ajuda com uma viagem no Planvoro (${window.location.origin}${caminho}).`);
    }
  }, []);
  return (
    <a
      className={className}
      href={whatsappSuporteUrl(texto)}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("whatsapp_suporte_clicado")}
    >
      Falar no WhatsApp
    </a>
  );
}

/**
 * Botao flutuante "Ajuda", so para quem esta logado: e quem usa o app que
 * precisa pedir ajuda sem sair da tela. Quem so visita a home tem o
 * /contato no rodape.
 */
export function AjudaFlutuante() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<SuporteTipo>("ajuda");

  useEffect(() => {
    function abrir(evento: Event) {
      const detalhe = (evento as CustomEvent<SuporteTipo>).detail;
      setTipo(detalhe === "sugestao" ? "sugestao" : "ajuda");
      setAberto(true);
      track("ajuda_aberta", { origem: "menu" });
    }
    window.addEventListener(ABRIR_AJUDA, abrir);
    return () => window.removeEventListener(ABRIR_AJUDA, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function naTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", naTecla);
    return () => document.removeEventListener("keydown", naTecla);
  }, [aberto]);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className="ajuda-fab"
        aria-label="Ajuda e sugestões"
        onClick={() => {
          setTipo("ajuda");
          setAberto(true);
          track("ajuda_aberta", { origem: "botao" });
        }}
      >
        <span aria-hidden="true">?</span>
        <b>Ajuda</b>
      </button>

      {aberto && (
        <div
          className="modal-fundo"
          role="presentation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setAberto(false);
          }}
        >
          <div className="modal ajuda-modal" role="dialog" aria-modal="true" aria-label="Ajuda e sugestões">
            <button type="button" className="ajuda-fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
              ×
            </button>
            <h2>Fale com a gente</h2>
            <p className="sub">Somos um time pequeno e lemos tudo.</p>
            <SuporteForm tipoInicial={tipo} focar />
            <div className="ajuda-ou">
              <span>ou, se for urgente</span>
            </div>
            <WhatsappSuporte />
          </div>
        </div>
      )}
    </>
  );
}
