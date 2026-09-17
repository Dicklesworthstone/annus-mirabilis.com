import type { MetadataRoute } from "next";
import { readerSitemapEntries } from "../reader/paperRoutes.ts";

export const dynamic = "force-static";

/**
 * Canonical URLs only: home, compiled papers, their sections, and the German
 * and English face pages. Query-parameter faces and other fallbacks are omitted
 * (am-read-shell-routes-3ua).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const papers = await readerSitemapEntries();
  return [{ url: "https://annus-mirabilis.com/" }, ...papers];
}
