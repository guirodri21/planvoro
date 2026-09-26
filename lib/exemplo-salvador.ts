/**
 * Roteiro de exemplo de Salvador, mostrado no topo do /experimente para
 * quem vem do anuncio (variacao "dor").
 *
 * Copiado de sample_itineraries (destination_key = "salvador", gerado em
 * 04/09/2026) e fixado no codigo de proposito: a pagina e estatica, e o
 * exemplo precisa estar no HTML da primeira resposta — sem ida ao banco,
 * sem chamada a IA e sem espera no 4G. Custos em reais, por pessoa.
 */
export type ParadaExemplo = { hora: string; titulo: string; custo: number };
export type DiaExemplo = { titulo: string; paradas: ParadaExemplo[] };

export const EXEMPLO_SALVADOR: { destino: string; dias: [DiaExemplo, DiaExemplo] } = {
  destino: "Salvador",
  dias: [
    {
      titulo: "Centro Histórico e pôr do sol na Barra",
      paradas: [
        { hora: "09:00", titulo: "Caminhada pelo Pelourinho e Mercado Modelo", custo: 30 },
        { hora: "12:30", titulo: "Almoço típico baiano no Centro Histórico", custo: 85 },
        { hora: "15:30", titulo: "Farol da Barra e Museu Náutico", custo: 15 },
        { hora: "18:00", titulo: "Pôr do sol e jantar no Santo Antônio Além do Carmo", custo: 110 },
      ],
    },
    {
      titulo: "Natureza e tradição na Cidade Baixa",
      paradas: [
        { hora: "08:30", titulo: "Trilha no Parque das Dunas", custo: 50 },
        { hora: "12:30", titulo: "Almoço regional na Cidade Baixa", custo: 90 },
        { hora: "15:00", titulo: "Igreja do Senhor do Bonfim", custo: 0 },
        { hora: "17:00", titulo: "Pôr do sol na Ponta do Humaitá", custo: 0 },
      ],
    },
  ],
};
