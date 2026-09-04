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
  /** E-mail que acabou de se cadastrar e ainda precisa confirmar. */
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState("");
  const [reenvioEm, setReenvioEm] = useState(0);
  /** Enquanto true, esta tela tenta entrar sozinha a cada poucos segundos. */
  const [vigiando, setVigiando] = useState(false);
  /** Senha atual, exigida de quem ja estava logado e nao veio pelo link. */
  const [senhaAtual, setSenhaAtual] = useState("");
  /**
   * Chegou por link de recuperacao, ou ja estava logado?
   *
   * A diferenca decide se pedimos a senha atual. Quem clicou no link do
   * e-mail ja provou que a caixa de entrada e dele. Quem so abriu
   * /redefinir-senha numa aba logada nao provou nada — e sem esta
   * distincao bastava um notebook destrancado para trocar a senha e
   * tomar a conta.
   */
  const [porLink, setPorLink] = useState(false);
  /** O link de recuperacao ainda vale? So faz sentido no modo "reset". */
  const [linkRecuperacao, setLinkRecuperacao] = useState<"checando" | "valido" | "expirado">(
    "checando"
  );

  /**
   * Confirmou no celular, entra no computador.
   *
   * Depois do cadastro esta tela ainda tem e-mail e senha na memoria,
   * entao da para tentar entrar de tempos em tempos. Enquanto o e-mail
   * nao foi confirmado o Supabase recusa; no instante em que a pessoa
   * clica no link — em qualquer aparelho — a tentativa passa e esta aba
   * entra sozinha.
   *
   * O intervalo cresce com o tempo porque o Supabase limita tentativas de
   * login, e insistir de 5 em 5 segundos por dez minutos derruba a
   * proxima tentativa legitima. Depois de dez minutos para de vez: quem
   * demorou tanto provavelmente fechou a aba, e o botao manual continua
   * ali.
   */
  useEffect(() => {
    if (!vigiando || !aguardandoConfirmacao || !password) return;

    let ativo = true;
    let tentativas = 0;

    async function espiar() {
      if (!ativo) return;

      tentativas += 1;
      if (tentativas > 80) {
        setVigiando(false);
        return;
      }

      const client = supabaseBrowser();
      if (client) {
        const { data } = await client.auth.signInWithPassword({
          email: aguardandoConfirmacao,
          password,
        });

        if (data.session && ativo) {
          setVigiando(false);
          router.replace(nextPath);
          router.refresh();
          return;
        }
      }

      // 5s no primeiro minuto, 15s depois: a maioria confirma logo, e
      // quem demora nao precisa de resposta em segundos.
      const espera = tentativas < 12 ? 5000 : 15000;
      if (ativo) window.setTimeout(espiar, espera);
    }

    const inicio = window.setTimeout(espiar, 5000);
    return () => {
      ativo = false;
      window.clearTimeout(inicio);
    };
  }, [aguardandoConfirmacao, nextPath, password, router, vigiando]);

  useEffect(() => {
    if (reenvioEm <= 0) return;
    const timer = window.setTimeout(() => setReenvioEm((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [reenvioEm]);

  /**
   * Link de recuperacao vale, ou ja morreu?
   *
   * Clicar no link cria a sessao antes de chegar aqui, entao "tem sessao"
   * e o sinal de que o link foi aceito. Sem esta checagem o formulario
   * aparece igual para quem chegou com link vencido, e a pessoa so
   * descobre depois de escolher a senha e apertar o botao — perdendo o
   * texto que ela acabou de digitar junto com a tentativa.
   *
   * Espera `loading` terminar porque o cliente ainda esta lendo o token
   * que veio no fragmento da URL; perguntar antes disso responderia
   * "expirado" para todo link valido.
   */
  useEffect(() => {
    if (mode !== "reset") return;

    // O Supabase avisa quando a sessao nasceu de um link de recuperacao.
    const client = supabaseBrowser();
    const inscricao = client?.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setPorLink(true);
    });

    // O evento pode ter disparado antes de este componente montar. O
    // fragmento da URL ainda carrega "type=recovery" nesse instante, e e
    // a segunda forma de reconhecer a mesma chegada.
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setPorLink(true);
    }

    return () => inscricao?.data.subscription.unsubscribe();
  }, [mode]);

  useEffect(() => {
    if (mode !== "reset" || loading) return;
    setLinkRecuperacao(user ? "valido" : "expirado");
  }, [loading, mode, user]);

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

  if (mode === "reset" && linkRecuperacao !== "valido") {
    return (
      <div className="auth-shell">
        <div className="card auth-card">
          <p className="eyebrow">Redefinir senha</p>
          {linkRecuperacao === "checando" ? (
            <>
              <h1>Conferindo seu link</h1>
              <div className="session-loader" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </>
          ) : (
            <>
              <h1 style={{ marginBottom: 8 }}>Esse link não vale mais</h1>
              <p className="sub">
                Links de redefinição expiram depois de um tempo e valem uma vez só. Sua senha
                atual continua funcionando normalmente.
              </p>
              <button
                className="btn full"
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setLinkRecuperacao("valido");
                  setError("");
                  setMessage("");
                }}
              >
                Pedir um link novo
              </button>
              <div className="auth-alt">
                <button type="button" className="linklike" onClick={() => router.replace("/entrar")}>
                  Voltar para a entrada
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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

/**
 * Traduz o que o Supabase devolve.
 *
 * As mensagens vem em ingles e falam da implementacao, nao do que a
 * pessoa deve fazer. "Invalid login credentials" numa tela de login em
 * portugues denuncia que ninguem leu o proprio produto — e nao ajuda a
 * pessoa a entrar.
 */
function traduzErro(bruto: string) {
  const texto = bruto.toLowerCase();

  if (texto.includes("senha atual incorreta")) {
    return "Senha atual incorreta.";
  }
  if (texto.includes("invalid login credentials")) {
    return "E-mail ou senha não conferem. Confira e tente de novo.";
  }
  if (texto.includes("email not confirmed")) {
    return "Falta confirmar seu e-mail. Procure a mensagem que enviamos, inclusive no spam.";
  }
  if (texto.includes("user already registered") || texto.includes("already been registered")) {
    return "Já existe conta com esse e-mail. Entre, ou use \"Esqueci minha senha\".";
  }
  if (texto.includes("email rate limit") || texto.includes("over_email_send_rate_limit")) {
    return "Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.";
  }
  if (texto.includes("for security purposes") || texto.includes("rate limit")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (texto.includes("should be different") || texto.includes("same_password")) {
    return "Essa já é a sua senha atual. Escolha uma diferente.";
  }
  if (
    texto.includes("auth session missing") ||
    texto.includes("token has expired") ||
    texto.includes("invalid or has expired") ||
    texto.includes("otp_expired")
  ) {
    return "Esse link expirou ou já foi usado. Peça um novo para redefinir a senha.";
  }
  if (texto.includes("password should be") || texto.includes("weak password")) {
    return "Essa senha é fraca demais. Use mais caracteres, misturando letras e números.";
  }
  if (texto.includes("unable to validate email") || texto.includes("invalid format")) {
    return "Esse e-mail não parece válido.";
  }
  if (texto.includes("failed to fetch") || texto.includes("networkerror")) {
    return "Não consegui falar com o servidor. Confira sua conexão e tente de novo.";
  }

  return bruto;
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
        // Sem emailRedirectTo, o link de confirmacao joga a pessoa na home
        // e ela perde o caminho que estava seguindo — normalmente um
        // convite para uma viagem especifica.
        const confirmacaoVolta = new URL("/entrar", window.location.origin);
        confirmacaoVolta.searchParams.set("next", nextPath);

        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: confirmacaoVolta.toString(),
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          router.replace(nextPath);
          router.refresh();
        } else {
          // Sem sessao significa que o Supabase exige confirmar o e-mail.
          // Isso merece uma tela, nao um aviso embaixo do formulario: e o
          // ponto onde a pessoa mais desiste, porque nao sabe o que fazer.
          setAguardandoConfirmacao(email);
          setReenvioEm(60);
          setVigiando(true);
        }
      } else if (mode === "forgot") {
        /**
         * Caminho limpo, sem parametro nenhum.
         *
         * O Supabase confere o destino contra a lista de Redirect URLs e,
         * se nao casar, ignora em silencio e manda para o Site URL. Era o
         * que acontecia: o link caia na home, ja logado, sem nunca mostrar
         * a tela de nova senha — e a senha antiga continuava valendo.
         * Query string e justamente o que costuma nao casar.
         */
        const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (resetError) throw resetError;

        setMessage("Enviamos um link para redefinir sua senha. Confira sua caixa de entrada.");
      } else if (mode === "reset") {
        /**
         * Sem link, exige a senha atual.
         *
         * `updateUser` troca a senha de qualquer sessao valida, sem
         * perguntar mais nada. Para quem chegou pelo e-mail isso esta
         * certo — o link ja foi a prova. Para quem apenas tinha a aba
         * aberta, nao: qualquer pessoa que passasse pelo computador
         * trocaria a senha e ficaria com a conta, e o Cofre guarda
         * passaporte e comprovante de reserva.
         *
         * Conferir e reautenticar com a senha antiga; se ela nao valer, o
         * Supabase recusa e nada e alterado.
         */
        if (!porLink) {
          if (!senhaAtual.trim()) throw new Error("Digite sua senha atual para confirmar.");
          if (!user?.email) throw new Error("Não consegui identificar sua conta.");

          const { error: erroAtual } = await client.auth.signInWithPassword({
            email: user.email,
            password: senhaAtual,
          });
          if (erroAtual) throw new Error("Senha atual incorreta.");
        }

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
      setError(e instanceof Error ? traduzErro(e.message) : "Não foi possível autenticar.");
    }

    setSubmitting(false);
  }

  async function reenviarConfirmacao() {
    if (reenvioEm > 0 || submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const client = supabaseBrowser();
      if (!client) throw new Error("Login indisponível agora.");

      const confirmacaoVolta = new URL("/entrar", window.location.origin);
      confirmacaoVolta.searchParams.set("next", nextPath);

      const { error: resendError } = await client.auth.resend({
        type: "signup",
        email: aguardandoConfirmacao,
        options: { emailRedirectTo: confirmacaoVolta.toString() },
      });
      if (resendError) throw resendError;

      setMessage("Enviamos de novo. Pode levar alguns minutos para chegar.");
      setReenvioEm(60);
    } catch (e) {
      setError(e instanceof Error ? traduzErro(e.message) : "Não consegui reenviar agora.");
    } finally {
      setSubmitting(false);
    }
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
      setError(e instanceof Error ? traduzErro(e.message) : "Não foi possível entrar com Google.");
    }
  }

  if (aguardandoConfirmacao) {
    return (
      <div className="auth-shell">
        <div className="card auth-card">
          <p className="eyebrow">Falta um passo</p>
          <h1 style={{ marginBottom: 8 }}>Confirme seu e-mail</h1>
          <p className="sub">
            Enviamos um link para <b>{aguardandoConfirmacao}</b>. Abra a mensagem e clique nele
            para ativar sua conta.
          </p>

          {vigiando && (
            <div className="note aguardando">
              <span className="pulso" aria-hidden="true" />
              <span>
                <b>Pode confirmar pelo celular.</b>
                <br />
                Deixe esta aba aberta: assim que você clicar no link, ela entra sozinha.
              </span>
            </div>
          )}

          <div className="note">
            <b>Não chegou?</b>
            <br />
            Procure na caixa de spam ou promoções — é onde costuma cair. O e-mail pode levar
            alguns minutos.
          </div>

          {error && <div className="err">{error}</div>}
          {message && <div className="note">{message}</div>}

          <button
            className="btn full"
            type="button"
            onClick={reenviarConfirmacao}
            disabled={submitting || reenvioEm > 0}
          >
            {submitting
              ? "Enviando..."
              : reenvioEm > 0
                ? `Reenviar em ${reenvioEm}s`
                : "Reenviar o e-mail"}
          </button>

          <div className="auth-alt">
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setVigiando(false);
                setAguardandoConfirmacao("");
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Errei o e-mail, quero corrigir
            </button>
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setVigiando(false);
                setAguardandoConfirmacao("");
                setMode("signin");
                setError("");
                setMessage("");
              }}
            >
              Já confirmei, quero entrar
            </button>
          </div>
        </div>
      </div>
    );
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
              className="google-auth-btn destaque"
              onClick={signInWithGoogle}
              disabled={submitting || !browserSupabaseReady()}
            >
              <span aria-hidden="true">G</span>
              {submitting ? "Abrindo Google..." : "Continuar com Google"}
            </button>

            {/* Vale dizer o porque: pelo Google nao ha e-mail de
                confirmacao, entao a pessoa entra na hora. E o caminho que
                menos perde gente, e o unico que nao depende do envio de
                e-mail funcionar. */}
            <p className="tiny auth-google-hint">
              Entra na hora, sem confirmar e-mail.
            </p>

            <div className="auth-divider">
              <span>ou use e-mail e senha</span>
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
            {/* Quem nao chegou pelo link do e-mail confirma quem e antes
                de trocar. Ver o comentario em submit(). */}
            {mode === "reset" && !porLink && (
              <>
                <label>Senha atual</label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Sua senha de hoje"
                  autoComplete="current-password"
                />
                <span className="tiny">
                  Você já está logado, então confirmamos que é você antes de trocar. Se esqueceu a
                  senha, saia e use “Esqueci minha senha”.
                </span>
              </>
            )}

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
            (mode === "reset" && !porLink && !senhaAtual.trim()) ||
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
