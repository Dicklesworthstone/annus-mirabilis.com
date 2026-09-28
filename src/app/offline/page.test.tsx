import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToReadableStream } from "react-dom/server";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { formatSize } from "../../platform/offline/OfflineChapterLinks.tsx";
import { loadOfflineChapter } from "../../platform/offline/server.ts";
import { offlinePublication } from "../../testing/offlinePublication.ts";
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
/*
 * WHAT THIS RUN CAN DECIDE. `loadOfflineManifest` refuses a chapter set that is stale against the
 * content this tree compiled, which is right and stays: a stale set must never be served. But that
 * condition is routinely true in this shared checkout, for an hour at a time, whenever a peer runs
 * prepare:content without prepare:offline, and this file used to fail on it as though the page
 * were wrong. It is an environment condition and is now named as one: offlinePublication decides
 * which of the two propositions this run is in a position to judge, and its sentence travels in
 * the skipped block's own name so the runner prints the reason rather than swallowing it. The test
 * lane runs prepare:offline first, so the lane always takes the asserting branch.
 */
const publication = await offlinePublication();
/*
 * The reason is written to the console because BUN PRINTS NEITHER A SKIPPED BLOCK'S NAME NOR A
 * PASSING TEST'S at default verbosity: measured on 1.4.0, a run of this file with the condition
 * unmet printed "3 pass, 6 skip, 0 fail" and nothing else, so carrying the reason in the describe's
 * name, which is what this file did first, was a silent skip wearing a label. The line below is the
 * only channel the runner shows by default, and the test named for it asserts the line is worth
 * reading.
 */
if (!publication.current)
  console.warn(
    `/offline/: the published-chapter assertions did not run. ${publication.reason}. ` +
      "Run the test lane, which prepares the chapters first; do not run prepare:offline by hand " +
      "in a shared checkout.",
  );
const manifest = publication.manifest;
const facts = offlineFacts(manifest);
const html = publication.current ? await renderPage() : "";
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

async function renderPage(): Promise<string> {
  const stream = await renderToReadableStream(await OfflinePage());
  await stream.allReady;
  return await new Response(stream).text();
}

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

describe.skipIf(!publication.current)(
  `/offline/ against this tree's published chapters [${publication.reason}]`,
  () => {
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
        const offered = [
          ...new Set(chapters.filter((e) => e.paper === paper).map((e) => e.section)),
        ]
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
  },
);

/*
 * The fact module on records written here, which is the half of this file that runs whatever state
 * the tree's generated directory is in. It is deliberately not built from an entry borrowed out of
 * the real manifest: doing that made the block above's condition this block's condition too, so a
 * stale chapter set left nothing in this file running at all.
 */
const chapter = (paper: string, section: string, bytes: number, gzipBytes: number) =>
  ({
    paper,
    section,
    title: `${paper} ${section}`,
    path: `/offline/${paper}/${section}-${"a".repeat(64)}.html`,
    sha256: "a".repeat(64),
    contentRevision: "b".repeat(64),
    bytes,
    gzipBytes,
  }) as never;

describe.skipIf(publication.current)("what this run could not decide", () => {
  test("names the condition, both digests and the remedy, rather than skipping quietly", () => {
    // The reason travels to the console above; this is the check that it says something.
    expect(publication.current).toBe(false);
    expect(publication.reason).toMatch(/offline [0-9a-f(][^ ]* vs content [0-9a-f(]/);
    expect(publication.reason).toMatch(/stale|no offline chapters are published/);
    expect(publication.manifest).toBeNull();
  });
});

describe("offlineFacts", () => {
  test("has nothing to say without a manifest", () => {
    expect(offlineFacts(null)).toBeNull();
    expect(offlineFacts({ chapters: [] } as never)).toBeNull();
  });

  test("sums and extremes are the chapters' own, per field", () => {
    const facts = offlineFacts({
      chapters: [chapter("light-quanta", "s0", 400, 100), chapter("light-quanta", "s1", 700, 250)],
    } as never);
    expect(facts).toEqual({
      chapters: 2,
      papers: 1,
      totalBytes: 1100,
      totalGzipBytes: 350,
      smallestBytes: 400,
      largestBytes: 700,
      smallestGzipBytes: 100,
      largestGzipBytes: 250,
      contiguousSections: true,
    });
    // Bytes and compressed bytes are separate fields and are never crossed: a chapter that is the
    // largest on disk need not be the largest over the wire.
    const crossed = offlineFacts({
      chapters: [chapter("x", "s0", 900, 100), chapter("x", "s1", 400, 300)],
    } as never);
    expect([crossed?.largestBytes, crossed?.largestGzipBytes]).toEqual([900, 300]);
  });

  test("refuses a gap in the sections, and counts each paper separately", () => {
    // s0 and s2 with no s1: the shape a dropped section makes, which must not read as coverage.
    const gapped = {
      chapters: [chapter("light-quanta", "s0", 1, 1), chapter("light-quanta", "s2", 1, 1)],
    } as never;
    expect(offlineFacts(gapped)?.contiguousSections).toBe(false);
    const whole = {
      chapters: [chapter("light-quanta", "s0", 1, 1), chapter("light-quanta", "s1", 1, 1)],
    } as never;
    expect(offlineFacts(whole)?.contiguousSections).toBe(true);
    // One paper's s0 does not fill another paper's missing s0.
    const across = {
      chapters: [chapter("light-quanta", "s0", 1, 1), chapter("mass-energy", "s1", 1, 1)],
    } as never;
    expect(offlineFacts(across)?.contiguousSections).toBe(false);
    expect(offlineFacts(across)?.papers).toBe(2);
    // A section id this pattern cannot read is not silently counted as coverage.
    const named = {
      chapters: [chapter("light-quanta", "part-1", 1, 1)],
    } as never;
    expect(offlineFacts(named)?.contiguousSections).toBe(false);
  });
});
