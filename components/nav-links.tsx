"use client";

import { useAuth } from "./auth-provider";

/**
 * Links do menu.
 *
 * Quem ja entrou nao precisa de "Como funciona", "Roteiro" e "Precos" —
 * esses vendem o produto para quem ainda nao usa. Trocar por atalhos do
 * app deixa a barra mais curta e mais util ao mesmo tempo.
 */
export function NavLinks() {
  const { user, loading } = useAuth();

  // Enquanto carrega, mostra o conjunto de visitante: e o que aparece
  // para quem chega pela primeira vez, e evita o menu piscar trocando de
  // um conjunto para o outro.
  const links =
    !loading && user
      ? [
          { href: "/app", label: "Minhas viagens" },
          { href: "/historico", label: "Histórico" },
          { href: "/#faq", label: "Dúvidas" },
        ]
      : [
          { href: "/#como", label: "Como funciona" },
          { href: "/#roteiro", label: "Roteiro" },
          { href: "/#precos", label: "Preços" },
          { href: "/#faq", label: "Dúvidas" },
        ];

  return (
    <div className="navlinks">
      {links.map((link) => (
        <a key={link.href} href={link.href}>
          {link.label}
        </a>
      ))}
    </div>
  );
}
