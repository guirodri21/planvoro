import type { Metadata } from "next";

/** A pagina e de cliente e nao pode exportar metadata; o layout faz isso por ela. */
export const metadata: Metadata = {
  title: "Entrar ou criar conta",
  description: "Entre no Planvoro para salvar suas viagens, convidar o grupo e guardar reservas.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
