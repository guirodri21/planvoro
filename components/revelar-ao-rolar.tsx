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

    // Blocos que entram depois (resultado gerado na hora, por exemplo)
    // tambem precisam ser observados — senao ficariam escondidos para sempre.
    const vigia = new MutationObserver((mudancas) => {
      for (const mudanca of mudancas) {
        mudanca.addedNodes.forEach((no) => {
          if (!(no instanceof HTMLElement)) return;
          const novos = [
            ...(no.matches("[data-revelar]") ? [no] : []),
            ...Array.from(no.querySelectorAll<HTMLElement>("[data-revelar]")),
          ];
          for (const novo of novos) {
            if (novo.classList.contains("visivel")) continue;
            const atraso = Number(novo.dataset.revelarAtraso ?? 0);
            if (atraso) novo.style.setProperty("--revelar-atraso", `${atraso * 80}ms`);
            observador.observe(novo);
          }
        });
      }
    });
    vigia.observe(document.body, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      vigia.disconnect();
      document.documentElement.classList.remove("revelar-pronto");
    };
  }, []);

  return null;
}
