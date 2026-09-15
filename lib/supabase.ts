import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin do Supabase.
 * Usa a service_role key e SO pode ser usado no servidor (rotas de API).
 * Todas as tabelas estao com RLS ligado e sem policies, entao o browser
 * nao consegue ler nem escrever nada direto: tudo passa por aqui.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam as variaveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Veja o .env.example."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
