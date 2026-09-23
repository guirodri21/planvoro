import type { Metadata } from "next";

/** A pagina e de cliente e nao pode exportar metadata; o layout faz isso por ela. */
export const metadata: Metadata = {
  title: "Planos e preços",
  description:
    "Passe de viagem por R$ 29 ou Pro por R$ 79 ao ano, sem mensalidade. Assine antes ou depois de criar a viagem.",
  alternates: { canonical: "/planos" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
