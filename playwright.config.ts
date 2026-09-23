import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta: abrem o site num navegador de verdade e clicam
 * como uma pessoa.
 *
 * Rodam contra o build de producao (`next start`), sem banco nem chaves:
 * o Supabase aponta para um endereco falso (http://sb.local) e cada teste
 * responde as rotas /api/* com dados fixos (e2e/fixtures.ts). O que se
 * testa aqui e a tela — o que aparece, o que trava, para onde cada botao
 * leva — e nao o servidor.
 *
 * Antes: `NEXT_PUBLIC_SUPABASE_URL=http://sb.local
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build`.
 * Depois: `npm run e2e`.
 */
const PORTA = Number(process.env.E2E_PORT ?? 3100);

// No container da Claude o Chromium ja vem instalado fora do lugar padrao.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
