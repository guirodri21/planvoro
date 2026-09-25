import { readFile } from "node:fs/promises";
import { expect, json, logar, test, viagem } from "./fixtures";

/** Roteiro para a agenda do celular (.ics) e relatorio de erro do navegador. */

test("aba Agenda baixa o roteiro como .ics", async ({ page }) => {
  await logar(page);
  await page.route("**/api/trips/demo", (r) => json(r, viagem()));
  await page.goto("/v/demo#agenda");

  const [arquivo] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Adicionar à agenda" }).click(),
  ]);
  expect(arquivo.suggestedFilename()).toBe("planvoro-demo.ics");
  const texto = await readFile((await arquivo.path()) as string, "utf8");
  expect(texto).toContain("BEGIN:VCALENDAR");
  expect(texto).toContain("SUMMARY:Teatro Colón");
  // Horario flutuante: sem "Z" e sem fuso, vale a hora local da viagem.
  expect(texto).toMatch(/DTSTART:\d{8}T093000\r\n/);
  expect(texto.match(/BEGIN:VEVENT/g)).toHaveLength(3);
});

test("erro no navegador é reportado uma vez", async ({ page }) => {
  const pedidos: unknown[] = [];
  await page.route("**/api/erros-cliente", async (r) => {
    pedidos.push(r.request().postDataJSON());
    await json(r, { ok: true });
  });
  await page.goto("/");
  await page.evaluate(() => {
    const erro = new Error("quebrou no teste");
    for (let i = 0; i < 3; i += 1) {
      window.dispatchEvent(new ErrorEvent("error", { error: erro, message: erro.message, filename: location.origin + "/x.js" }));
    }
  });
  await expect.poll(() => pedidos.length).toBe(1);
  expect(pedidos[0]).toMatchObject({ mensagem: "Error: quebrou no teste", pagina: "/" });
});
