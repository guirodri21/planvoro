import type { ReactNode } from "react";
import { LEGAL, LEGAL_PENDING, formatLegalDate } from "@/lib/legal";

/**
 * Moldura das paginas legais.
 *
 * O aviso de rascunho aparece enquanto `lib/legal.ts` estiver sem razao
 * social e contato: e melhor o texto se declarar incompleto do que passar
 * por documento valido sem identificar o controlador.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="legal-page">
      <header>
        <h1>{title}</h1>
        <p className="sub">{summary}</p>
        <p className="tiny">Ultima atualizacao: {formatLegalDate(LEGAL.updatedAt)}</p>
      </header>

      {LEGAL_PENDING && (
        <div className="note">
          <b>Documento em preparacao</b>
          <br />
          Ainda faltam a razao social, o CNPJ e o e-mail oficial de contato. Enquanto isso, este
          texto serve como referencia do que o Planvoro faz, mas nao substitui a versao final.
        </div>
      )}

      <div className="legal-body">{children}</div>
    </article>
  );
}
