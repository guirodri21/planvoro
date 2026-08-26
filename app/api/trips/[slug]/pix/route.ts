import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { memberForUserInTrip } from "@/lib/guards";
import { isLikelyPixKey } from "@/lib/pix";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_PIX_KEY = 140;

/**
 * Chave Pix de quem esta logado, nesta viagem.
 *
 * Cada pessoa so mexe na propria chave — nem o organizador altera a dos
 * outros. Chave de recebimento e dado bancario: quem escreve define para
 * onde o dinheiro do grupo vai.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const raw = String(body.pix_key ?? "").trim();

    if (raw.length > MAX_PIX_KEY) {
      return NextResponse.json({ error: "Chave Pix muito longa." }, { status: 400 });
    }
    if (raw && !isLikelyPixKey(raw)) {
      return NextResponse.json(
        { error: "Isso nao parece uma chave Pix. Use CPF, CNPJ, e-mail, telefone ou chave aleatoria." },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const membership = await memberForUserInTrip(db, slug, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Voce nao participa desta viagem." }, { status: 403 });
    }

    const { data, error } = await db
      .from("members")
      .update({ pix_key: raw || null })
      .eq("id", membership.memberId)
      .select("id, pix_key")
      .single();
    if (error) throw error;

    return NextResponse.json({ member: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar a chave Pix.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
