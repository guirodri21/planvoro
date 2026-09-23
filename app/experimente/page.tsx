import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, DEFAULT_OPEN_GRAPH } from "@/lib/site";
import { ExperimenteClient } from "./experimente-client";

/**
 * A pagina era um componente de cliente inteiro, e componente de cliente
 * nao exporta `metadata`. A porta de entrada sem conta — a que mais
 * aparece em anuncio e em busca — saia com o titulo generico da home e
 * com o canonical apontando para la.
 */
export const metadata: Metadata = {
  title: "Roteiro de viagem com IA grátis, sem cadastro",
  description:
    "Digite o destino e veja dois dias de roteiro montados por IA, com horários e custo estimado. Sem conta e sem cartão.",
  alternates: { canonical: "/experimente" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Experimente o Planvoro: roteiro de viagem com IA sem cadastro",
    description:
      "Digite o destino e veja dois dias de roteiro montados por IA. Sem conta e sem cartão.",
    url: "/experimente",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ExperimentePage() {
  return <ExperimenteClient />;
}
