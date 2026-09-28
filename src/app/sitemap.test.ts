import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Metadata } from "next";
import { contentIndex } from "../content/server.ts";
import { tourIds } from "../content/tours/tours.ts";
import { GUIDED_TOURS } from "../discovery/tours/catalogue.ts";
import { isSitemapExemptUrl } from "../experiments/permalink/canonical.ts";
import {
  absoluteUrl,
  faceFallbackPath,
  listReadablePapers,
  paperPath,
} from "../reader/paperRoutes.ts";
import { staticHostPath } from "../reader/sitePaths.ts";
import sitemap, { labPaths, NOT_IN_SITEMAP } from "./sitemap.ts";

const APP = import.meta.dirname;

/** Every page at a fixed address: a page.tsx under src/app with no dynamic or private segment. */
function fixedAddressPages(): string[] {
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || /^[[_]/.test(entry.name)) continue;
      const full = join(dir, entry.name);
      if (existsSync(join(full, "page.tsx"))) pages.push(`/${relative(APP, full)}/`);
      walk(full);
    }
  };
  walk(APP);
  return pages.sort();
}

async function metadataOf(path: string): Promise<Metadata | undefined> {
  const page = (await import(join(APP, path, "page.tsx"))) as {
    metadata?: Metadata;
    generateMetadata?: (props: { params: Promise<object> }) => Promise<Metadata> | Metadata;
  };
  return page.metadata ?? (await page.generateMetadata?.({ params: Promise.resolve({}) }));
}

function isNoindex(metadata: Metadata | undefined): boolean {
  const robots = metadata?.robots;
  if (!robots) return false;
  return typeof robots === "string" ? /noindex/.test(robots) : robots.index === false;
}

function canonicalPath(metadata: Metadata | undefined): string | undefined {
  const canonical = metadata?.alternates?.canonical;
  if (!canonical) return undefined;
  const raw = typeof canonical === "string" || canonical instanceof URL ? canonical : canonical.url;
  return new URL(raw, "https://annus-mirabilis.com").pathname;
}

const SITE_ORIGIN = "https://annus-mirabilis.com";
/** The path part of an absolute site URL, for comparing a listed URL against the shape rule. */
function pathOf(url: string): string {
  return url.startsWith(SITE_ORIGIN) ? url.slice(SITE_ORIGIN.length) : url;
}

describe("sitemap", () => {
  test("lists home, compiled papers, sections, and German/English faces", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls[0]).toBe("https://annus-mirabilis.com/");
    const papers = await listReadablePapers();
    expect(papers.length).toBeGreaterThan(0);
    for (const paperId of papers) {
      expect(urls).toContain(absoluteUrl(paperPath(paperId)));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "german")));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "english")));
      expect(urls).not.toContain(absoluteUrl(faceFallbackPath(paperId, "results")));
    }
    expect(urls.some((url) => url.includes("ap-17-549"))).toBe(false);
  });

  test("strictly filters out tape permalinks and export paths via isSitemapExemptUrl", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(isSitemapExemptUrl(entry.url)).toBe(false);
      expect(entry.url).not.toContain("tape=");
      expect(entry.url).not.toContain("/export");
      expect(entry.url.endsWith(".json")).toBe(false);
    }
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/lab/bm-01/?tape=abc123")).toBe(true);
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/lab/bm-01?x=1&tape=abc123")).toBe(true);
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/export/data.json")).toBe(true);
  });

  test("every page at a fixed address is listed, or left out with a recorded reason", async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    const pages = fixedAddressPages();
    // Denominator: the walk found the pages, so an empty result cannot pass as a clean one.
    expect(pages.length).toBeGreaterThan(50);
    const unplaced = pages.filter((p) => !urls.has(absoluteUrl(p)) && !NOT_IN_SITEMAP.has(p));
    expect(unplaced).toEqual([]);
    const listedAndExempt = pages.filter((p) => urls.has(absoluteUrl(p)) && NOT_IN_SITEMAP.has(p));
    expect(listedAndExempt).toEqual([]);
    // An exemption for a page that no longer exists is stale.
    expect([...NOT_IN_SITEMAP.keys()].filter((p) => !pages.includes(p))).toEqual([]);
  });

  test("no listed page is noindex or canonical elsewhere, and every exemption says so truly", async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    const listed = fixedAddressPages().filter((p) => urls.has(absoluteUrl(p)));
    expect(listed.length).toBeGreaterThan(50);
    const wrong: string[] = [];
    for (const path of listed) {
      const metadata = await metadataOf(path);
      if (isNoindex(metadata)) wrong.push(`${path} is noindex`);
      const canonical = canonicalPath(metadata);
      if (canonical && canonical !== path) wrong.push(`${path} names ${canonical} as canonical`);
    }
    for (const [path, exemption] of NOT_IN_SITEMAP) {
      const metadata = await metadataOf(path);
      if (exemption.kind === "noindex" && !isNoindex(metadata))
        wrong.push(`${path} is exempted as noindex and is not`);
      if (exemption.kind === "canonical") {
        if (canonicalPath(metadata) !== exemption.canonical)
          wrong.push(`${path} does not name ${exemption.canonical} as canonical`);
        if (!urls.has(absoluteUrl(exemption.canonical)))
          wrong.push(`${path}'s canonical ${exemption.canonical} is not listed`);
      }
      if (exemption.kind === "device-only" && !exemption.why) wrong.push(`${path} has no reason`);
    }
    expect(wrong).toEqual([]);
  }, 120_000);

  test("lists every foundation lesson and every instrument, once each", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    // Every listed URL is in the form the HOST answers 200 for, which is the trailing slash
    // except where the last segment contains a dot (am-tpzn, src/reader/sitePaths.ts). Checking
    // each URL against the rule catches a literal in FIXED_PAGES that got it wrong either way.
    expect(urls.filter((url) => url !== `${SITE_ORIGIN}${staticHostPath(pathOf(url))}`)).toEqual(
      [],
    );
    // EVERY GUIDED READING PATH, FROM BOTH SOURCES. The live sitemap listed /tours/ once, the
    // index, while all five path pages answered 200. Both sources are required non-empty so that
    // listing only the code catalogue, which covers four of the five, cannot pass.
    const yamlTours = tourIds(process.cwd());
    const codeTours = GUIDED_TOURS.map((tour) => tour.id);
    expect(yamlTours.length).toBeGreaterThan(0);
    expect(codeTours.length).toBeGreaterThan(2);
    for (const id of [...yamlTours, ...codeTours])
      expect(urls).toContain(absoluteUrl(`/tours/${id}/`));

    // And the one case the rule exists for, written out, because the line above would be satisfied
    // by any rule the sitemap happened to share with the helper.
    expect(urls).toContain("https://annus-mirabilis.com/tapes/the-boost-to-0.6c");
    expect(urls).not.toContain("https://annus-mirabilis.com/tapes/the-boost-to-0.6c/");
    const lessons = (await contentIndex()).payloads.filter((p) => p.kind === "foundation");
    expect(lessons.length).toBeGreaterThan(0);
    for (const lesson of lessons) expect(urls).toContain(absoluteUrl(`/foundations/${lesson.id}/`));
    const labs = labPaths();
    expect(labs.length).toBeGreaterThan(30);
    for (const lab of labs) expect(urls).toContain(absoluteUrl(lab));
    expect(urls).not.toContain(absoluteUrl("/lab/"));
    expect(urls).not.toContain(absoluteUrl("/lab/shelf-fizeau/"));
  });
});
