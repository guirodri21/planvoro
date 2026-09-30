"use client";

import { useEffect } from "react";

/**
 * Faz os blocos marcados com `data-revelar` aparecerem conforme a pessoa
 * rola a pagina.
 *
 * Tres cuidados:
 * - Sem JavaScript (e para o rastreador do Google) tudo aparece normal: o
 *   CSS so esconde depois que este componente marca <html class="revelar-pronto">.
 * - O que ja esta na tela ao abrir e marcado visivel antes de esconder o
 *   resto, para nada piscar no primeiro quadro.
 * - Quem pediu menos movimento no sistema ve tudo parado (ver o CSS).
 *
 * `data-revelar-atraso="2"` escalona irmaos (80ms cada).
 */
export function RevelarAoRolar() {
  useEffect(() => {
    const alvos = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]"));
    if (!alvos.length) return;

    for (const alvo of alvos) {
      const atraso = Number(alvo.dataset.revelarAtraso ?? 0);
      if (atraso) alvo.style.setProperty("--revelar-atraso", `${atraso * 80}ms`);
    }

    if (typeof IntersectionObserver === "undefined") {
      alvos.forEach((alvo) => alvo.classList.add("visivel"));
      return;
    }

    const altura = window.innerHeight;
    for (const alvo of alvos) {
      if (alvo.getBoundingClientRect().top < altura) alvo.classList.add("visivel");
    }
    document.documentElement.classList.add("revelar-pronto");

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("visivel");
            observador.unobserve(entrada.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    alvos.filter((alvo) => !alvo.classList.contains("visivel")).forEach((alvo) => observador.observe(alvo));

    return () => {
      observador.disconnect();
      document.documentElement.classList.remove("revelar-pronto");
    };
  }, []);

  return null;
}
