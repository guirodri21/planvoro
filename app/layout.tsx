import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "Planvoro — roteiro de viagem por IA, sozinho ou em grupo",
    template: "%s — Planvoro",
  },
  description:
    "A IA monta seu roteiro dia a dia e confere se cada lugar existe mesmo. Viajando em grupo, ela equilibra as preferencias de todo mundo.",
  openGraph: {
    siteName: "Planvoro",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav className="topnav">
          <div className="wrap navinner">
            <a className="logo" href="/">
              <Image src="/logo.png" alt="" width={26} height={26} priority />
              planvoro
            </a>
            <div className="navlinks">
              <a href="/#como">Como funciona</a>
              <a href="/#roteiro">Roteiro</a>
              <a href="/#precos">Precos</a>
              <a href="/#faq">Duvidas</a>
            </div>
            <a href="/nova" className="btn sm">
              Criar viagem
            </a>
          </div>
        </nav>

        <main className="wrap main">{children}</main>

        <footer className="site-footer">
          <div className="wrap">
            <div className="fgrid">
              <div>
                <a className="logo" href="/">
                  <Image src="/logo.png" alt="" width={24} height={24} />
                  planvoro
                </a>
                <p className="small" style={{ maxWidth: "32ch", marginTop: 10 }}>
                  Roteiro de viagem por IA. Sozinho ou com o grupo inteiro.
                </p>
              </div>
              <div className="fcol">
                <h4>Produto</h4>
                <a href="/#como">Como funciona</a>
                <a href="/#roteiro">Roteiro por IA</a>
                <a href="/#precos">Precos</a>
              </div>
              <div className="fcol">
                <h4>Recursos</h4>
                <a href="/#faq">Perguntas frequentes</a>
                <a href="/nova">Criar viagem</a>
              </div>
            </div>
            <div className="fbot">
              <span>© 2026 Planvoro. Feito no Brasil.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
