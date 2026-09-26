import { expect, json, semRolagemLateral, test } from "./fixtures";

/** /experimente: amostra sem conta, a pagina para onde o anuncio aponta. */

test("?d= preenche o destino sem gerar sozinho", async ({ page }) => {
  let pediu = false;
  await page.route("**/api/sample", (r) => {
    pediu = true;
    return json(r, {});
  });
  await page.goto("/experimente?d=Foz%20do%20Igua%C3%A7u&utm_source=meta&utm_campaign=dor");
  await expect(page.getByRole("textbox", { name: "Destino" })).toHaveValue("Foz do Iguaçu");
  await page.waitForTimeout(500);
  expect(pediu).toBe(false);
  await semRolagemLateral(page);
});

test("sugestão gera a amostra e mostra o roteiro", async ({ page }) => {
  await page.route("**/api/sample", (r) =>
    json(r, {
      destination: "Salvador",
      itinerary: {
        rationale: "Centro histórico e praia.",
        days: [
          {
            day_date: "2026-10-01",
            title: "Pelourinho",
            note: "",
            items: [{ start_time: "09:00", title: "Elevador Lacerda", description: "Vista da baía.", cost_estimate: 0 }],
          },
        ],
      },
    })
  );
  await page.goto("/experimente");
  const [pedido] = await Promise.all([
    page.waitForRequest("**/api/sample"),
    page.getByRole("button", { name: "Lisboa", exact: true }).click(),
  ]);
  expect(pedido.postDataJSON()).toEqual({ destination: "Lisboa" });
  await expect(page.getByText("Elevador Lacerda")).toBeVisible();
});
