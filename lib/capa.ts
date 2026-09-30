import type { CSSProperties } from "react";

/**
 * Cor da capa de uma viagem, tirada do nome do destino.
 *
 * Cada viagem ganha uma identidade visual sem foto: nada de imagem de
 * terceiro para licenciar nem para pesar no 4G. O mesmo destino tem sempre
 * a mesma cor — no painel e dentro da viagem — entao a pessoa reconhece a
 * viagem de relance.
 */
export function capaDoDestino(destino: string) {
  let h = 0;
  for (const letra of destino.toLowerCase()) h = (h * 31 + letra.charCodeAt(0)) % 360;
  return {
    "--capa-a": `hsl(${h} 70% 90%)`,
    "--capa-b": `hsl(${(h + 45) % 360} 72% 78%)`,
    "--capa-tinta": `hsl(${h} 50% 22%)`,
  } as CSSProperties;
}

const DIA_MS = 86_400_000;

/** O numero grande da capa: dias para embarcar, dia da viagem ou fim. */
export function contagemDaViagem(startDate: string, endDate: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(`${startDate}T00:00:00`);
  const fim = new Date(`${endDate}T00:00:00`);
  const faltam = Math.round((inicio.getTime() - hoje.getTime()) / DIA_MS);
  if (faltam >= 1) return { numero: String(faltam), legenda: faltam === 1 ? "dia para embarcar" : "dias para embarcar" };
  if (hoje.getTime() <= fim.getTime()) {
    const dia = Math.round((hoje.getTime() - inicio.getTime()) / DIA_MS) + 1;
    const total = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
    return { numero: `${dia}/${total}`, legenda: "dias de viagem" };
  }
  return { numero: "✓", legenda: "viagem feita" };
}
