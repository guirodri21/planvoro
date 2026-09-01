"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabaseReady, supabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "./auth-provider";

/** Espelha o minimo configurado no Supabase. Mudar la exige mudar aqui. */
const SENHA_MINIMA = 10;

export type AuthMode = "signin" | "signup" | "forgot" | "reset";

export function AuthScreen({
  initialMode,
  nextPath,
}: {
  initialMode: AuthMode;
  nextPath: string;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && mode !== "reset") {
      router.replace(nextPath);
      router.refresh();
    }
  }, [loading, mode, nextPath, router, user]);

  const titleByMode: Record<AuthMode, string> = {
    signin: "Entre na sua conta",
    signup: "Crie sua conta",
    forgot: "Recupere sua senha",
    reset: "Crie uma nova senha",
  };

  const descriptionByMode: Record<AuthMode, string> = {
    signin: "Entre para continuar a viagem, votar no roteiro e registrar gastos.",
    signup: "Isso conecta você às viagens, preferências, votos e gastos do grupo.",
    forgot: "Informe seu e-mail e enviaremos um link seguro para redefinir sua senha.",
    reset: "Escolha uma nova senha para voltar ao seu dashboard do Planvoro.",
  };

  if (mode !== "reset" && (loading || user)) {
    return (
      <div className="auth-shell">
        <div className="card auth-card auth-resume-card">
          <p className="eyebrow">Sessão Planvoro</p>
          <h1>{user ? "Entrando automaticamente" : "Verificando sua sessão"}</h1>
          <p className="sub">
            Se você já entrou neste navegador, o Planvoro mantém sua conta conectada e te leva para
            sua área sem pedir login de novo.
          </p>
          <div className="session-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="tiny auth-hint">
            Para sair de verdade, use o botão "Sair da conta" no menu.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Exigencia de senha.
   *
   * Precisa espelhar o que estiver configurado em Authentication →
   * Providers → Email no Supabase. Sem isso a pessoa so descobre a regra
   * depois de enviar, e o erro vem em ingles direto do Supabase.
   *
   * A checagem contra senha vazada, que seria a defesa mais forte, e paga
   * no Supabase. Tamanho e variedade sao o que da para exigir de graca.
   */
  function problemaNaSenha(valor: string) {
    if (valor.length < SENHA_MINIMA) {
      return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
    }
    if (!/[a-zA-Z]/.test(valor) || !/[0-9]/.test(valor)) {
      return "A senha precisa misturar letras e números.";
    }
    return null;
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup" || mode === "reset") {
        const problema = problemaNaSenha(password);
        if (problema) throw new Error(problema);
      }

      const client = supabaseBrowser();
      if (!client) {
        throw new Error(
          "Falta configurar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
        );
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          router.replace(nextPath);
          router.refresh();
        } else {
          setMessage(
            "Conta criada. Se a confirmação por e-mail estiver ligada no Supabase, confirme seu e-mail e depois entre."
          );
        }
      } else if (mode === "forgot") {
        const redirectTo = new URL("/entrar", window.location.origin);
        redirectTo.searchParams.set("mode", "reset");
        redirectTo.searchParams.set("next", nextPath);

        const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo.toString(),
        });
        if (resetError) throw resetError;

        setMessage("Enviamos um link para redefinir sua senha. Confira sua caixa de entrada.");
      } else if (mode === "reset") {
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;

        setMessage("Senha atualizada. Vamos te levar de volta ao Planvoro.");
        window.setTimeout(() => {
          router.replace(nextPath);
          router.refresh();
        }, 700);
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        router.replace(nextPath);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível autenticar.");
    }

    setSubmitting(false);
  }

  async function signInWithGoogle() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const client = supabaseBrowser();
      if (!client) {
        throw new Error(
          "Falta configurar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
        );
      }

      const redirectTo = new URL("/entrar", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);

      const { error: googleError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (googleError) throw googleError;
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Não foi possível entrar com Google.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <p className="eyebrow">Conta Planvoro</p>
        <h1 style={{ marginBottom: 8 }}>{titleByMode[mode]}</h1>
        <p className="sub">{descriptionByMode[mode]}</p>

        {mode !== "forgot" && mode !== "reset" && (
          <>
            <div className="auth-switch">
              <button
                type="button"
                className={`tab-btn ${mode === "signin" ? "on" : ""}`}
                onClick={() => setMode("signin")}
              >
                <span>Entrar</span>
                <small>Já tenho conta</small>
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === "signup" ? "on" : ""}`}
                onClick={() => setMode("signup")}
              >
                <span>Criar conta</span>
                <small>Primeiro acesso</small>
              </button>
            </div>

            <button
              type="button"
              className="google-auth-btn"
              onClick={signInWithGoogle}
              disabled={submitting || !browserSupabaseReady()}
            >
              <span aria-hidden="true">G</span>
              {submitting ? "Abrindo Google..." : "Continuar com Google"}
            </button>

            <div className="auth-divider">
              <span>ou entre com e-mail</span>
            </div>
          </>
        )}

        {mode === "signup" && (
          <>
            <label>Seu nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guilherme"
            />
          </>
        )}

        {mode !== "reset" && (
          <>
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </>
        )}

        {mode !== "forgot" && (
          <>
            <label>{mode === "reset" ? "Nova senha" : "Senha"}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "reset" ? "Sua nova senha" : "Sua senha"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode !== "signin" && (
              <span className="tiny">
                Pelo menos {SENHA_MINIMA} caracteres, misturando letras e números.
              </span>
            )}
          </>
        )}

        {error && <div className="err">{error}</div>}
        {message && <div className="note">{message}</div>}

        {!browserSupabaseReady() && (
          <div className="err">
            Falta configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
            para ativar o login.
          </div>
        )}

        <button
          className="btn full"
          onClick={submit}
          disabled={
            submitting ||
            !browserSupabaseReady() ||
            (mode !== "reset" && !email.trim()) ||
            (mode !== "forgot" && !password.trim()) ||
            (mode === "signup" && !name.trim())
          }
        >
          {submitting
            ? mode === "signup"
              ? "Criando conta..."
              : mode === "forgot"
                ? "Enviando link..."
                : mode === "reset"
                  ? "Atualizando senha..."
                  : "Entrando..."
            : mode === "signup"
              ? "Criar conta"
              : mode === "forgot"
                ? "Enviar link de recuperação"
                : mode === "reset"
                  ? "Atualizar senha"
                  : "Entrar"}
        </button>

        {mode === "signin" && (
          <button type="button" className="auth-text-btn" onClick={() => setMode("forgot")}>
            Esqueci minha senha
          </button>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <button type="button" className="auth-text-btn" onClick={() => setMode("signin")}>
            Voltar para entrar
          </button>
        )}

        <p className="tiny auth-hint">
          Depois do login, o Planvoro mantém sua sessão neste navegador. Se você fechar e voltar
          depois, entra automaticamente na mesma conta.
        </p>
      </div>
    </div>
  );
}
