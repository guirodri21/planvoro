"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { track } from "@/lib/analytics";

/**
 * Duplicar uma viagem para a propria conta.
 *
 * O ponto de entrada mais valioso e o roteiro publico: alguem chega por
 * um link compartilhado, gosta e leva para si. Por isso o botao nao exige
 * conta antes do clique — quem nao esta logado vai para o login com
 * `next` apontando de volta, em vez de tomar um "faca login" e desistir.
 */
export function DuplicateTrip({ slug, label = "Usar este roteiro" }: { slug: string; label?: string }) {
  const { session } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function duplicate() {
    if (working) return;

    const token = session?.access_token;
    if (!token) {
      const next = encodeURIComponent(`/r/${slug}`);
      window.location.href = `/entrar?next=${next}`;
      return;
    }

    setWorking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/duplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) track("limite_atingido", { acao: "duplicar_viagem" });
        throw new Error(json.error ?? "Não foi possível duplicar a viagem.");
      }

      track("viagem_duplicada", { dias: json.copied_days ?? 0 });
      window.location.href = `/v/${json.slug}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao duplicar a viagem.");
      setWorking(false);
    }
  }

  return (
    <div className="duplicate-trip no-print">
      <button className="btn" type="button" onClick={duplicate} disabled={working}>
        {working ? "Copiando..." : label}
      </button>
      <span className="tiny">
        Cria uma cópia sua, editável. Reservas e gastos do original não vêm junto.
      </span>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
