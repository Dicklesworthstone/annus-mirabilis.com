import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToReadableStream } from "react-dom/server";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { formatSize } from "../../platform/offline/OfflineChapterLinks.tsx";
import { loadOfflineChapter, loadOfflineManifest } from "../../platform/offline/server.ts";
import { offlineFacts } from "./offlineFacts.ts";
import OfflinePage from "./page.tsx";

/**
 * /offline/ against the real manifest and the real chapter files.
 *
 * The page states figures now, so the question this file answers is whether a reader is told the
 * truth about what they are about to download. Three things can go wrong and each has its own
 * check: the prose can drift from the manifest (so the rendered text is searched for the figures
 * the manifest produced); the manifest can lose a section while the page still says "one for every
 * section" (so the chapters are compared with the SOURCE-BLOCK MANIFESTS on disk, the inputs, and
 * not with the payload the same generator wrote); and the page can attribute a sentence to a
 * chapter that no chapter contains (so the quotation is looked for in a published chapter).
 *
 * Properties, not a census. Chapters are added as sections are published and every assertion below
 * holds at any count, with the non-vacuity guards stated on purpose rather than implied.
 */
const manifest = await loadOfflineManifest();
const facts = offlineFacts(manifest);
const stream = await renderToReadableStream(await OfflinePage());
await stream.allReady;
const html = await new Response(stream).text();
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

/** The site's four papers, whose sections the offline build is expected to cover. */
const papers = loadFirstPages().map((paper) => paper.slug);

/** Section numbers in a paper's source-block manifest: the input the chapters are built from. */
function manifestSections(paper: string): number[] {
  const text = readFileSync(join("content/source-blocks", paper, "manifest.yaml"), "utf8");
  const found = new Set<number>();
  for (const match of text.matchAll(/^\s*-\s*id:\s*"?s(\d+)(?=[-"\s])/gmu))
    found.add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

describe("/offline/", () => {
  test("the manifest this build published is not empty", () => {
    expect(manifest).not.toBeNull();
    expect(facts).not.toBeNull();
    expect(facts?.chapters).toBeGreaterThan(0);
    expect(papers.length).toBeGreaterThan(0);
  });

  test("every figure on the page is the manifest's own, in the same words as the downloads", () => {
    if (!facts) throw new Error("No offline manifest; the guard above says why this matters.");
    const chapters = manifest?.chapters ?? [];
    // Recomputed here from the entries rather than trusting offlineFacts to check itself.
    expect(facts.totalBytes).toBe(chapters.reduce((sum, entry) => sum + entry.bytes, 0));
    expect(facts.totalGzipBytes).toBe(chapters.reduce((sum, entry) => sum + entry.gzipBytes, 0));
    expect(facts.largestBytes).toBe(Math.max(...chapters.map((entry) => entry.bytes)));
    expect(facts.smallestBytes).toBe(Math.min(...chapters.map((entry) => entry.bytes)));
    expect(text).toContain(`There are ${facts.chapters} of them`);
    for (const bytes of [
      facts.smallestBytes,
      facts.largestBytes,
      facts.smallestGzipBytes,
      facts.largestGzipBytes,
      facts.totalBytes,
      facts.totalGzipBytes,
    ])
      expect(text).toContain(formatSize(bytes));
  });

  /*
   * Which half this answers: it sees the page ASSERT coverage the manifest denies, because the
   * two sides are compared rather than both read from the page. It cannot see the page assert
   * coverage while the manifest agrees, which is today's case, so the conditional itself is
   * guarded by the offlineFacts negative below and not by this.
   */
  test("the coverage claim appears only while the manifest supports it", () => {
    expect(text.includes("one for every section of the four papers")).toBe(
      facts?.contiguousSections ?? false,
    );
  });

  test("the chapters cover the sections the source-block manifests hold", () => {
    const chapters = manifest?.chapters ?? [];
    for (const paper of papers) {
      const offered = [...new Set(chapters.filter((e) => e.paper === paper).map((e) => e.section))]
        .map((section) => Number(/^s(\d+)$/u.exec(section)?.[1] ?? Number.NaN))
        .sort((a, b) => a - b);
      const sections = manifestSections(paper);
      // A paper that published no chapter at all is the failure this loop exists to see.
      expect(sections.length).toBeGreaterThan(0);
      expect(offered).toEqual(sections);
    }
  });

  test("the sentence the page attributes to a chapter is in a chapter", async () => {
    const quoted =
      "No simulation, search index, notebook, or private settings are included. Only explicit online links need a connection.";
    expect(text).toContain(quoted);
    const entry = manifest?.chapters[0];
    if (!entry) throw new Error("No chapter to read the quotation back from.");
    const file = entry.path.slice(`/offline/${entry.paper}/`.length);
    const chapter = await loadOfflineChapter(entry.paper, file);
    expect(chapter).not.toBeNull();
    expect(chapter?.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain(quoted);
  });

  test("states what a chapter does not carry, and promises no install", () => {
    expect(text).toContain("What a chapter does not carry");
    expect(text).toContain("The laboratories do not run in it");
    expect(text).toContain("registers no service worker");
    // The installable offline edition is am-plat-installable-offline-oit3 and does not exist.
    expect(text).not.toMatch(
      /\binstall (?:it|the app|this)\b|add to home screen|works offline once/i,
    );
  });
});

describe("offlineFacts", () => {
  test("has nothing to say without a manifest, and refuses a gap in the sections", () => {
    expect(offlineFacts(null)).toBeNull();
    expect(offlineFacts({ chapters: [] } as never)).toBeNull();
    const entry = manifest?.chapters[0];
    if (!entry) throw new Error("No chapter to build the negative from.");
    // s0 and s2 with no s1: the shape a dropped section makes, which must not read as coverage.
    const gapped = {
      chapters: [
        { ...entry, section: "s0" },
        { ...entry, section: "s2" },
      ],
    } as never;
    expect(offlineFacts(gapped)?.contiguousSections).toBe(false);
    const whole = {
      chapters: [
        { ...entry, section: "s0" },
        { ...entry, section: "s1" },
      ],
    } as never;
    expect(offlineFacts(whole)?.contiguousSections).toBe(true);
  });
});
