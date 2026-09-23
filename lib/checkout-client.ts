/**
 * Abre o checkout da AbacatePay a partir do navegador.
 *
 * Mora aqui porque tres telas vendem (painel, /planos e o aviso de viagem
 * trancada) e as tres precisam do mesmo cuidado:
 *
 * A aba abre ainda dentro do clique e recebe o endereco depois.
 * `window.open` chamado depois de um `await` ja nao conta como gesto da
 * pessoa: Safari no iPhone e varios bloqueadores engolem a janela sem
 * avisar. Se mesmo assim ela for bloqueada, o checkout abre na mesma aba.
 */

export type PlanoPago = "trip_pass" | "pro_annual";

export async function abrirCheckout({
  accessToken,
  plan,
  tripSlug,
}: {
  accessToken: string;
  plan: PlanoPago;
  tripSlug?: string;
}): Promise<void> {
  const aba = window.open("", "_blank");
  if (aba) aba.opener = null;

  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ plan, trip_slug: tripSlug }),
    });
    const texto = await res.text().catch(() => "");
    let json: { url?: string; error?: string } = {};
    try {
      json = texto ? JSON.parse(texto) : {};
    } catch {
      json = { error: "O servidor demorou para responder. Tente de novo em instantes." };
    }
    if (!res.ok) throw new Error(json.error ?? "Não foi possível iniciar o pagamento.");

    const url = String(json.url ?? "");
    if (!url) throw new Error("O checkout não devolveu um endereço de pagamento.");

    if (aba && !aba.closed) {
      aba.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (e) {
    aba?.close();
    throw e;
  }
}

export async function comecarTesteGratis(accessToken: string, tripSlug: string) {
  const res = await fetch("/api/billing/trial", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ trip_slug: tripSlug }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Não foi possível começar o teste.");
}
