"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initMetaPixel, metaPageview, META_PIXEL_ID } from "@/lib/meta-pixel";

/** Sobe o Pixel e registra pageview a cada troca de rota. */
export default function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID || !pathname) return;
    metaPageview();
  }, [pathname]);

  return null;
}
