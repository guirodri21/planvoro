import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalPrivacyEmail, legalSupportEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contato e suporte · Planvoro",
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
        <a href={`mailto:${legalSupportEmail}`}>{legalSupportEmail}</a>
      </p>
      <p>Respondemos em até 2 dias úteis.</p>

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
      <p>Se for um problema, conte três coisas:</p>
      <ul>
        <li>o que você tentou fazer;</li>
        <li>o que aconteceu em vez disso;</li>
        <li>o endereço da página onde ocorreu.</li>
      </ul>
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
