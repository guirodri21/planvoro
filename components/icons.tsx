/**
 * Icones de traco usados na navegacao das areas logadas.
 *
 * Desenhados inline, sem biblioteca: sao onze tracos simples, e uma
 * dependencia inteira de icones pesaria mais que o painel que os usa.
 * Herdam a cor do texto (`currentColor`), entao acompanham o estado ativo
 * do botao sem CSS extra.
 */

const PATHS = {
  grupo: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14.2A5 5 0 0 1 21.5 19v1" />
    </>
  ),
  checklist: (
    <>
      <path d="m9 11 3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </>
  ),
  ideias: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21.5h4" />
      <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5Z" />
    </>
  ),
  roteiro: (
    <>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </>
  ),
  mapa: (
    <>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  viagem: (
    <>
      <path d="M2.5 19.5h19" />
      <path d="m3.6 11.2 2.3-.9 3 2.2 4.3-1.8-5.5-5 2.3-.9 7.7 3.9 3.3-1.4a1.8 1.8 0 0 1 1.4 3.3L7 16.6a2 2 0 0 1-2.2-.4l-1.8-2a1.8 1.8 0 0 1 .6-3Z" />
    </>
  ),
  cofre: (
    <>
      <rect x="3.5" y="10.5" width="17" height="11" rx="2.5" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
      <path d="M12 15v2.5" />
    </>
  ),
  agente: (
    <>
      <path d="M11 3.5 12.8 8l4.7 1.8-4.7 1.8L11 16.2l-1.8-4.6L4.5 9.8 9.2 8Z" />
      <path d="M18.5 14.5 19.4 17l2.4.9-2.4.9-.9 2.5-.9-2.5-2.4-.9 2.4-.9Z" />
    </>
  ),
  gastos: (
    <>
      <path d="M19 7.5V5a2 2 0 0 0-2-2H5.5a2.5 2.5 0 0 0 0 5H20a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 18.5v-13" />
      <circle cx="16.5" cy="14" r="1.3" />
    </>
  ),
  casa: (
    <>
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5.5 9v11a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9" />
    </>
  ),
  mais: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  arquivo: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </>
  ),
  cartao: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6.5 15h3" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
