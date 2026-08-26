import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL, legalCompany, legalSupportEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de uso · Planvoro",
  description: "As regras de uso do Planvoro: o que o serviço faz, o que não faz e o que cabe a cada lado.",
};

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      summary="As regras de uso do Planvoro. Leia antes de criar uma viagem."
    >
      <h2>1. Quem somos</h2>
      <p>
        O Planvoro é operado por {legalCompany}
        {LEGAL.cnpj ? `, inscrita no CNPJ ${LEGAL.cnpj}` : ""}
        {LEGAL.city ? `, com sede em ${LEGAL.city}` : ""}. Contato:{" "}
        <a href={`mailto:${legalSupportEmail}`}>{legalSupportEmail}</a>.
      </p>

      <h2>2. O que o Planvoro é</h2>
      <p>
        O Planvoro é um espaço para organizar uma viagem: guardar reservas, documentos e códigos,
        montar roteiro, dividir gastos, combinar decisões com o grupo e consultar um agente de IA
        sobre o que já foi cadastrado.
      </p>

      <h2>3. O que o Planvoro não é</h2>
      <p>
        O Planvoro <b>não vende</b> passagem, hospedagem, passeio, seguro ou qualquer serviço de
        viagem, e não intermedeia essas compras. Tudo que você guarda aqui foi contratado com
        terceiros, e a relação com eles continua sendo só sua.
      </p>
      <p>
        Isso tem uma consequência prática: se um voo atrasar, uma reserva for cancelada ou um
        fornecedor não cumprir o combinado, quem responde é o fornecedor. O Planvoro guarda a
        informação, não presta o serviço de viagem.
      </p>

      <h2>4. Inteligência artificial</h2>
      <p>
        Roteiros, respostas do agente e a leitura automática de confirmações são gerados por
        inteligência artificial e <b>podem conter erros</b>. Horário, preço, disponibilidade, regra
        de bagagem, exigência de visto, condição de entrada em país e qualquer informação oficial
        precisam ser conferidos na fonte original antes de você decidir ou pagar algo.
      </p>
      <p>
        A IA não confirma reservas, não cria códigos e não fala com fornecedores. Quando ela
        preenche um rascunho a partir de um texto que você colou, nada é salvo sem a sua revisão.
      </p>

      <h2>5. Sua conta</h2>
      <p>
        Você precisa ter 18 anos ou mais, ou autorização de responsável. Os dados de acesso são
        pessoais: o que acontece na sua conta é responsabilidade sua. Se suspeitar de acesso
        indevido, avise pelo e-mail de contato.
      </p>

      <h2>6. Conteúdo que você guarda</h2>
      <p>
        O conteúdo que você envia continua seu. Você nos autoriza apenas a armazenar e exibir esse
        conteúdo para você e para quem participa da mesma viagem, e a processá-lo pela IA quando
        você pedir — o necessário para o serviço funcionar.
      </p>
      <p>Não é permitido usar o Planvoro para:</p>
      <ul>
        <li>guardar conteúdo ilegal ou que viole direito de terceiro;</li>
        <li>enviar documento de outra pessoa sem que ela saiba e concorde;</li>
        <li>tentar burlar limites de uso, sobrecarregar o serviço ou acessar viagem alheia.</li>
      </ul>
      <p>
        Ao convidar alguém para uma viagem, você compartilha com essa pessoa tudo que está
        cadastrado nela, incluindo anexos. Convide com atenção.
      </p>

      <h2>7. Limites de uso</h2>
      <p>
        Durante a fase gratuita há limites de geração de roteiro, perguntas ao agente, importações e
        viagens criadas por pessoa. Eles existem para manter o serviço disponível a todos e podem
        mudar conforme o uso real.
      </p>

      <h2>8. Preço</h2>
      <p>
        O Planvoro está em fase gratuita. Se passarmos a cobrar, avisaremos antes e nada será
        cobrado sem que você contrate expressamente.
      </p>

      <h2>9. Encerramento</h2>
      <p>
        Você pode apagar sua conta a qualquer momento pelo painel, sem precisar justificar. Podemos
        encerrar contas que violem estes termos, com aviso sempre que possível.
      </p>

      <h2>10. Limite de responsabilidade</h2>
      <p>
        O Planvoro é oferecido no estado em que se encontra. Não garantimos disponibilidade
        ininterrupta nem exatidão do que a IA produz. Não respondemos por prejuízo decorrente de
        decisão tomada com base em informação gerada por IA sem conferência na fonte oficial, nem
        por falha de fornecedor de viagem.
      </p>
      <p>Nada aqui afasta direitos que o Código de Defesa do Consumidor garante a você.</p>

      <h2>11. Mudanças</h2>
      <p>
        Estes termos podem mudar. Mudança relevante será avisada no serviço com antecedência
        razoável, e a data de atualização no topo desta página sempre indica a versão vigente.
      </p>

      <h2>12. Lei e foro</h2>
      <p>
        Aplica-se a lei brasileira. Fica eleito o foro
        {LEGAL.jurisdiction ? ` da comarca de ${LEGAL.jurisdiction}` : " do domicílio do consumidor"},
        sem prejuízo do direito de o consumidor demandar no seu próprio domicílio.
      </p>
    </LegalPage>
  );
}
