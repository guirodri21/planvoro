import { expect, semRolagemLateral, test } from "./fixtures";

/** Paginas que qualquer pessoa abre sem conta. */

test("home abre, tem chamada para criar viagem e não rola de lado", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator('a[href="/nova"]').first()).toBeAttached();
  await expect(page.locator("#precos")).toContainText("R$ 29");
  await semRolagemLateral(page);
});

test("planos sem conta: os três planos e o caminho para criar conta", async ({ page }) => {
  await page.goto("/planos");
  await expect(page.getByRole("heading", { name: "Grátis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Passe de viagem" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro anual" })).toBeVisible();
  await expect(page.getByText("Até 2 viagens ativas ao mesmo tempo")).toBeVisible();

  const liberar = page.getByRole("link", { name: "Criar conta e liberar" });
  await expect(liberar).toHaveAttribute("href", /^\/entrar\?mode=signup&next=%2Fplanos$/);
  await semRolagemLateral(page);
});

test("entrar mostra o formulário", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await semRolagemLateral(page);
});

test("endereço que não existe cai na página 404 em português", async ({ page }) => {
  const resposta = await page.goto("/pagina-que-nao-existe");
  expect(resposta?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Essa página não existe/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
});
