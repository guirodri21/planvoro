import { supabaseAdmin } from "./supabase";

export type PlaceInfo = {
  verified: boolean;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown> | null;
};

const UNVERIFIED: PlaceInfo = { verified: false, lat: null, lng: null, data: null };

/**
 * Provedor de verificacao de lugares.
 *
 *   PLACES_PROVIDER=nominatim  -> OpenStreetMap, gratuito e sem cartao (padrao)
 *   PLACES_PROVIDER=google     -> Google Places, mais preciso, exige cartao
 *   PLACES_PROVIDER=off        -> desliga a verificacao
 *
 * Em qualquer provedor o cache no Postgres vem primeiro. Isso nao e otimizacao
 * opcional: a politica do Nominatim EXIGE cache, e no Google e o que segura a conta.
 */
const PROVIDER = (process.env.PLACES_PROVIDER ?? "nominatim").toLowerCase();

// O Nominatim permite no maximo 1 requisicao por segundo e exige um
// User-Agent que identifique a aplicacao. Sem isso o IP e bloqueado.
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ?? "Planvoro/0.1 (contato: seu-email@exemplo.com)";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const PLACE_LOOKUP_TIMEOUT_MS = Number(process.env.PLACE_LOOKUP_TIMEOUT_MS ?? 3500);

let lastNominatimCall = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Serializa as chamadas ao Nominatim e garante o intervalo minimo entre elas. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function verifyPlace(query: string): Promise<PlaceInfo> {
  if (!query || PROVIDER === "off") return UNVERIFIED;

  const db = supabaseAdmin();
  const cacheKey = `${PROVIDER}:${query}`;

  const cached = await db
    .from("places_cache")
    .select("place_data")
    .eq("place_query", cacheKey)
    .maybeSingle();

  if (cached.data?.place_data) {
    const stored = cached.data.place_data as Record<string, unknown>;
    // Cache negativo: lugar que ja falhou nao e consultado de novo.
    if (stored.__not_found) return UNVERIFIED;
    return PROVIDER === "google" ? fromGoogle(stored) : fromNominatim(stored);
  }

  const info =
    PROVIDER === "google" ? await lookupGoogle(query) : await lookupNominatim(query);

  await db.from("places_cache").upsert({
    place_query: cacheKey,
    place_data: info.data ?? { __not_found: true },
  });

  return info;
}

// ------------------------------------------------------- OpenStreetMap
async function lookupNominatim(query: string): Promise<PlaceInfo> {
  try {
    return await throttled(async () => {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=" +
        encodeURIComponent(query);

      const res = await fetch(url, {
        headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(PLACE_LOOKUP_TIMEOUT_MS),
      });
      if (!res.ok) return UNVERIFIED;

      const arr = (await res.json()) as Record<string, unknown>[];
      const hit = arr?.[0];
      if (!hit) return UNVERIFIED;
      return fromNominatim(hit);
    });
  } catch {
    return UNVERIFIED;
  }
}

function fromNominatim(hit: Record<string, unknown>): PlaceInfo {
  const lat = hit.lat ? Number(hit.lat) : null;
  const lng = hit.lon ? Number(hit.lon) : null;
  return { verified: true, lat, lng, data: hit };
}

// -------------------------------------------------------- Google Places
async function lookupGoogle(query: string): Promise<PlaceInfo> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return UNVERIFIED;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(PLACE_LOOKUP_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // So campos baratos. Um campo caro (ex: rating) reclassifica
        // a chamada inteira para a faixa Enterprise.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: "pt-BR" }),
    });
    if (!res.ok) return UNVERIFIED;

    const json = (await res.json()) as { places?: Record<string, unknown>[] };
    const place = json.places?.[0];
    if (!place) return UNVERIFIED;
    return fromGoogle(place);
  } catch {
    return UNVERIFIED;
  }
}

function fromGoogle(place: Record<string, unknown>): PlaceInfo {
  const loc = place.location as { latitude?: number; longitude?: number } | undefined;
  return {
    verified: true,
    lat: loc?.latitude ?? null,
    lng: loc?.longitude ?? null,
    data: place,
  };
}
