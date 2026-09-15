import { NextResponse } from "next/server";
import { checkTripCreation } from "@/lib/ai-limits";
import { getUserFromRequest } from "@/lib/auth";
import { betaAccessEnabled } from "@/lib/beta";
import { isProStatusActive, isTripEntitlementActive } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Plano da conta, sozinho.
 *
 * O menu de conta precisa de poucos campos. Pedi-los ao /api/me/dashboard
 * traria junto todas as viagens, membros e gastos da pessoa — dezenas de
 * kilobytes para escrever uma linha.
 *
 * Olha as duas fontes de acesso pago, e nao so a assinatura. A versao
 * anterior lia apenas `user_subscriptions`: quem comprou o Passe de uma
 * viagem via "Grátis" no proprio menu, depois de pagar R$ 29. Cliente que
 * paga e o produto diz que ele nao pagou abre chamado de suporte e pede
 * reembolso — e tem razao.
 */
export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const [assinatura, direitos, impedimento] = await Promise.all([
      db
        .from("user_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("trip_entitlements")
        .select("status, access_expires_at")
        .eq("purchaser_user_id", user.id)
        .in("status", ["paid", "trial"]),
      /**
       * O limite de viagens, antes de a pessoa preencher sete passos.
       *
       * Ele so era conferido no POST /api/trips, que e a ultima acao do
       * assistente. Quem ja tinha viagem aberta escolhia destino, datas,
       * grupo, orcamento, interesses, ritmo e resumo — e so entao ouvia
       * que nao podia criar. A regra e a mesma; o que muda e a hora de
       * dizer.
       */
      checkTripCreation(db, user.id),
    ]);

    const linhas = direitos.data ?? [];

    const passes = linhas.filter(
      (linha) =>
        linha.status === "paid" &&
        isTripEntitlementActive(linha.status as string, linha.access_expires_at as string | null)
    );

    const teste = linhas.find(
      (linha) =>
        linha.status === "trial" &&
        linha.access_expires_at &&
        new Date(linha.access_expires_at as string).getTime() > Date.now()
    );

    return NextResponse.json({
      beta: betaAccessEnabled,
      is_pro_active: isProStatusActive(
        assinatura.data?.status ?? null,
        assinatura.data?.current_period_end ?? null
      ),
      expires_at: assinatura.data?.current_period_end ?? null,
      passes_ativos: passes.length,
      teste_expira_em: (teste?.access_expires_at as string | null) ?? null,
      pode_criar_viagem: !impedimento,
      motivo_bloqueio: impedimento,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao ler o plano." }, { status: 500 });
  }
}
