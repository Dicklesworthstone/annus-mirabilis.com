import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { contentIndex } from "../content/server.ts";
import { ROUTE_INDEX } from "../discovery/routeIndex.ts";
import { isSitemapExemptUrl } from "../experiments/permalink/canonical.ts";
import { absoluteUrl, readerSitemapEntries } from "../reader/paperRoutes.ts";
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
  "/instruments/",
  "/kitchen/",
  "/notation/",
  "/connections/",
  "/tours/",
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
 * Canonical URLs only. Papers: each paper, its sections, and the German and English face pages;
 * query-parameter faces and other fallbacks are omitted (am-read-shell-routes-3ua). Then the
 * fixed pages, the four discovery routes, the foundation lessons, the instruments and each
 * paper's sources page.
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
    ...labPaths(),
    ...sources,
  ];
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/") },
    ...papers,
    ...paths.map((path) => ({ url: absoluteUrl(path) })),
  ];
  return entries.filter((entry) => !isSitemapExemptUrl(entry.url));
}
