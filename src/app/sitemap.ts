import type { MetadataRoute } from "next";

/**
 * Empty-corpus baseline: lists only the canonical home URL. The real route
 * inventory (papers, discover, lab) is built from the canonical-URL
 * registry by am-route-canonical-registry-57b6, which depends on this bead.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://annus-mirabilis.com/" }];
}
