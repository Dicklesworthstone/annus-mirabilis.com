import type { MetadataRoute } from "next";

// Emit the request-independent crawl policy alongside the static site.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://annus-mirabilis.com/sitemap.xml",
  };
}
