import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { betaAccessEnabled } from "@/lib/beta";
import { isProStatusActive } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Plano da conta, sozinho.
 *
 * O menu de conta precisa de tres campos. Pedi-los ao /api/me/dashboard
 * traria junto todas as viagens, membros e gastos da pessoa — dezenas de
 * kilobytes para escrever "Pro ativo" numa linha, a cada vez que alguem
 * abre o menu.
 */
export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const { data } = await db
      .from("user_subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      beta: betaAccessEnabled,
      is_pro_active: isProStatusActive(data?.status ?? null, data?.current_period_end ?? null),
      expires_at: data?.current_period_end ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao ler o plano." }, { status: 500 });
  }
}
