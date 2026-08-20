import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Planvoro — roteiro de viagem por IA, sozinho ou em grupo";

// Gerada pelo proprio Next, sem dependencia externa.
// E a imagem que aparece quando alguem manda o link no WhatsApp --
// no nosso caso, o principal canal de distribuicao.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0B0E13",
          padding: "0 84px",
          color: "#EAF0F7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg,#4ADE80,#22D3EE)",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>planvoro</div>
        </div>

        <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
          Roteiro de viagem por IA.
        </div>
        <div
          style={{
            fontSize: 66,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            background: "linear-gradient(90deg,#4ADE80,#22D3EE)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Sozinho ou em grupo.
        </div>

        <div style={{ fontSize: 27, color: "#8B9AAD", marginTop: 30 }}>
          Cada lugar verificado antes de entrar no roteiro.
        </div>
      </div>
    ),
    size
  );
}
