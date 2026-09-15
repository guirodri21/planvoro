/**
 * Slug da viagem a partir do destino.
 *
 * O sufixo aleatorio existe porque destino repete muito: dez pessoas
 * criando "Lisboa" no mesmo dia nao podem colidir.
 */

/** Acentos separados pela normalizacao NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(destination: string) {
  const base = destination
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "viagem"}-${suffix}`;
}
