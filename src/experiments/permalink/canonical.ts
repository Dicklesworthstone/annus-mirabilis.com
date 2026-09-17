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

    // Drop EVERY query parameter. A canonical identifies the document, and no
    // query parameter on this site forms part of that identity. This was a
    // denylist (tape/view/detail/lens/notation/units), which leaked by default:
    // `note` survived it and reached the canonical, publishing a private reader
    // note identifier to crawlers. An allowlist of nothing cannot leak.
    const cleanSearch = "";

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
