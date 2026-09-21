"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initTikTokPixel, tiktokPageview, TIKTOK_PIXEL_ID } from "@/lib/tiktok-pixel";

/** Sobe o Pixel do TikTok e registra pageview a cada troca de rota. */
export default function TikTokPixel() {
  const pathname = usePathname();

  useEffect(() => {
    initTikTokPixel();
  }, []);

  useEffect(() => {
    if (!TIKTOK_PIXEL_ID || !pathname) return;
    tiktokPageview();
  }, [pathname]);

  return null;
}
