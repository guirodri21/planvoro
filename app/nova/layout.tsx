import type { Metadata } from "next";

/** A pagina e de cliente e nao pode exportar metadata; o layout faz isso por ela. */
export const metadata: Metadata = {
  title: "Criar viagem",
  description:
    "Crie sua viagem sozinho ou em grupo e gere o roteiro dia a dia com IA. Grátis.",
  alternates: { canonical: "/nova" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
