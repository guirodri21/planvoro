import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/r/"],
        // A area de trabalho da viagem e privada do grupo: nao indexar.
        disallow: ["/v/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
