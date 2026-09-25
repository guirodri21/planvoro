import { expect, json, logar, painel, semRolagemLateral, test, viagem } from "./fixtures";

/** Canal de suporte: botao "Ajuda", formulario e WhatsApp. */

test("logado: botão Ajuda manda a mensagem com a página e o login", async ({ page }) => {
  await logar(page);
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.route("**/api/suporte", (r) => json(r, { ok: true }));
  await page.goto("/v/demo#cofre");

  await page.getByRole("button", { name: "Ajuda e sugestões" }).click();
  const janela = page.getByRole("dialog", { name: "Ajuda e sugestões" });
  await expect(janela).toBeVisible();
  // Logado nao pede e-mail: vem da conta.
  await expect(janela.locator('input[type="email"]')).toHaveCount(0);

  const enviar = janela.getByRole("button", { name: "Enviar" });
  await janela.getByRole("textbox").fill("curta");
  await expect(enviar).toBeDisabled();
  await janela.getByRole("textbox").fill("Não consigo anexar o PDF do voo no Cofre.");

  const [pedido] = await Promise.all([page.waitForRequest("**/api/suporte"), enviar.click()]);
  expect(pedido.headers()["authorization"]).toBe("Bearer token-falso");
  expect(pedido.postDataJSON()).toMatchObject({
    tipo: "ajuda",
    mensagem: "Não consigo anexar o PDF do voo no Cofre.",
    pagina: "/v/demo#cofre",
  });
  await expect(janela.getByRole("status")).toContainText("Mensagem recebida");

  await page.keyboard.press("Escape");
  await expect(janela).toHaveCount(0);
});

test("logado: sugestão pelo menu da conta, e WhatsApp com o número certo", async ({ page }) => {
  await logar(page);
  await page.route("**/api/me/dashboard", (r) => json(r, painel()));
  await page.route("**/api/suporte", (r) => json(r, { ok: true }));
  await page.goto("/app");

  await page.getByRole("button", { name: "Conta de Guilherme" }).click();
  await page.getByRole("menuitem", { name: "Ajuda e sugestões" }).click();
  const janela = page.getByRole("dialog", { name: "Ajuda e sugestões" });
  await janela.getByRole("radio", { name: "Tenho uma sugestão" }).click();
  await expect(janela.getByRole("radio", { name: "Tenho uma sugestão" })).toHaveAttribute("aria-checked", "true");

  const whatsapp = janela.getByRole("link", { name: "Falar no WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/5571993898278\?text=/);

  await janela.getByRole("textbox").fill("Queria exportar o roteiro em PDF.");
  const [pedido] = await Promise.all([
    page.waitForRequest("**/api/suporte"),
    janela.getByRole("button", { name: "Enviar" }).click(),
  ]);
  expect(pedido.postDataJSON()).toMatchObject({ tipo: "sugestao" });
  await expect(janela.getByRole("status")).toContainText("Obrigado pela sugestão");
  await semRolagemLateral(page);
});

test("erro do servidor aparece no formulário", async ({ page }) => {
  await logar(page);
  await page.route("**/api/me/dashboard", (r) => json(r, painel()));
  await page.route("**/api/suporte", (r) => json(r, { error: "Recebemos várias mensagens suas na última hora." }, 429));
  await page.goto("/app");

  await page.getByRole("button", { name: "Ajuda e sugestões" }).click();
  const janela = page.getByRole("dialog", { name: "Ajuda e sugestões" });
  await janela.getByRole("textbox").fill("Mais uma mensagem de teste aqui.");
  await janela.getByRole("button", { name: "Enviar" }).click();
  await expect(janela.getByText("Recebemos várias mensagens suas na última hora.")).toBeVisible();
});

test("sem conta: sem botão flutuante; /contato pede e-mail e manda a mensagem", async ({ page }) => {
  await page.route("**/api/suporte", (r) => json(r, { ok: true }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ajuda e sugestões" })).toHaveCount(0);

  await page.goto("/contato");
  await page.getByLabel("O que aconteceu?").fill("Quero saber se o Passe vale para o grupo todo.");
  await page.getByLabel("Seu e-mail, para a resposta").fill("cliente@example.com");
  await expect(page.getByRole("link", { name: "Falar no WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/5571993898278\?text=/
  );

  const [pedido] = await Promise.all([
    page.waitForRequest("**/api/suporte"),
    page.getByRole("button", { name: "Enviar" }).click(),
  ]);
  expect(pedido.postDataJSON()).toMatchObject({ email: "cliente@example.com", pagina: "/contato" });
  expect(pedido.headers()["authorization"]).toBeUndefined();
  await expect(page.getByRole("status")).toContainText("Mensagem recebida");
  await semRolagemLateral(page);
});
