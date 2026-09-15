"use client";

import { useEffect, useState } from "react";

/**
 * Confirmação de ação irreversível.
 *
 * Substitui o `window.confirm`. O nativo funciona e a mensagem era boa,
 * mas ele aparece colado no topo do navegador, com a tipografia do
 * sistema e o nome do site do lado — numa ação que apaga a única cópia de
 * um localizador de voo, isso lê como aviso de site suspeito, não como
 * uma pergunta do produto.
 *
 * O botão que destrói é o único vermelho, e o foco começa em "Cancelar":
 * quem apertou o atalho errado sai apertando Enter.
 *
 * Com `exigirTexto`, a confirmação passa a exigir digitação. Reserve isso
 * para o que destrói dado de outras pessoas — apagar uma viagem leva
 * junto o Cofre e os gastos do grupo inteiro, que não foi consultado.
 * Usar em tudo treina a pessoa a digitar sem ler.
 */
export function Confirmar({
  titulo,
  descricao,
  acao,
  exigirTexto,
  trabalhando,
  erro,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  descricao: string;
  /** Texto do botão que executa. Diga o que acontece, não "OK". */
  acao: string;
  /** Palavra que a pessoa precisa digitar. Sem isso, basta clicar. */
  exigirTexto?: string;
  trabalhando?: boolean;
  erro?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [digitado, setDigitado] = useState("");

  useEffect(() => {
    function naTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !trabalhando) onCancelar();
    }
    document.addEventListener("keydown", naTecla);
    return () => document.removeEventListener("keydown", naTecla);
  }, [trabalhando, onCancelar]);

  const liberado =
    !exigirTexto || digitado.trim().toUpperCase() === exigirTexto.toUpperCase();

  return (
    <div
      className="modal-fundo"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !trabalhando) onCancelar();
      }}
    >
      <div className="modal modal-perigo" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        <p className="sub">{descricao}</p>

        {exigirTexto && (
          <>
            <label className="modal-rotulo" htmlFor="confirmar-texto">
              Digite <b>{exigirTexto}</b> para confirmar
            </label>
            <input
              id="confirmar-texto"
              value={digitado}
              onChange={(evento) => setDigitado(evento.target.value)}
              placeholder={exigirTexto}
              autoComplete="off"
              autoFocus
            />
          </>
        )}

        {erro && <div className="err">{erro}</div>}

        <div className="modal-acoes">
          <button
            className="btn ghost"
            type="button"
            onClick={onCancelar}
            disabled={trabalhando}
            autoFocus={!exigirTexto}
          >
            Cancelar
          </button>
          <button
            className="btn btn-perigo"
            type="button"
            onClick={onConfirmar}
            disabled={trabalhando || !liberado}
          >
            {trabalhando ? "Removendo..." : acao}
          </button>
        </div>
      </div>
    </div>
  );
}
