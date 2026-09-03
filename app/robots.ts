import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";


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
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
