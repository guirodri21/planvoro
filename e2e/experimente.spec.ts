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
    page.getByRole("button", { name: "Salvador", exact: true }).click(),
  ]);
  expect(pedido.postDataJSON()).toEqual({ destination: "Salvador" });
  await expect(page.getByText("Elevador Lacerda")).toBeVisible();
});

test.describe("variação do anúncio", () => {
  test("utm_source=meta mostra o título da dor do grupo", async ({ page }) => {
    await page.goto("/experimente?utm_source=meta");
    await expect(page.getByRole("heading", { level: 1, name: /Chega de 14 abas/ })).toBeVisible();
    await expect(page.getByText("Sem conta, sem cartão.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Veja um roteiro antes/ })).toBeHidden();
  });

  test("utm_campaign=dor também", async ({ page }) => {
    await page.goto("/experimente?utm_source=google&utm_campaign=dor");
    await expect(page.getByRole("heading", { level: 1, name: /Chega de 14 abas/ })).toBeVisible();
  });

  test("sem UTM fica o texto de antes", async ({ page }) => {
    await page.goto("/experimente");
    await expect(page.getByRole("heading", { level: 1, name: /Veja um roteiro antes/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Chega de 14 abas/ })).toBeHidden();
  });
});

test("celular 390x844: campo e botão visíveis sem rolar, nas duas versões", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await contexto.newPage();
  for (const url of ["/experimente?utm_source=meta&utm_campaign=dor", "/experimente"]) {
    await page.goto(url);
    const botao = page.getByRole("button", { name: "Montar meu roteiro grátis" });
    await expect(botao).toBeVisible();
    const caixa = await botao.boundingBox();
    expect(caixa, url).not.toBeNull();
    expect(caixa!.y + caixa!.height, `${url}: botão abaixo da dobra`).toBeLessThanOrEqual(844);
    const campo = await page.getByRole("textbox", { name: "Destino" }).boundingBox();
    expect(campo!.x + campo!.width, `${url}: campo cortado na direita`).toBeLessThanOrEqual(390);
    await semRolagemLateral(page);
  }

  // Com roteiro na tela (mesmo layout do exemplo de Buenos Aires): o
  // total do dia em moeda local e em real nao quebra linha e ja alargou a
  // pagina para 404px numa tela de 390px.
  const item = (h: string) => ({
    start_time: h,
    title: "Parada com nome comprido",
    description: "Descrição do passeio.",
    cost_estimate: 50,
    cost_local: 20000,
    cost_currency: "ARS",
  });
  await page.route("**/api/sample", (r) =>
    json(r, {
      destination: "Buenos Aires",
      itinerary: {
        rationale: "Para agradar Ana e Bruno, o roteiro equilibra cultura, gastronomia e natureza.",
        days: [{ day_date: "2026-10-01", title: "Recoleta e Palermo", note: "", items: ["09:00", "12:00", "15:00", "18:00", "21:00", "23:00", "23:30"].map(item) }],
      },
    })
  );
  await page.getByRole("button", { name: "Salvador", exact: true }).click();
  await expect(page.getByText("Recoleta e Palermo")).toBeVisible();
  await semRolagemLateral(page);
  await contexto.close();
});
