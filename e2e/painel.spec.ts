import { expect, json, logar, painel, semRolagemLateral, test } from "./fixtures";

/** "Minhas viagens" e a pagina de planos, logado. */

test.beforeEach(async ({ page }) => {
  await logar(page);
});

test("painel lista as viagens e destaca a próxima", async ({ page }) => {
  await page.route("**/api/me/dashboard", (r) => json(r, painel()));
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "Minhas viagens" })).toBeVisible();
  const proxima = page.getByRole("region", { name: "Próxima viagem" });
  await expect(proxima).toContainText("Buenos Aires");
  await expect(page.getByText("Lisboa").first()).toBeVisible();
  await expect(page.locator('a[href="/v/demo"]').first()).toBeAttached();
  await semRolagemLateral(page);
});

test("painel vazio convida a criar a primeira viagem", async ({ page }) => {
  await page.route("**/api/me/dashboard", (r) => json(r, painel({ vazio: true })));
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vamos montar a primeira?");
  await expect(page.getByRole("link", { name: "Criar primeira viagem" })).toHaveAttribute("href", "/nova");
});

test("painel mostra o erro quando o servidor falha", async ({ page }) => {
  await page.route("**/api/me/dashboard", (r) => json(r, { error: "Banco fora do ar." }, 500));
  await page.goto("/app");
  await expect(page.getByText("Banco fora do ar.")).toBeVisible();
});

test("planos: o Passe abre o checkout da viagem escolhida", async ({ page, context }) => {
  await page.route("**/api/me/dashboard", (r) => json(r, painel()));
  // A aba do pagamento nao pode sair para a internet.
  await context.route("https://pagamento.exemplo/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<p>checkout</p>" })
  );
  await page.route("**/api/billing/checkout", (r) => json(r, { url: "https://pagamento.exemplo/abc" }));

  await page.goto("/planos?viagem=lis");
  const seletor = page.getByLabel("Viagem que vai ser liberada");
  await expect(seletor).toHaveValue("lis");

  const [pedido] = await Promise.all([
    page.waitForRequest("**/api/billing/checkout"),
    page.getByRole("button", { name: "Liberar por R$ 29" }).click(),
  ]);
  expect(pedido.postDataJSON()).toEqual({ plan: "trip_pass", trip_slug: "lis" });
  expect(pedido.headers()["authorization"]).toBe("Bearer token-falso");
  await expect(page.getByText(/O pagamento abriu em outra aba/)).toBeVisible();
});

test("planos: erro do checkout aparece para a pessoa", async ({ page }) => {
  await page.route("**/api/me/dashboard", (r) => json(r, painel()));
  await page.route("**/api/billing/checkout", (r) => json(r, { error: "Pagamento indisponível." }, 503));
  await page.goto("/planos");
  await page.getByRole("button", { name: "Assinar por R$ 79/ano" }).click();
  await expect(page.getByText("Pagamento indisponível.")).toBeVisible();
});
