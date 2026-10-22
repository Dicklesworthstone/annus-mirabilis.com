import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { contentIndex } from "../content/server.ts";
import { loadTeachingTapes } from "../content/teachingTapes.ts";
import { tourIds } from "../content/tours/tours.ts";
import { ROUTE_INDEX } from "../discovery/routeIndex.ts";
import { GUIDED_TOURS } from "../discovery/tours/catalogue.ts";
import { cataloguePapers } from "../equations/printed/catalogue.ts";
import { isSitemapExemptUrl } from "../experiments/permalink/canonical.ts";
import { absoluteUrl, readerSitemapEntries } from "../reader/paperRoutes.ts";
import { tapePath } from "../reader/sitePaths.ts";
import { receiptsByPage } from "./sources/receiptPages.ts";

export const dynamic = "force-static";

/**
 * Pages at a fixed address. Until 2026-09-24 the sitemap listed only home and the papers (85 of
 * the site's pages), so the lessons, the instruments, the discovery routes and every top-level
 * page reached a search engine only by being linked.
 */
export const FIXED_PAGES = [
  "/papers/",
  "/discover/",
  "/discover/brownian-motion/investigate/",
  "/foundations/",
  "/equations/",
  "/instruments/",
  "/kitchen/",
  "/notation/",
  "/connections/",
  // The capstones are listed rather than exempted: each is a page at a fixed address with its own
  // text, reachable by a reader who never passes through the discovery route, and nothing about it
  // is per-device or a duplicate of another canonical. All four are written: mass-energy
  // (am-disc-capstones-infra-3352), brownian-motion (am-disc-capstone-brownian-f8tq), light-quanta
  // (am-disc-capstone-light-quanta-98xc) and special-relativity (am-disc-capstone-relativity-t8hg).
  // The index, added with the page (am-9p8v): /capstones/ was a 404 with these four beneath it.
  "/capstones/",
  "/capstones/brownian-motion/",
  "/capstones/light-quanta/",
  "/capstones/mass-energy/",
  "/capstones/special-relativity/",
  "/tours/",
  "/tapes/",
  "/search/",
  "/sources/",
  "/about/",
  "/accessibility/",
  "/your-data/",
  "/offline/",
] as const;

export type Exemption =
  | { readonly kind: "noindex" }
  | { readonly kind: "canonical"; readonly canonical: string }
  | { readonly kind: "device-only"; readonly why: string };

/**
 * Pages left out on purpose. sitemap.test.ts fails on a page at a fixed address that is neither
 * listed nor exempted here, and it checks every "noindex" and "canonical" claim against the
 * metadata the page exports.
 */
export const NOT_IN_SITEMAP: ReadonlyMap<string, Exemption> = new Map<string, Exemption>([
  ["/lab/", { kind: "canonical", canonical: "/instruments/" }],
  ["/embed/", { kind: "noindex" }],
  /*
   * The full-page search view (am-esis, found by this file's own test going red).
   *
   * It landed with 44ba6524 on 2026-10-05 and nothing added it here, so the "every page at a fixed
   * address is listed or exempted" check has been failing since. The page itself declares
   * `robots: { index: false, follow: true }`: its content is whatever a reader typed, so there is
   * nothing stable for a crawler to index, while `follow` keeps the edition pages it links to
   * reachable. Recording that here is what the test asks for, and it verifies the claim against the
   * page's own metadata rather than taking this line's word for it.
   */
  ["/search/results/", { kind: "noindex" }],
  ["/discover/light-quanta/investigate/", { kind: "noindex" }],
  ["/discover/special-relativity/investigate/", { kind: "noindex" }],
  ["/discover/mass-energy/investigate/", { kind: "noindex" }],
  ["/lab/shelf-fizeau/", { kind: "noindex" }],
  ["/lab/shelf-maxwell-galilean/", { kind: "noindex" }],
  ["/lab/shelf-michelson-morley/", { kind: "noindex" }],
  [
    "/notebook/",
    {
      kind: "device-only",
      why: "it shows the notes a reader saved on their own device, so a crawler finds it empty",
    },
  ],
]);

/**
 * Every instrument page under src/app/lab, including an instrument's own pages
 * (/lab/lq-08/data/). Dynamic and private segments are not addresses and are skipped.
 */
export function labPaths(root: string = process.cwd()): string[] {
  const paths: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || /^[[_]/.test(entry.name)) continue;
      const path = `${prefix}${entry.name}/`;
      if (existsSync(join(dir, entry.name, "page.tsx"))) paths.push(path);
      walk(join(dir, entry.name), path);
    }
  };
  walk(join(root, "src/app/lab"), "/lab/");
  return paths.filter((path) => !NOT_IN_SITEMAP.has(path)).sort();
}

/**
 * Canonical URLs only. Papers: each paper, its sections, and the German and English face pages.
 *
 * WHY THOSE TWO FACES AND NOT THE OTHER FIVE, stated precisely because the old wording here said
 * "query-parameter faces and other fallbacks are omitted" and that describes something else:
 * `parallel`, `gloss`, `results`, `split` and `facsimile` are real built routes that return 200,
 * not `?view=` fallbacks. They are omitted on a canonical-URL rule, not for being unreachable.
 *
 * German and English are listed because they are LANGUAGE ALTERNATES of each other, and each
 * entry carries the `hreflang` pair to say so (`readerSitemapEntries`, paperRoutes.ts). The other
 * five are alternate PRESENTATIONS of text that is already canonical somewhere in this sitemap:
 * `parallel` sets the two language faces side by side, `gloss` derives from the same sentences,
 * `results` cards claims already on the paper page, `split` is a chooser, and `facsimile` is a
 * viewer for a PDF listed on the sources page. Listing them would offer a crawler several URLs
 * for one text, which is what a canonical URL is for avoiding.
 *
 * The exclusion is asserted, face by face, in sitemap.test.ts -- all five, not a sample, so a
 * later change that starts emitting one of them goes red here rather than silently.
 *
 * Then the fixed pages, the four discovery routes, the foundation lessons, the instruments and
 * each paper's sources page.
 *
 * Tape permalinks and export paths are strictly sitemap-exempt (am-6t51 / am-inst-permalink-tape-s677).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const papers = await readerSitemapEntries();
  const lessons = (await contentIndex()).payloads
    .filter((payload) => payload.kind === "foundation")
    .map((payload) => `/foundations/${payload.id}/`)
    .sort();
  // One receipt page per paper; the 1911 correction is a section of the dissertation's page.
  const sources = [...receiptsByPage().keys()].map((paper) => `/sources/${paper}/`).sort();
  const paths = [
    ...FIXED_PAGES,
    ...ROUTE_INDEX.map((route) => `/discover/${route.slug}/`),
    ...lessons,
    // One catalogue per paper that has explained equations (am-9p8v). They sit under a dynamic
    // segment, so sitemap.test.ts's fixed-address walk cannot see them: left out here they would
    // be four pages a crawler is never told about, each listing between 40 and 122 explanations.
    ...cataloguePapers().map(({ paper }) => `/equations/${paper}/`),
    ...labPaths(),
    ...sources,
    // One page per authored teaching tape (am-2rl9). They are the only address at which
    // these records reach a reader, so leaving them out would hide the whole layer from search.
    ...loadTeachingTapes()
      .tapes.map((tape) => tapePath(tape.tapeId))
      .sort(),
    // EVERY GUIDED READING PATH, FROM BOTH SOURCES. Measured on the live sitemap 2026-09-28: /tours/
    // appeared ONCE, the index, while all five path pages answered 200. A page absent from the
    // sitemap is a page a search engine is not told about, and these are the routes the site
    // recommends.
    //
    // Both sources, because /tours/ renders both and listing one would cover four of five: the YAML
    // records through tourIds, and the GUIDED_TOURS catalogue in code. Indexing the catalogue alone
    // is the error this repository has now made in four places.
    ...[...tourIds(process.cwd()), ...GUIDED_TOURS.map((tour) => tour.id)]
      .map((id) => `/tours/${id}/`)
      .sort(),
  ];
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/") },
    ...papers,
    ...paths.map((path) => ({ url: absoluteUrl(path) })),
  ];
  return entries.filter((entry) => !isSitemapExemptUrl(entry.url));
}
