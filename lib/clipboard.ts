/**
 * Copia texto para a area de transferencia.
 *
 * `navigator.clipboard` nao existe fora de HTTPS e falha em alguns
 * navegadores embutidos (o do Instagram, o do proprio WhatsApp). Nesses
 * casos o botao "Copiar" nao fazia nada e nao dizia nada. O caminho antigo
 * com textarea escondido cobre quase todos eles.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai para o caminho antigo
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    if (!ok) window.prompt("Copie o texto abaixo:", texto);
    return ok;
  } catch {
    window.prompt("Copie o texto abaixo:", texto);
    return false;
  }
}
