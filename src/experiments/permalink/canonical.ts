/**
 * Canonical URL and Robots Directives for Permalinks.
 * Specification: am-inst-permalink-tape-s677, §7.7, §10.7
 *
 * Rules:
 * - Canonical URLs strip `tape` and presentation parameters.
 * - Tape permalink variants declare `noindex,follow` (or `noindex`) and `rel=canonical` pointing to document URL.
 * - Sitemaps never index tape permalinks or exports.
 */

/**
 * Strips the `tape` parameter (and any transient share query parameters) to obtain the canonical document URL.
 */
export function buildCanonicalDocumentUrl(urlOrPath: string): string {
  if (!urlOrPath) return "/";

  try {
    const isFullUrl = urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://");
    const parsed = isFullUrl
      ? new URL(urlOrPath)
      : new URL(urlOrPath, "https://annus-mirabilis.com");

    // Remove ?tape= and presentation parameters that do not belong in the canonical document URL
    parsed.searchParams.delete("tape");
    parsed.searchParams.delete("view");
    parsed.searchParams.delete("detail");
    parsed.searchParams.delete("lens");
    parsed.searchParams.delete("notation");
    parsed.searchParams.delete("units");

    const search = parsed.searchParams.toString();
    const cleanSearch = search ? `?${search}` : "";

    if (isFullUrl) {
      return `${parsed.origin}${parsed.pathname}${cleanSearch}${parsed.hash}`;
    }
    return `${parsed.pathname}${cleanSearch}${parsed.hash}`;
  } catch {
    // Fallback: simple regex stripping
    return urlOrPath
      .replace(/[?&]tape=[^&#]*/, "")
      .replace(/[?&]view=[^&#]*/, "")
      .replace(/[?&]detail=[^&#]*/, "")
      .replace(/[?&]lens=[^&#]*/, "")
      .replace(/[?&]notation=[^&#]*/, "")
      .replace(/[?&]units=[^&#]*/, "")
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
  }
}

export type RobotsPolicy = Readonly<{
  canonicalUrl: string;
  robots: "index,follow" | "noindex,follow";
  isNoindex: boolean;
}>;

/**
 * Computes robots metadata and canonical URL based on whether a ?tape= parameter is present.
 */
export function getPermalinkRobotsPolicy(
  currentUrlOrPath: string,
  hasTapeParam = false,
): RobotsPolicy {
  const isTapePresent =
    hasTapeParam || currentUrlOrPath.includes("?tape=") || currentUrlOrPath.includes("&tape=");

  const canonicalUrl = buildCanonicalDocumentUrl(currentUrlOrPath);

  if (isTapePresent) {
    return {
      canonicalUrl,
      robots: "noindex,follow",
      isNoindex: true,
    };
  }

  return {
    canonicalUrl,
    robots: "index,follow",
    isNoindex: false,
  };
}

/**
 * Checks whether a URL is excluded from sitemaps.
 * Tape permalinks and export paths are always exempt/excluded.
 */
export function isSitemapExemptUrl(urlOrPath: string): boolean {
  if (!urlOrPath) return false;
  if (urlOrPath.includes("?tape=") || urlOrPath.includes("&tape=")) return true;
  if (urlOrPath.includes("/export") || urlOrPath.endsWith(".json")) return true;
  return false;
}
