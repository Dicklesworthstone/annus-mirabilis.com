/**
 * The site's routes and the files its pages ask for, read from a static build. Shared by the
 * edition export (scripts/app/export-edition.ts), which refuses an edition that would need a server
 * or lacks a file a page asks for, and by the parity check (scripts/app/edition-parity.ts).
 */

/** Page routes a sitemap lists, as paths ("/papers/brownian-motion/"). */
export function sitemapRoutes(xml: string, origin: string): string[] {
  const routes: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const loc = match[1] ?? "";
    try {
      const url = new URL(loc);
      if (url.origin === new URL(origin).origin) routes.push(url.pathname);
    } catch {
      /* Not a URL: not a route. */
    }
  }
  return [...new Set(routes)].sort();
}

/** The edition's page for a site route: "/x/" is "x/index.html"; "/x" is taken as "/x/". */
export function editionPageFor(route: string): string {
  const withSlash = route.endsWith("/") ? route : `${route}/`;
  return withSlash === "/" ? "index.html" : `${withSlash.slice(1)}index.html`;
}

/** The kinds of file a page loads by src or href, as opposed to a link to another page. */
const ASSET = /\.(?:js|mjs|css|woff2?|png|svg|webp|jpe?g|gif|ico|wasm|json|pdf|webmanifest)$/i;

/**
 * The local files a page's HTML asks for by src or href, as build paths. Each is decoded once, as
 * the app's origin decodes a request path (EditionCatalog.candidatePaths): the build writes
 * `[experiment]` into a file name and `%5Bexperiment%5D` into the page. A reference that does not
 * decode is kept as written, so it is reported rather than dropped.
 */
export function pageAssetReferences(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const raw = match[1] ?? "";
    if (!ASSET.test(raw)) continue;
    let path = raw.slice(1);
    try {
      path = decodeURIComponent(path);
    } catch {
      /* Kept as written. */
    }
    found.add(path);
  }
  return [...found].sort();
}
