"use client";

import { useEffect } from "react";

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
 */
export function Confirmar({
  titulo,
  descricao,
  acao,
  trabalhando,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  descricao: string;
  /** Texto do botão que executa. Diga o que acontece, não "OK". */
  acao: string;
  trabalhando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  useEffect(() => {
    function naTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !trabalhando) onCancelar();
    }
    document.addEventListener("keydown", naTecla);
    return () => document.removeEventListener("keydown", naTecla);
  }, [trabalhando, onCancelar]);

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

        <div className="modal-acoes">
          <button
            className="btn ghost"
            type="button"
            onClick={onCancelar}
            disabled={trabalhando}
            autoFocus
          >
            Cancelar
          </button>
          <button
            className="btn btn-perigo"
            type="button"
            onClick={onConfirmar}
            disabled={trabalhando}
          >
            {trabalhando ? "Removendo..." : acao}
          </button>
        </div>
      </div>
    </div>
  );
}
