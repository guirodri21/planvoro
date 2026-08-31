import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { IBM_Plex_Mono, Instrument_Serif, Inter_Tight } from "next/font/google";
import Analytics from "@/app/analytics";
import { AuthNav } from "@/components/auth-nav";
import { NavLinks } from "@/components/nav-links";
import { AuthProvider } from "@/components/auth-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import "leaflet/dist/leaflet.css";
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

/**
 * `viewport-fit: cover` deixa o fundo ir ate a borda em telas com entalhe;
 * o recuo seguro e devolvido no CSS via env(safe-area-inset-*).
 *
 * Sem `maximumScale`: travar o zoom quebra a acessibilidade de quem
 * precisa aumentar o texto.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#101816" },
  ],
};

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
    { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Passe de viagem", price: "29", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Pro anual", price: "79", priceCurrency: "BRL" },
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
          <Analytics />
          <nav className="topnav">
            <div className="wrap">
              <div className="nv">
                <a className="logo" href="/">
                  <Image src="/logo.png" alt="" width={28} height={28} priority />
                  planvoro
                </a>
                <NavLinks />
                <AuthNav />
              </div>
            </div>
          </nav>

          <OfflineBanner />

          <main className="wrap main">{children}</main>

          <ServiceWorkerRegistrar />

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
                      Onde o grupo decide a viagem junto — e guarda tudo depois.
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
                    <a href="/historico">Histórico de viagens</a>
                    <a href="/#faq">Perguntas frequentes</a>
                    <a href="/nova">Criar viagem</a>
                  </div>
                  <div className="fcol">
                    <h4>Legal</h4>
                    <a href="/termos">Termos de uso</a>
                    <a href="/privacidade">Privacidade</a>
                    <a href="/contato">Contato e suporte</a>
                  </div>
                </div>
                <div className="fbot">
                  <span>© 2026 Planvoro. Feito no Brasil.</span>
                  <span className="tiny">
                    Roteiros e respostas são gerados por IA e podem conter erros. Confira preços,
                    horários, vistos e regras oficiais na fonte antes de decidir.
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
