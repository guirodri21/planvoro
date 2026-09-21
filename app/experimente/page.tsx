import type { Metadata } from "next";
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

export default async function ExperimentePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const [exemplo, { d }] = await Promise.all([carregarExemplo(), searchParams]);

  /**
   * As paginas de destino mandam gente para ca com ?d=Foz do Iguacu.
   * Quem chegou lendo um roteiro de Foz ja disse qual e o destino dele;
   * obrigar a digitar de novo e perder a pessoa no ultimo passo.
   *
   * Preenche o campo mas nao gera sozinho: geracao automatica faria o
   * rastreador do Google e cada link compartilhado consumirem uma chamada
   * da IA sem ninguem estar olhando.
   */
  const destinoInicial = typeof d === "string" ? d.slice(0, 60) : "";

  return <ExperimenteClient exemplo={exemplo} destinoInicial={destinoInicial} />;
}
