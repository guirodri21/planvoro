import type { Metadata } from "next";

/** A pagina e de cliente e nao pode exportar metadata; o layout faz isso por ela. */
export const metadata: Metadata = {
  title: "Viagem",
  // Area privada do grupo. O robots.txt ja barra /v/, mas link colado em
  // pagina publica ainda pode ser indexado sem isto.
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
