import { expect, json, logar, test, viagem } from "./fixtures";

/** Endereco para encaminhar reservas ao Cofre. */

const ENDERECO = "demo.0123456789@cofre.planvoro.com.br";

test("Cofre mostra o endereço para encaminhar reservas", async ({ page }) => {
  await logar(page);
  await page.route("**/api/trips/demo", (r) => json(r, { ...viagem(), cofre_email: ENDERECO }));
  await page.goto("/v/demo#cofre");
  await expect(page.getByText(ENDERECO)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar endereço" })).toBeVisible();
});

test("sem endereço configurado, ou com o Cofre trancado, o cartão não aparece", async ({ page }) => {
  await logar(page);
  await page.route("**/api/trips/demo", (r) => json(r, { ...viagem({ locked: true }), cofre_email: ENDERECO }));
  await page.goto("/v/demo#cofre");
  await expect(page.getByText("Voo GRU → EZE").first()).toBeVisible();
  await expect(page.getByText(ENDERECO)).toHaveCount(0);

  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.reload();
  await expect(page.getByText("Voo GRU → EZE").first()).toBeVisible();
  await expect(page.getByText("Encaminhe a confirmação da reserva para cá")).toHaveCount(0);
});
