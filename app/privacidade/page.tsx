import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalCompany, legalDocument, legalPrivacyEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidade · Planvoro",
  description: "Quais dados o Planvoro trata, por quê, com quem compartilha e como você apaga tudo.",
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de privacidade"
      summary="Quais dados tratamos, por quê, com quem compartilhamos e como você apaga tudo."
    >
      <h2>1. Controlador</h2>
      <p>
        {legalCompany}
        {legalDocument ? ` (${legalDocument})` : ""} é quem controla os dados tratados no Planvoro.
        Para qualquer assunto de privacidade, incluindo os direitos previstos na LGPD, escreva para{" "}
        <a href={`mailto:${legalPrivacyEmail}`}>{legalPrivacyEmail}</a>.
      </p>

      <h2>2. O que tratamos</h2>
      <p>
        <b>Cadastro:</b> e-mail, nome de exibição e, se você entrar com Google, a foto de perfil. A
        senha nunca chega até nós — a autenticação é feita pelo Supabase Auth.
      </p>
      <p>
        <b>Conteúdo da viagem:</b> destino, datas, preferências, itens do Cofre (fornecedor, código
        de reserva, valores, links, notas), anexos que você envia, checklist, ideias, gastos,
        comentários e votos.
      </p>
      <p>
        <b>Uso:</b> registro de quantas gerações de roteiro, perguntas ao agente e importações foram
        feitas, para aplicar limites. Logs técnicos de erro, sem conteúdo do que você escreveu.
      </p>
      <p>
        <b>Analytics:</b> quando configurado, eventos de uso agregados via PostHog — sem gravação de
        tela e sem captura automática de cliques.
      </p>

      <h2>3. Por que tratamos</h2>
      <ul>
        <li>
          <b>Executar o contrato:</b> sem os dados da viagem não há serviço a prestar.
        </li>
        <li>
          <b>Legítimo interesse:</b> segurança, prevenção a abuso e melhoria do produto, com dados
          de uso mantidos no mínimo necessário.
        </li>
        <li>
          <b>Obrigação legal:</b> guarda de registros de acesso pelo prazo do Marco Civil da
          Internet.
        </li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <p>Não vendemos dados. Usamos fornecedores que atuam como operadores:</p>
      <ul>
        <li>
          <b>Supabase</b> — banco de dados, autenticação e armazenamento de anexos.
        </li>
        <li>
          <b>Vercel</b> — hospedagem da aplicação.
        </li>
        <li>
          <b>Google (Gemini)</b> — geração de roteiro, agente e leitura de confirmações.
        </li>
        <li>
          <b>Resend</b> — envio de convites por e-mail.
        </li>
        <li>
          <b>AbacatePay</b> — pagamentos, quando houver cobrança. Dados de cartão e Pix vão
          direto para a AbacatePay e não passam pelos nossos servidores.
        </li>
        <li>
          <b>PostHog</b> — analytics de uso, quando configurado.
        </li>
      </ul>
      <p>
        Parte desses fornecedores processa dados fora do Brasil. A transferência internacional é
        feita com base na execução do contrato e nas salvaguardas contratuais de cada fornecedor.
      </p>

      <h2>5. Inteligência artificial</h2>
      <p>
        Quando você gera um roteiro, pergunta ao agente ou cola um texto de confirmação, o conteúdo
        necessário é enviado ao provedor de IA para produzir a resposta. Não usamos o seu conteúdo
        para treinar modelos próprios.
      </p>
      <p>
        Um cuidado prático: evite colar documento com dado sensível que não seja necessário. Se um
        e-mail de confirmação traz número de documento ou cartão, apague essa parte antes de colar.
      </p>

      <h2>6. Quem mais vê seus dados</h2>
      <p>
        Uma viagem é compartilhada: todos os participantes veem o que está cadastrado nela,
        incluindo anexos. Roteiro publicado em link público fica visível a quem tiver o endereço —
        Cofre, gastos e checklist nunca aparecem ali.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Tráfego criptografado, acesso ao banco somente pelo servidor, e anexos guardados em
        repositório privado cujo link de abertura expira em poucos minutos. Nenhum sistema é
        infalível, mas tratamos incidente com seriedade e comunicamos quando houver risco a você.
      </p>

      <h2>8. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Ao apagar a conta, os dados das viagens que você criou e seus
        anexos são removidos. Registros de acesso são mantidos pelo prazo legal, e o que já estiver
        anonimizado pode ser conservado em forma agregada.
      </p>

      <h2>9. Seus direitos</h2>
      <p>
        A LGPD garante confirmação de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação, informação sobre compartilhamento e revogação de consentimento. Para exercer
        qualquer um, escreva para{" "}
        <a href={`mailto:${legalPrivacyEmail}`}>{legalPrivacyEmail}</a>. Respondemos em até 15 dias.
      </p>
      <p>
        A exclusão da conta você mesmo faz, a qualquer momento, em <a href="/app">Minhas viagens</a>.
      </p>

      <h2>10. Crianças</h2>
      <p>
        O Planvoro não é destinado a menores de 18 anos sem autorização de responsável, e não
        coletamos dados de crianças de forma consciente.
      </p>

      <h2>11. Mudanças</h2>
      <p>
        Se esta política mudar de forma relevante, avisaremos no serviço. A data no topo indica a
        versão vigente.
      </p>
    </LegalPage>
  );
}
