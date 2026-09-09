/**
 * Mensagens de erro em portugues.
 *
 * Um lugar so para traduzir o que Supabase e AbacatePay devolvem. Funcao
 * pura, sem "use client": serve tanto a tela quanto a rota de API.
 */

/**
 * Traduz o que os servicos de fora devolvem.
 *
 * As mensagens vem em ingles e falam da implementacao, nao do que a
 * pessoa deve fazer. "Invalid login credentials" numa tela de login em
 * portugues denuncia que ninguem leu o proprio produto — e nao ajuda a
 * pessoa a entrar. "CARD is not available for this store", no meio de uma
 * compra, e pior ainda: fala de uma configuracao de loja que o cliente
 * nao tem como resolver.
 *
 * Vivia dentro do componente de login. Saiu de la quando o checkout
 * precisou da mesma coisa no servidor — duas tabelas de traducao em
 * paralelo envelhecem em ritmos diferentes, e a segunda sempre fica para
 * tras.
 */
export function traduzErro(bruto: string) {
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

/**
 * Erros do provedor de pagamento.
 *
 * Separado de `traduzErro` porque a rota precisa decidir tambem o que
 * REGISTRAR: o texto original vai para o log, so a traducao vai para o
 * cliente. Erro de configuracao nossa nao deve descrever a configuracao
 * para quem esta comprando.
 */
export function traduzErroPagamento(bruto: string) {
  const texto = bruto.toLowerCase();

  // Metodo nao liberado na loja. Foi o que derrubou o primeiro checkout
  // de verdade: cartao exige liberacao a parte na AbacatePay.
  if (texto.includes("is not available for this store")) {
    return "Essa forma de pagamento ainda não está disponível. Tente pelo Pix.";
  }
  if (texto.includes("product") && texto.includes("not found")) {
    return "Não consegui montar a cobrança agora. Já estamos sabendo — tente de novo em instantes.";
  }
  if (texto.includes("unauthorized") || texto.includes("invalid api key")) {
    return "O pagamento está indisponível no momento. Tente de novo em alguns minutos.";
  }
  if (texto.includes("rate limit") || texto.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (texto.includes("abacatepay_")) {
    return "O pagamento ainda não está configurado. Já estamos sabendo.";
  }

  // Qualquer outra coisa vira uma frase generica de proposito: mensagem
  // crua de provedor em ingles nao ajuda quem esta comprando, e as vezes
  // conta detalhe de infraestrutura que nao e da conta do cliente.
  return "Não consegui iniciar o pagamento agora. Tente de novo em instantes.";
}
