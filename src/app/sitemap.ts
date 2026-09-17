import type { MetadataRoute } from "next";
import { isSitemapExemptUrl } from "../experiments/permalink/canonical.ts";
import { readerSitemapEntries } from "../reader/paperRoutes.ts";

export const dynamic = "force-static";

/**
 * Canonical URLs only: home, compiled papers, their sections, and the German
 * and English face pages. Query-parameter faces and other fallbacks are omitted
 * (am-read-shell-routes-3ua).
 *
 * Tape permalinks and export paths are strictly sitemap-exempt (am-6t51 / am-inst-permalink-tape-s677).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const papers = await readerSitemapEntries();
  const entries: MetadataRoute.Sitemap = [{ url: "https://annus-mirabilis.com/" }, ...papers];
  return entries.filter((entry) => !isSitemapExemptUrl(entry.url));
}
