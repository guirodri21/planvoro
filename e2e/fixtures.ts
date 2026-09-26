import { test as base, expect, type Page, type Route } from "@playwright/test";

/**
 * Dados fixos e sessao falsa para os testes.
 *
 * As datas sao relativas a hoje: com datas fixas, a "proxima viagem" do
 * teste viraria viagem passada daqui a alguns meses e o teste quebraria
 * sem ninguem ter mexido no codigo.
 */

const DIA = 86_400_000;
export function diaISO(deslocamento: number) {
  return new Date(Date.now() + deslocamento * DIA).toISOString().slice(0, 10);
}

const INICIO = diaISO(30);
const SEGUNDO_DIA = diaISO(31);
const FIM = diaISO(34);

const T = "t1";

function item(id: string, n: number, hora: string, titulo: string, custo: number) {
  return {
    id,
    position: n,
    start_time: hora,
    duration_min: 90,
    title: titulo,
    description: "Descrição curta do passeio.",
    category: "Cultura",
    cost_estimate: custo,
    cost_local: null,
    cost_currency: null,
    place_query: titulo,
    verified: true,
    lat: -34.6 + n * 0.01,
    lng: -58.38 + n * 0.01,
    needs_vote: false,
  };
}

export type Viagem = ReturnType<typeof viagem>;

/** Viagem de grupo com roteiro de dois dias. `locked` tranca o Passe. */
export function viagem(opcoes: { locked?: boolean; organizador?: boolean; cofreVazio?: boolean } = {}) {
  const { locked = false, organizador = true, cofreVazio = false } = opcoes;
  return {
    trip: {
      id: T,
      slug: "demo",
      destination: "Buenos Aires",
      start_date: INICIO,
      end_date: FIM,
      party_size: 3,
      budget_band: "Confortável",
      styles: [],
      is_solo: false,
      is_public: true,
    },
    members: [
      { id: "m1", trip_id: T, name: "Guilherme", is_organizer: true, color: "#4ade80" },
      { id: "m2", trip_id: T, name: "Ana", is_organizer: false, color: "#22d3ee" },
      { id: "m3", trip_id: T, name: "Bruno", is_organizer: false, color: "#fbbf24" },
    ],
    preferences: [
      {
        id: "p1",
        member_id: "m1",
        interests: ["Museus"],
        restrictions: [],
        daily_budget: "R$ 300 a R$ 600",
        present_from: INICIO,
        present_to: FIM,
      },
    ],
    itinerary: {
      id: "it1",
      version: 1,
      rationale: "Equilibra cultura e gastronomia.",
      itinerary_days: [
        {
          id: "d1",
          day_date: INICIO,
          title: "Centro e Recoleta",
          note: null,
          position: 0,
          itinerary_items: [
            item("i1", 0, "09:30", "Teatro Colón", 120),
            item("i2", 1, "15:00", "Cemitério da Recoleta", 40),
          ],
        },
        {
          id: "d2",
          day_date: SEGUNDO_DIA,
          title: "San Telmo",
          note: null,
          position: 1,
          itinerary_items: [item("i3", 0, "10:00", "Feira de San Telmo", 0)],
        },
      ],
    },
    votes: [],
    comments: [],
    expenses: [],
    vault_items: cofreVazio
      ? []
      : [
          {
            id: "v1",
            trip_id: T,
            member_id: "m1",
            kind: "flight",
            title: "Voo GRU → EZE",
            provider: "Aerolíneas",
            confirmation_code: "XYZ123",
            starts_at: `${INICIO}T07:00:00-03:00`,
            ends_at: `${INICIO}T10:00:00-03:00`,
            location: "GRU",
            amount: 1800,
            currency: "BRL",
            status: "paid",
            url: null,
            notes: null,
            created_at: "2026-09-20T10:00:00Z",
            updated_at: "2026-09-20T10:00:00Z",
          },
        ],
    vault_attachments: [],
    checklist_items: [],
    ideas: [],
    idea_votes: [],
    viewer_member_id: organizador ? "m1" : "m2",
    trip_access: locked ? { unlocked: false, reason: "locked" } : { unlocked: true, reason: "trip_pass" },
  };
}

function viagemDoPainel(slug: string, destino: string, inicio: string, fim: string, extra: object = {}) {
  return {
    id: slug,
    slug,
    destination: destino,
    start_date: inicio,
    end_date: fim,
    party_size: 3,
    budget_band: "Confortável",
    styles: [],
    is_solo: false,
    is_public: true,
    created_at: "2026-09-01T00:00:00Z",
    view_count: 3,
    members_count: 3,
    preferences_count: 1,
    expenses_total: 0,
    latest_itinerary: { version: 1, created_at: "2026-09-02T00:00:00Z" },
    billing: null,
    viewer_member: { id: "m1", name: "Guilherme", is_organizer: true },
    ...extra,
  };
}

export function painel(opcoes: { vazio?: boolean; podePagar?: boolean } = {}) {
  return {
    trips: opcoes.vazio
      ? []
      : [
          viagemDoPainel("demo", "Buenos Aires", INICIO, FIM),
          viagemDoPainel("lis", "Lisboa", diaISO(120), diaISO(128), { latest_itinerary: null }),
        ],
    account_billing: {
      is_pro_active: false,
      pro_expires_at: null,
      can_checkout: opcoes.podePagar ?? true,
      trial_used: false,
      trial_expires_at: null,
      trial_trip: null,
      subscription: null,
    },
  };
}

const USUARIO = {
  id: "u1",
  aud: "authenticated",
  role: "authenticated",
  email: "teste@example.com",
  user_metadata: { name: "Guilherme" },
  app_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

export function json(route: Route, corpo: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
}

/**
 * Coloca uma sessao no localStorage, do jeito que o supabase-js guarda.
 * A chave vem do host do NEXT_PUBLIC_SUPABASE_URL do build (sb.local).
 */
export async function logar(page: Page) {
  const sessao = {
    access_token: "token-falso",
    refresh_token: "refresh-falso",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: USUARIO,
  };
  await page.addInitScript((s) => {
    localStorage.setItem("sb-sb-auth-token", JSON.stringify(s));
  }, sessao);
  await page.route("http://sb.local/auth/v1/user**", (r) => json(r, USUARIO));
}

/**
 * Isola o navegador da internet: Supabase falso, sem tiles do mapa, sem
 * analytics. Uma rota /api/* que o teste nao respondeu devolve 404 — e
 * assim que um fetch esquecido aparece, em vez de ir para producao.
 */
export const test = base.extend<{ isolar: void }>({
  isolar: [
    async ({ page }, use) => {
      await page.route("http://sb.local/**", (r) => json(r, {}));
      await page.route(/tile\.openstreetmap\.org|posthog|vercel-insights|googleapis/, (r) => r.abort());
      await page.route("**/api/**", (r) => json(r, { error: "Não simulado no teste." }, 404));
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Nenhuma tela pode ficar mais larga que a tela do celular.
 *
 * Comparar scrollWidth com innerWidth nao bastava: quando um elemento tem
 * largura minima maior que a tela, o celular alarga o proprio layout
 * (innerWidth passa de 390 para 404) e corta a sobra — o texto some na
 * borda direita e a conta antiga dava zero. A referencia certa e a area
 * visivel (visualViewport).
 */
export async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => {
    const visivel = window.visualViewport?.width ?? window.innerWidth;
    return Math.max(document.documentElement.scrollWidth, window.innerWidth) - visivel;
  });
  expect(sobra, "a página é mais larga que a tela").toBeLessThanOrEqual(1);
}
