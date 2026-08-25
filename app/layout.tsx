import type { Metadata } from "next";
import Image from "next/image";
import { IBM_Plex_Mono, Instrument_Serif, Inter_Tight } from "next/font/google";
import { AuthNav } from "@/components/auth-nav";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro-app.vercel.app";
const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  applicationName: "Planvoro",
  title: {
    default: "Planvoro — planejador de viagem com IA para grupos",
    template: "%s — Planvoro",
  },
  description:
    "Planeje viagens sozinho ou em grupo com IA: roteiro dia a dia, preferências, votação, gastos e convite por link no navegador.",
  keywords: [
    "planejador de viagem",
    "roteiro de viagem com IA",
    "viagem em grupo",
    "organizar viagem",
    "dividir gastos viagem",
  ],
  alternates: {
    canonical: BASE,
  },
  openGraph: {
    title: "Planvoro — planejador de viagem com IA para grupos",
    description:
      "Crie roteiros, convide o grupo, vote nas ideias e organize gastos em um só workspace de viagem.",
    url: BASE,
    siteName: "Planvoro",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Planvoro — planejador de viagem com IA para grupos",
    description:
      "Roteiro com IA, votação, gastos e convite por link para organizar viagens sem bagunça no WhatsApp.",
  },
  formatDetection: {
    telephone: false,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Planvoro",
  applicationCategory: "TravelApplication",
  operatingSystem: "Web",
  url: BASE,
  description:
    "SaaS web brasileiro para planejar viagens sozinho ou em grupo com IA, roteiro, votação, gastos e convite por link.",
  offers: [
    { "@type": "Offer", name: "Beta grátis", price: "0", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Por viagem pós-beta", price: "79", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Pro anual pós-beta", price: "149", priceCurrency: "BRL" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AuthProvider>
          <nav className="topnav">
            <div className="wrap">
              <div className="nv">
                <a className="logo" href="/">
                  <Image src="/logo.png" alt="" width={28} height={28} priority />
                  planvoro
                </a>
                <div className="navlinks">
                  <a href="/#como">Como funciona</a>
                  <a href="/#roteiro">Roteiro</a>
                  <a href="/#precos">Preços</a>
                  <a href="/app">Minhas viagens</a>
                  <a href="/#faq">Dúvidas</a>
                </div>
                <AuthNav />
              </div>
            </div>
          </nav>

          <main className="wrap main">{children}</main>

          <footer className="site-footer">
            <div className="wrap">
              <div className="fpanel">
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
                    <a href="/#precos">Preços</a>
                  </div>
                  <div className="fcol">
                    <h4>Recursos</h4>
                    <a href="/app">Minhas viagens</a>
                    <a href="/#faq">Perguntas frequentes</a>
                    <a href="/nova">Criar viagem</a>
                  </div>
                </div>
                <div className="fbot">
                  <span>© 2026 Planvoro. Feito no Brasil.</span>
                </div>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
