/**
 * EVERY INTERNAL FRAGMENT LINK IN THE BUILT SITE LANDS ON AN ELEMENT THAT EXISTS.
 *
 * `scripts/anchorTargets.ts` asks this of a DEPLOYED CANDIDATE, deliberately and correctly: it is a
 * candidate check, and its own criterion is that every byte comes from the deployment rather than
 * from a local directory. The consequence is that between deploys nothing asks it at all. The last
 * release record is dated 2026-10-02, so on 2026-10-18 this class had gone unchecked for sixteen
 * days, and a sweep of `out/` found 24 broken links waiting for the next deploy to discover.
 *
 * So this is the same question asked of the local build, which is the artifact a reader will get.
 * It is not a duplicate of the candidate check and does not replace it: a candidate check can catch
 * a link the deployment serves differently from the build, and this one catches a link the moment it
 * is built. AGENTS.md: "keep a version of its proof in a DIFFERENT lane from the one it controls."
 *
 * WHAT WENT WRONG IN THE FIRST SWEEP, both worth keeping in the code because both read as findings:
 *
 *  - it read a DIRECTORY named `index.html` under `out/_next/static/chunks/`, and crashed. The build
 *    chunks are not pages and are skipped by name;
 *  - it reported 632 false positives by resolving `#page=29` on `/papers/pdfs/ap-17-891.pdf`
 *    against the PDF's bytes. A fragment on a non-HTML target is not an element id: on a PDF it is
 *    the viewer's open parameter, and it is correct. 632 of 673 "findings" were this, which is what
 *    a sweep looks like when its population is wrong rather than its logic.
 *
 * The real remainder was one defect class, repaired in the same batch: the results face's section
 * filter emitted `href="#section-<anchor>"` where the page carries `id="result-<id>"`.
 */

import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { reportPopulation } from "../../scripts/gate-census/population.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "out");

const HREF = /href="([^"]+)"/g;
const ID_ATTR = /\sid="([^"]+)"/g;
const NAME_ATTR = /\sname="([^"]+)"/g;

/**
 * Targets whose fragment is NOT an element id. A PDF's `#page=29` is the viewer's open parameter;
 * the others are data a fragment would address by some other convention, or not at all.
 */
const NON_HTML = /\.(pdf|txt|json|xml|csv|wasm|png|svg|jpe?g|webp|woff2?|ico|map)$/i;

export type DanglingFragment = Readonly<{
  /** The built page that carries the link, relative to `out/`. */
  from: string;
  href: string;
  reason: string;
}>;

export type FragmentSweep = Readonly<{
  pages: readonly string[];
  resolved: number;
  dangling: readonly DanglingFragment[];
}>;

function htmlPagesUnder(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      // `_next` holds build chunks, and one of its directories is itself named index.html.
      if (entry.isDirectory()) {
        if (entry.name !== "_next") walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".html")) found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

/** The built file a path would be served from, taking the path exactly as the document wrote it. */
function pageForPath(root: string, path: string): string | undefined {
  const clean = path.split("?")[0] ?? "";
  if (clean === "" || clean === "/") {
    const index = join(root, "index.html");
    return isFile(index) ? index : undefined;
  }
  const rel = clean.replace(/^\/+/, "").replace(/\/+$/, "");
  // A dotted tail is NOT treated as a file extension: `/tapes/the-boost-to-0.6c` is a route, and a
  // trailing-slash rule that guessed otherwise cost a false finding in anchorTargets.ts.
  for (const candidate of [
    join(root, rel),
    join(root, rel, "index.html"),
    join(root, `${rel}.html`),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function identifiersOf(text: string): Set<string> {
  const ids = new Set<string>();
  for (const match of text.matchAll(ID_ATTR)) if (match[1]) ids.add(match[1]);
  for (const match of text.matchAll(NAME_ATTR)) if (match[1]) ids.add(match[1]);
  return ids;
}

/** Resolves every internal fragment link under `root` against the ids of the page it names. */
export function sweepFragments(root: string): FragmentSweep {
  const pages = htmlPagesUnder(root);
  const idCache = new Map<string, Set<string>>();
  const identifiers = (page: string): Set<string> => {
    let ids = idCache.get(page);
    if (ids === undefined) {
      ids = identifiersOf(readFileSync(page, "utf8"));
      idCache.set(page, ids);
    }
    return ids;
  };

  const dangling: DanglingFragment[] = [];
  let resolved = 0;
  for (const page of pages) {
    const text = readFileSync(page, "utf8");
    const from = relative(root, page);
    for (const match of new Set([...text.matchAll(HREF)].map((m) => m[1]))) {
      const href = match ?? "";
      if (!href.includes("#")) continue;
      if (/^(https?:)?\/\//i.test(href) || href.startsWith("mailto:")) continue;
      const hash = href.indexOf("#");
      const targetPath = href.slice(0, hash);
      const fragment = href.slice(hash + 1);
      if (fragment === "" || fragment === "top") continue;
      // The extension test runs on the PATH without its query, because `NON_HTML` is anchored on
      // the end: `/papers/pdfs/x.pdf?v=2#page=3` would otherwise be treated as a page and its
      // bytes searched for an id, which is the false-positive class this skip exists for.
      if (NON_HTML.test(targetPath.split("?")[0] ?? "")) continue;

      let target: string | undefined;
      if (targetPath === "") {
        target = page;
      } else {
        target = pageForPath(root, targetPath);
        if (target === undefined) {
          dangling.push({ from, href, reason: "no built page at that path" });
          continue;
        }
      }
      resolved += 1;
      // A percent-escaped id is compared decoded, but a malformed escape must not crash a sweep
      // over the whole site: an undecodable fragment is compared as written.
      let wanted = fragment;
      try {
        wanted = decodeURIComponent(fragment);
      } catch {
        wanted = fragment;
      }
      if (!identifiers(target).has(wanted) && !identifiers(target).has(fragment)) {
        dangling.push({
          from,
          href,
          reason: `no element with id "${fragment}" in ${relative(root, target)}`,
        });
      }
    }
  }
  return { pages, resolved, dangling };
}

describe("built fragment targets", () => {
  it("every internal fragment link in out/ lands on an element that exists", () => {
    const sweep = sweepFragments(OUT);
    /*
     * The floor is on the RESOLVED LINKS, not the pages: a build that emitted pages with no links
     * would pass a page count while this check had nothing to do. Measured 20,830 resolved over
     * 759 pages on 2026-10-18, so the floor sits far below that and far above zero.
     */
    const vacuous = reportPopulation({
      gate: "built-fragment-targets",
      examined: sweep.resolved,
      noun: "internal fragment links resolved against the page they name",
      minimum: 5000,
    });
    assert.equal(vacuous, false);
    // Named, not counted: the repair is done from this list, and a number says nothing about which
    // link broke. Capped so a systemic break prints a readable failure rather than a wall.
    const named = sweep.dangling.slice(0, 40).map((d) => `${d.from}: ${d.href} -- ${d.reason}`);
    assert.deepEqual(
      named,
      [],
      `${sweep.dangling.length} dangling fragment link(s) over ${sweep.pages.length} pages`,
    );
  });

  /**
   * THE CONTROL, which runs every time rather than once when this was written. A clean corpus and
   * a broken sweep return the same empty list, and this corpus is expected to be clean, so the
   * discriminating cases are planted in a temporary tree: one link that must be reported, and two
   * that must not. Without the second kind a sweep that reported everything would pass here.
   */
  it("reports a missing target, and accepts a present one and a PDF page parameter", () => {
    const fixture = mkdtempSync(join(tmpdir(), "am-fragment-sweep-"));
    mkdirSync(join(fixture, "papers", "pdfs"), { recursive: true });

    // The PDF only has to EXIST so the link is not reported as a missing page; its bytes are never
    // searched for an id, which is the 632-false-positive lesson in the docblock above.
    writeFileSync(join(fixture, "papers", "pdfs", "paper.pdf"), "%PDF-1.4 not really\n");
    writeFileSync(
      join(fixture, "index.html"),
      [
        "<!doctype html><html><body>",
        '<h2 id="present-anchor">Present</h2>',
        '<a href="#present-anchor">lands on an element that exists</a>',
        '<a href="#absent-anchor">lands nowhere</a>',
        '<a href="/papers/pdfs/paper.pdf#page=29">a PDF page, not an element id</a>',
        '<a href="https://example.org/#whatever">external, not ours to resolve</a>',
        "</body></html>",
      ].join("\n"),
    );

    const sweep = sweepFragments(fixture);

    assert.deepEqual(
      sweep.dangling.map((d) => d.href),
      ["#absent-anchor"],
      "exactly the planted broken link is reported",
    );
    /*
     * `resolved` counts links whose target PAGE was found and whose id was then CHECKED, which
     * includes the one that turned out broken: both same-page links count, and the PDF and the
     * external link contribute none. So 2 here is the whole population this sweep examined, and
     * asserting it is what shows the two skips were skips rather than silent failures.
     */
    assert.equal(sweep.resolved, 2);
    assert.equal(sweep.pages.length, 1);
  });
});
