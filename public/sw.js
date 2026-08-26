/**
 * Service worker do Planvoro.
 *
 * Objetivo unico: durante a viagem, sem sinal, a pessoa consegue abrir o
 * que ja tinha visto — roteiro, Cofre, checklist. Escrever continua
 * exigindo conexao, e o app avisa quando esta offline.
 *
 * Estrategias:
 *   - Navegacao e dados da viagem: rede primeiro, cache como rede de
 *     seguranca. Assim o conteudo fica sempre fresco quando ha sinal, e
 *     so cai para o cache quando a rede falha de verdade.
 *   - Estaticos do build: cache primeiro. Sao imutaveis (tem hash no
 *     nome), entao rede toda vez seria desperdicio.
 *
 * O que NUNCA e cacheado: qualquer coisa que nao seja GET, as rotas de
 * autenticacao e os anexos do Cofre. Anexo vem por link assinado que
 * expira em dois minutos; guardar isso no disco do navegador vazaria
 * documento de reserva para depois da sessao.
 */

const VERSION = "planvoro-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isTripData(url) {
  return url.pathname.startsWith("/api/trips/") || url.pathname === "/api/me/dashboard";
}

function isCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/auth")) return false;
  // Link assinado de anexo expira em minutos: guardar seria vazamento.
  if (url.pathname.includes("/attachments/")) return false;
  return true;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const fallback = await caches.match(OFFLINE_URL);
      if (fallback) return fallback;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!isCacheable(event.request, url)) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, SHELL_CACHE));
    return;
  }

  if (isTripData(url)) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
  }
});
