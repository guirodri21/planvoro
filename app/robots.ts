import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro-app.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/r/"],
        // A área de trabalho da viagem é privada do grupo: não indexar.
        disallow: ["/v/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
