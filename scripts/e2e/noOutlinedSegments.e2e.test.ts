/**
 * No built page hides content in a script-swapped Suspense segment.
 *
 * The site's pages must read without JavaScript. A Suspense boundary React has not finished when
 * it writes the surrounding HTML is emitted out of line, in <div hidden id="S:0">, and only a
 * script moves it into view. The build of 7b2ba7b1 did that to the four papers' first encounters
 * (8ce94625 gave each lazy island its own <Suspense>; fixed in 4d74814e). The markup was in the
 * HTML, so every check that looked for the markup passed, and no component test could have seen
 * it: rendered in Bun, the same islands came out inline. Only the built pages show it, so this
 * reads out/.
 *
 * Measured on a build of 7b2ba7b1 with 4d74814e's change applied: 367 pages, none with a segment;
 * with one planted into out/papers/light-quanta/index.html, this failed naming that page. The detector itself is proved
 * in the bun lane (src/testing/outlinedSegments.test.ts), so a node lane that stopped running
 * would not take the detector's proof with it.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { outlinedSegments } from "../../src/testing/outlinedSegments.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");

function pages(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "_next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...pages(path));
    else if (name.endsWith(".html")) found.push(path);
  }
  return found;
}

test("no built page hides content in an out-of-line Suspense segment", (t) => {
  if (!existsSync(OUT_DIR)) {
    t.skip("out/ is absent: nothing is built to read");
    return;
  }
  assertOutFreshness("out", REPO_ROOT);
  const all = pages(OUT_DIR);
  // Non-vacuity: a scan over no pages, or over a build missing the paper routes this exists for,
  // would pass while establishing nothing.
  assert.ok(all.length > 0, "out/ holds no HTML pages");
  for (const paper of ["brownian-motion", "light-quanta", "mass-energy", "special-relativity"]) {
    assert.ok(
      all.includes(join(OUT_DIR, "papers", paper, "index.html")),
      `out/papers/${paper}/index.html is missing, so the pages this guards were not scanned`,
    );
  }
  const offenders = all
    .map((path) => ({
      page: relative(OUT_DIR, path),
      segments: outlinedSegments(readFileSync(path, "utf8")),
    }))
    .filter((p) => p.segments.length > 0);
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} of ${all.length} built pages hold content that is hidden until a script moves it in. ` +
      "A <Suspense> around a lazy island, or in a layout above <main>, does this (src/reader/lazyIslands.tsx).",
  );
});
