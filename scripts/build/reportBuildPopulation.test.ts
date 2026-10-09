/**
 * The page counter, and the one case that makes it worth having a function rather than a shell
 * pipeline: `next build` emits a DIRECTORY named `index.html`.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_PAGE_FLOOR,
  BUILD_PAGES_MEASURED_2026_10_08,
  countHtmlPages,
} from "./reportBuildPopulation.ts";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "am-build-pop-"));
  mkdirSync(join(root, "papers", "brownian-motion"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html>", "utf8");
  writeFileSync(join(root, "papers", "index.html"), "<!doctype html>", "utf8");
  writeFileSync(join(root, "papers", "brownian-motion", "index.html"), "<!doctype html>", "utf8");
  writeFileSync(join(root, "papers", "notes.txt"), "not a page", "utf8");
  return root;
}

describe("countHtmlPages counts emitted pages", () => {
  test("files ending .html, and nothing else", () => {
    const { pages, skipped } = countHtmlPages(fixture());
    expect(pages).toBe(3);
    expect(skipped).toBe(0);
  });

  test("A DIRECTORY NAMED index.html IS NOT A PAGE, which is why `find` disagrees", () => {
    // Measured on the real build: out/_next/static/chunks/app/offline/[paper]/[file]/index.html is
    // a DIRECTORY. `find out -name '*.html' | wc -l` reports 721 because it matches by name
    // regardless of type; this counter reports 720, and 720 is the page count. Without this test
    // the next person to "fix" the one-off discrepancy would make the counter wrong.
    const root = fixture();
    mkdirSync(join(root, "_next", "chunks", "[paper]", "index.html"), { recursive: true });
    const { pages } = countHtmlPages(root);
    expect(pages).toBe(3);
  });

  test("an empty or missing directory is zero pages, and a missing one is a SKIP", () => {
    const empty = mkdtempSync(join(tmpdir(), "am-build-pop-empty-"));
    expect(countHtmlPages(empty)).toEqual({ pages: 0, skipped: 0 });
    // A directory that does not exist cannot be read, and that is not the same as one that exists
    // and holds nothing. Conflating them is how a permission error becomes a clean zero.
    const absent = join(empty, "no-such-dir");
    expect(countHtmlPages(absent)).toEqual({ pages: 0, skipped: 1 });
  });

  test("the floor is well below the measured count, and both are stated", () => {
    // A floor that moves on ordinary work is a floor people raise without reading, so it sits at
    // about a third of the real number: a build that lost two thirds of the site is caught, a
    // legitimately narrower profile is not refused.
    expect(BUILD_PAGE_FLOOR).toBeLessThan(BUILD_PAGES_MEASURED_2026_10_08 / 2);
    expect(BUILD_PAGE_FLOOR).toBeGreaterThan(0);
  });
});
