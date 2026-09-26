import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, DEFAULT_OPEN_GRAPH } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase";
import ExperimenteClient, { type SampleResponse } from "./experimente-client";

/**
 * A tela que abre com um roteiro pronto.
 *
 * O exemplo vem do servidor para estar no HTML da primeira pintura: se
 * dependesse de fetch no cliente, a pessoa veria de novo a tela vazia
 * que era justamente o problema — só que por meio segundo.
 *
 * Nao usa readSampleCache de proposito. Aquela funcao tem janela de 30
 * dias, certa para cache, errada para vitrine: o exemplo nao pode sumir
 * da landing porque envelheceu.
 */
export const revalidate = 3600;

const EXEMPLO_KEY = "buenos-aires";

export const metadata: Metadata = {
  title: "Veja um roteiro de 2 dias, sem criar conta",
  description:
    "Um roteiro real montado pelo Planvoro, com horário e custo estimado de cada parada. Troque pelo seu destino e veja o seu em 1 minuto.",
  // O canonical do layout raiz apontava esta pagina para a home.
  alternates: { canonical: "/experimente" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Veja um roteiro de 2 dias no Planvoro, sem criar conta",
    description:
      "Um roteiro real com horário e custo de cada parada. Troque pelo seu destino e veja o seu em 1 minuto.",
    url: "/experimente",
    images: [DEFAULT_OG_IMAGE],
  },
};

async function carregarExemplo(): Promise<SampleResponse | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("sample_itineraries")
      .select("destination, payload")
      .eq("destination_key", EXEMPLO_KEY)
      .maybeSingle();

    if (!data?.payload) return null;
    return { destination: data.destination, itinerary: data.payload as SampleResponse["itinerary"] };
  } catch {
    // Vitrine quebrada nao pode derrubar a pagina: sem exemplo, ela volta
    // a ser o formulario de antes, que funciona.
    return null;
  }
}

/**
 * Pagina estatica, regenerada a cada hora (revalidate acima).
 *
 * Antes lia `?d=` aqui no servidor, e ler searchParams deixa a pagina
 * dinamica: cada visita renderizava de novo e ia ao banco buscar o mesmo
 * exemplo de Buenos Aires. TTFB medido de ~1,9 s, quase todo de quem vem
 * do anuncio, no celular. Agora o `?d=` e as UTMs sao lidos no navegador
 * (experimente-client.tsx) e o HTML sai pronto do cache.
 */
export default async function ExperimentePage() {
  const exemplo = await carregarExemplo();
  return <ExperimenteClient exemplo={exemplo} />;
}
