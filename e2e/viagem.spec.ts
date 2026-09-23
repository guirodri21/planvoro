import { expect, json, logar, semRolagemLateral, test, viagem } from "./fixtures";

/** Workspace da viagem: abas, roteiro, edicao e o Passe trancado. */

test.beforeEach(async ({ page }) => {
  await logar(page);
});

function aba(page: import("@playwright/test").Page, nome: string) {
  return page.getByRole("navigation", { name: "Seções da viagem" }).getByRole("button", { name: nome });
}

test("roteiro abre com os dias e a aba fica no endereço", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.goto("/v/demo#roteiro");

  await expect(page.getByText("Centro e Recoleta").first()).toBeVisible();
  await expect(page.getByText("Teatro Colón").first()).toBeVisible();
  await expect(aba(page, "Roteiro")).toHaveAttribute("aria-current", "page");
  await semRolagemLateral(page);
});

test("trocar de aba muda o hash, e recarregar mantém a aba", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.goto("/v/demo#roteiro");
  await expect(page.getByText("Teatro Colón").first()).toBeVisible();

  await aba(page, "Cofre").click();
  await expect(page).toHaveURL(/#cofre$/);
  await expect(page.getByText("Voo GRU → EZE").first()).toBeVisible();

  await page.reload();
  await expect(aba(page, "Cofre")).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Voo GRU → EZE").first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#roteiro$/);
});

test("viagem que não existe mostra erro, sem tela branca", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, { error: "Viagem não encontrada." }, 404));
  await page.goto("/v/demo");
  await expect(page.getByText("Viagem não encontrada.").first()).toBeVisible();
});

test("organizador adiciona um item ao dia", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.route("**/api/trips/demo/days/d1/items", (r) => json(r, { ok: true }));
  await page.goto("/v/demo#roteiro");

  await page.getByRole("button", { name: "+ Adicionar item neste dia" }).first().click();
  const form = page.locator(".item-form");
  const adicionar = form.getByRole("button", { name: "Adicionar ao dia" });
  // Titulo curto demais nao salva.
  await expect(adicionar).toBeDisabled();
  await form.getByPlaceholder("Jantar no restaurante X").fill("Café Tortoni");

  const [pedido] = await Promise.all([
    page.waitForRequest((req) => req.url().endsWith("/api/trips/demo/days/d1/items") && req.method() === "POST"),
    adicionar.click(),
  ]);
  expect(pedido.postDataJSON()).toMatchObject({ title: "Café Tortoni" });
});

test("organizador edita um item e vê o erro do servidor", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.route("**/api/trips/demo/items/i1", (r) => json(r, { error: "Horário inválido." }, 400));
  await page.goto("/v/demo#roteiro");

  await page.getByRole("button", { name: "editar" }).first().click();
  const form = page.locator(".item-form");
  await form.getByPlaceholder("Jantar no restaurante X").fill("Teatro Colón — visita guiada");

  const [pedido] = await Promise.all([
    page.waitForRequest((req) => req.url().endsWith("/api/trips/demo/items/i1") && req.method() === "PATCH"),
    form.getByRole("button", { name: "Salvar" }).click(),
  ]);
  expect(pedido.postDataJSON()).toMatchObject({ title: "Teatro Colón — visita guiada" });
  await expect(form.getByText("Horário inválido.")).toBeVisible();
});

test("convidado não vê os controles de edição", async ({ page }) => {
  await page.route("**/api/trips/demo", (r) => json(r, viagem({ organizador: false })));
  await page.goto("/v/demo#roteiro");
  await expect(page.getByText("Teatro Colón").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Adicionar item neste dia" })).toHaveCount(0);
});

test.describe("Passe trancado", () => {
  test("organizador vê a oferta no lugar do Cofre vazio", async ({ page }) => {
    await page.route("**/api/trips/demo", (r) => json(r, viagem({ locked: true, cofreVazio: true })));
    await page.goto("/v/demo#cofre");

    const oferta = page.getByRole("region", { name: "Guarde todas as reservas num lugar só" });
    await expect(oferta).toBeVisible();
    await expect(oferta.getByRole("link", { name: "Liberar por R$ 29" })).toHaveAttribute(
      "href",
      "/planos?viagem=demo"
    );
    // O recurso por tras fica visivel, mas nao responde a clique.
    await expect(page.locator(".paywall-preview")).toHaveAttribute("inert", "");
    await semRolagemLateral(page);
  });

  test("convidado não vê botão de pagar", async ({ page }) => {
    await page.route("**/api/trips/demo", (r) =>
      json(r, viagem({ locked: true, cofreVazio: true, organizador: false }))
    );
    await page.goto("/v/demo#cofre");

    const oferta = page.getByRole("region", { name: "Guarde todas as reservas num lugar só" });
    await expect(oferta).toContainText("Você não precisa pagar nada");
    await expect(oferta.getByRole("link", { name: /Liberar/ })).toHaveCount(0);
  });

  test("o que já foi salvo continua visível", async ({ page }) => {
    await page.route("**/api/trips/demo", (r) => json(r, viagem({ locked: true })));
    await page.goto("/v/demo#cofre");
    await expect(page.getByText("Voo GRU → EZE").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Guarde todas as reservas num lugar só" })).toHaveCount(0);
  });

  test("agente trancado não chama a IA", async ({ page }) => {
    let chamouAgente = false;
    await page.route("**/api/trips/demo/agent", (r) => {
      chamouAgente = true;
      return json(r, {});
    });
    await page.route("**/api/trips/demo", (r) => json(r, viagem({ locked: true })));
    await page.goto("/v/demo#agente");
    await expect(page.getByRole("region", { name: "Um agente que conhece a sua viagem" })).toBeVisible();
    expect(chamouAgente).toBe(false);
  });
});
