import type { Metadata } from "next";
import { SuporteForm, WhatsappSuporte } from "@/components/ajuda";
import { LegalPage } from "@/components/legal-page";
import { legalPrivacyEmail, legalSupportEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contato e suporte",
  alternates: { canonical: "/contato" },
  description: "Como falar com o Planvoro: suporte, privacidade e o que enviar para agilizar.",
};

export default function ContatoPage() {
  return (
    <LegalPage
      title="Contato e suporte"
      summary="Somos um time pequeno. Escreva direto — lemos tudo."
    >
      <h2>Suporte</h2>
      <p>
        Escreva aqui — a mensagem chega com a página e o aparelho, e respondemos no seu e-mail em
        até 2 dias úteis.
      </p>
      <div className="contato-canais">
        <SuporteForm />
        <div className="contato-lado">
          <p>
            <b>Com pressa?</b> Chame no WhatsApp.
          </p>
          <WhatsappSuporte className="btn whatsapp full" />
          <p className="tiny">
            Ou por e-mail: <a href={`mailto:${legalSupportEmail}`}>{legalSupportEmail}</a>
          </p>
        </div>
      </div>

      <h2>Privacidade e dados</h2>
      <p>
        <a href={`mailto:${legalPrivacyEmail}`}>{legalPrivacyEmail}</a>
      </p>
      <p>
        Pedidos de acesso, correção ou exclusão de dados. Resposta em até 15 dias, como manda a
        LGPD. Para apagar a conta inteira você não precisa escrever: dá para fazer sozinho em{" "}
        <a href="/app">Minhas viagens</a>.
      </p>

      <h2>Para agilizar</h2>
      <p>Se for um problema, conte duas coisas:</p>
      <ul>
        <li>o que você tentou fazer;</li>
        <li>o que aconteceu em vez disso.</li>
      </ul>
      <p>
        Pelo formulário, a página e o aparelho vão junto. Logado, use o botão <b>Ajuda</b> no canto
        da tela: ele já diz em qual viagem você está.
      </p>
      <p>
        Não envie senha, número de cartão ou documento por e-mail — nunca pediremos isso.
      </p>

      <h2>Antes de escrever</h2>
      <p>
        Algumas respostas já estão nas <a href="/#faq">perguntas frequentes</a>, nos{" "}
        <a href="/termos">termos de uso</a> e na{" "}
        <a href="/privacidade">política de privacidade</a>.
      </p>
    </LegalPage>
  );
}
