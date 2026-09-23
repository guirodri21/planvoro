"use client";

import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { track } from "@/lib/analytics";
import { BILLING_COPY, TRIAL_DIAS } from "@/lib/billing";

const PASSE = BILLING_COPY.trip_pass.amount / 100;

/**
 * Recurso pago, trancado, com o proprio recurso visivel por tras.
 *
 * O aviso antigo era um paragrafo em cima de um formulario desligado:
 * dizia que estava trancado, mas nao mostrava o que a pessoa ganharia.
 * Aqui o recurso aparece desfocado (e inerte — nada ali dentro responde
 * a clique nem a teclado), e a oferta fica por cima, com o preco e o
 * teste gratis a um toque.
 *
 * Quem foi convidado nao ve botao de pagar: o Passe e do organizador, e
 * a promessa do produto e que convidado nunca paga.
 */
export function PaywallGate({
  slug,
  isOrganizer,
  icon,
  titulo,
  descricao,
  beneficios,
  recurso,
  children,
}: {
  slug: string;
  isOrganizer: boolean;
  icon: IconName;
  /** Nome curto para o analytics: "cofre", "agente"... */
  recurso: string;
  titulo: string;
  descricao: string;
  beneficios: string[];
  children: ReactNode;
}) {
  // Uma vez por abertura da aba. `organizador` separa quem pode pagar de
  // quem so pode pedir — misturar os dois derrubaria a taxa sem motivo.
  useEffect(() => {
    track("paywall_visto", { recurso, organizador: isOrganizer });
  }, [recurso, isOrganizer]);

  const clicou = (acao: "liberar" | "testar") => () =>
    track("paywall_clicado", { recurso, acao });

  return (
    <div className="paywall">
      <div className="paywall-preview" aria-hidden="true" inert>
        {children}
      </div>

      <div className="paywall-card" role="region" aria-label={titulo}>
        <span className="paywall-icon">
          <Icon name={icon} size={22} />
        </span>
        <p className="paywall-tag">
          <Icon name="cofre" size={13} /> Recurso do Passe da viagem
        </p>
        <h2>{titulo}</h2>
        <p className="sub">{descricao}</p>
        <ul className="paywall-list">
          {beneficios.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {isOrganizer ? (
          <>
            <div className="paywall-actions">
              <a
                className="btn"
                href={`/planos?viagem=${encodeURIComponent(slug)}`}
                onClick={clicou("liberar")}
              >
                Liberar por R$ {PASSE}
              </a>
              <a
                className="btn ghost"
                href={`/planos?viagem=${encodeURIComponent(slug)}`}
                onClick={clicou("testar")}
              >
                Testar {TRIAL_DIAS} dias grátis
              </a>
            </div>
            <p className="tiny">
              Pagamento único, sem mensalidade. Libera para o grupo todo — convidado nunca paga.
            </p>
          </>
        ) : (
          <p className="tiny paywall-convidado">
            Quem organiza a viagem pode liberar para o grupo todo. Você não precisa pagar nada.
          </p>
        )}
      </div>
    </div>
  );
}
