import { AuthScreen } from "@/components/auth-screen";

export const metadata = {
  title: "Redefinir senha",
};

/**
 * Tela de nova senha, com endereco proprio.
 *
 * A tela em si sempre existiu, dentro de /entrar no modo "reset". O que
 * nao funcionava era chegar ate ela: o link do e-mail apontava para
 * /entrar?mode=reset&next=..., e o Supabase compara o destino pedido com a
 * lista de Redirect URLs — uma entrada exata como "/entrar" nao casa com a
 * mesma URL carregando query string. Recusado o destino, ele cai no Site
 * URL, e a pessoa aterrissava logada na home achando que trocou a senha.
 *
 * Um caminho limpo, sem parametro nenhum, casa com a lista e tira essa
 * classe de erro do caminho.
 */
export default function RedefinirSenhaPage() {
  return <AuthScreen initialMode="reset" nextPath="/app" />;
}
