import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://planvoro.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paginasFixas: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1, changeFrequency: "weekly" },
    { url: `${BASE}/nova`, priority: 0.8, changeFrequency: "monthly" },
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
      url: `${BASE}/r/${t.slug}`,
      lastModified: new Date(t.created_at),
      priority: 0.6,
      changeFrequency: "monthly" as const,
    }));

    return [...paginasFixas, ...roteiros];
  } catch {
    // Sem chaves configuradas o build nao pode quebrar por causa do sitemap.
    return paginasFixas;
  }
}
