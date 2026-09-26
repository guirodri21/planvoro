import type { Locator } from "@playwright/test";
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

  test("link quebrado da Meta (utm_source=metautm_medium=paid) também conta", async ({ page }) => {
    await page.goto("/experimente?utm_source=metautm_medium=paid");
    await expect(page.getByRole("heading", { level: 1, name: /Chega de 14 abas/ })).toBeVisible();
  });

  test("utm_source que só contém meta no meio não conta", async ({ page }) => {
    await page.goto("/experimente?utm_source=newsletter-meta");
    await expect(page.getByRole("heading", { level: 1, name: /Veja um roteiro antes/ })).toBeVisible();
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

test.describe("exemplo pronto de Salvador (variação do anúncio)", () => {
  test("aparece antes do formulário, com preço de cada parada e total do dia", async ({ page }) => {
    await page.goto("/experimente?utm_source=meta-teste");
    const exemplo = page.getByRole("region", { name: "Exemplo de roteiro pronto" });
    await expect(exemplo.getByText("Assim fica o seu roteiro — com o preço de cada parada.")).toBeVisible();
    await expect(exemplo.getByText(/Dia 1 · /)).toBeVisible();
    await expect(exemplo.locator(".item")).toHaveCount(4);
    await expect(exemplo.getByText("~R$ 30,00")).toBeVisible();
    await expect(exemplo.getByText("total ~R$ 240,00")).toBeVisible();
    await expect(exemplo.getByText(/Dia 2 · /)).toHaveCount(0);

    await exemplo.getByRole("button", { name: /ver dia 2/ }).click();
    await expect(exemplo.getByText(/Dia 2 · /)).toBeVisible();
    await expect(exemplo.getByText("grátis").first()).toBeVisible();
  });

  test("o botão leva ao campo de destino, já com o cursor nele", async ({ page }) => {
    await page.goto("/experimente?utm_source=meta-teste");
    await page.getByRole("button", { name: "Montar o meu destino →" }).click();
    await expect(page.getByRole("textbox", { name: "Destino" })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Destino" })).toBeInViewport();
  });

  test("sem utm_source a página não mostra o exemplo", async ({ page }) => {
    await page.goto("/experimente");
    await expect(page.getByText("Assim fica o seu roteiro — com o preço de cada parada.")).toBeHidden();
    await expect(page.getByRole("button", { name: "Montar o meu destino →" })).toBeHidden();
  });
});

test("celular 390x844: o que precisa aparecer sem rolar, nas duas versões", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await contexto.newPage();
  const dobra = 844;
  const acimaDaDobra = async (url: string, alvo: Locator) => {
    await expect(alvo).toBeVisible();
    const caixa = await alvo.boundingBox();
    expect(caixa, url).not.toBeNull();
    expect(caixa!.y + caixa!.height, `${url}: abaixo da dobra`).toBeLessThanOrEqual(dobra);
  };

  // Anuncio: o exemplo pronto e o botao dele vem antes do formulario.
  const anuncio = "/experimente?utm_source=meta-teste";
  await page.goto(anuncio);
  await acimaDaDobra(anuncio, page.getByRole("region", { name: "Exemplo de roteiro pronto" }).locator(".day").first());
  await acimaDaDobra(anuncio, page.getByRole("button", { name: "Montar o meu destino →" }));
  await semRolagemLateral(page);

  // Sem UTM: igual a antes, campo e botao do formulario na primeira tela.
  const padrao = "/experimente";
  await page.goto(padrao);
  await acimaDaDobra(padrao, page.getByRole("button", { name: "Montar meu roteiro grátis" }));
  const campo = await page.getByRole("textbox", { name: "Destino" }).boundingBox();
  expect(campo!.x + campo!.width, `${padrao}: campo cortado na direita`).toBeLessThanOrEqual(390);
  await semRolagemLateral(page);

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
