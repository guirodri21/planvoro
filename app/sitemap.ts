import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";


export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paginasFixas: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1, changeFrequency: "weekly" },
    { url: `${SITE_URL}/nova`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${SITE_URL}/experimente`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/termos`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/privacidade`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/contato`, priority: 0.4, changeFrequency: "yearly" },
  ];

  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("trips")
      .select("slug, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(5000);

    const roteiros: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
      url: `${SITE_URL}/r/${t.slug}`,
      lastModified: new Date(t.created_at),
      priority: 0.6,
      changeFrequency: "monthly" as const,
    }));

    return [...paginasFixas, ...roteiros];
  } catch {
    // Sem chaves configuradas, o build não pode quebrar por causa do sitemap.
    return paginasFixas;
  }
}
