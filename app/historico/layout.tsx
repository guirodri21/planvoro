import type { Metadata } from "next";

/** A pagina e de cliente e nao pode exportar metadata; o layout faz isso por ela. */
export const metadata: Metadata = {
  title: "Histórico de viagens",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
