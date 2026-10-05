/**
 * THE BARE-THROW BLOCK IS MEASURED, AND ITS EXCLUSION IS STATED (am-kfkw).
 *
 * The bead's finding: the refusal ratchet's scanner matches on a kebab code string, so about half the
 * throw sites in this repository are not reported as uncovered -- they are not reported at all. A
 * ratchet that cannot see two fifths of its domain is not a ratchet over that domain, and the
 * acceptance asks either for a scanner that covers the bare block or for one that "declares explicitly
 * that it does not and how many it is excluding". This is the second, because whether a bare throw is
 * a defect is a judgement: a coded reader-facing refusal and an ordinary internal invariant are both
 * throws, and scoring them alike would manufacture 1482 findings rather than measure anything.
 *
 * What is guaranteed here is an accounting with NO SILENT CLASS. Every throw site lands in exactly one
 * of coded or bare, the identity holds for each population, and the number the code-string scanner
 * cannot see is printed beside the number it can.
 */
import { describe, expect, it } from "bun:test";
import {
  censusOf,
  enumerateThrowSites,
  summarizeThrowSiteCensus,
  throwSitesInSource,
} from "./throwSiteCensus.ts";

const ROOT = process.cwd();

describe("the throw-site census accounts for every site", () => {
  const { sites, filesScanned } = enumerateThrowSites(ROOT);
  const census = censusOf(sites, filesScanned);

  it("prints the whole population with its denominators, and the exclusion as a number", () => {
    console.log(`[throw sites] ${summarizeThrowSiteCensus(census)}`);
    // Non-vacuity on the instrument itself: a walk that found nothing would satisfy every identity
    // below. These are floors measured on 2026-10-05 (3227 product sites in 1745-plus files), not
    // equalities, so authoring more code never turns this red.
    expect(census.filesScanned).toBeGreaterThan(1000);
    expect(census.byPopulation.product.total).toBeGreaterThan(2000);
  });

  it("NO SILENT CLASS: coded plus bare is the total, for each population and overall", () => {
    expect(census.coded + census.bare).toBe(census.total);
    for (const population of ["product", "test"] as const) {
      const p = census.byPopulation[population];
      expect(p.coded + p.bare).toBe(p.total);
    }
    expect(census.byPopulation.product.total + census.byPopulation.test.total).toBe(census.total);
    // And the site list itself holds no third kind, which is what makes the arithmetic above mean
    // something rather than restate how the counters were incremented.
    expect(sites.filter((s) => s.kind !== "coded" && s.kind !== "bare")).toEqual([]);
  });

  it("the block a code-string scanner cannot see is non-empty, so the exclusion is real", () => {
    // Both halves asserted: if either were zero the test above would hold vacuously.
    expect(census.byPopulation.product.bare).toBeGreaterThan(0);
    expect(census.byPopulation.product.coded).toBeGreaterThan(0);
    expect(census.bareByFile.length).toBeGreaterThan(0);
    // The per-file counts account for exactly the bare sites, so no file's debt is lost in the total.
    const summed = census.bareByFile.reduce((n, row) => n + row.bare, 0);
    expect(summed).toBe(census.byPopulation.product.bare + census.byPopulation.test.bare);
  });

  it("every site carries a location, which is the identity a bare throw has instead of a payload", () => {
    for (const site of sites) {
      expect(site.file.length).toBeGreaterThan(0);
      expect(site.line).toBeGreaterThan(0);
      expect(site.enclosing.length).toBeGreaterThan(0);
    }
    // Two bare throws in one function are told apart only by position, so the pairs must be distinct.
    const keys = sites.map((s) => `${s.file}:${s.line}`);
    const duplicated = keys.filter((k, i) => keys.indexOf(k) !== i);
    // A single line may legitimately hold one throw only; a duplicate would mean the walk visited a
    // node twice, which would inflate every count above.
    expect(duplicated).toEqual([]);
  });
});

describe("the census reads code, not prose about code", () => {
  it("a throw written inside a comment is not a throw site", () => {
    // THE DEFECT THIS FORECLOSES. A scanner over raw source cannot tell a construct from the comment
    // explaining it, and the densest writing about a forbidden throw is that comment. An AST cannot
    // see a comment at all, so this holds structurally rather than by a stripping pass -- but it is
    // asserted, because "structurally" is exactly what the last four misfiring gates each believed.
    const source = [
      "// throw new RefusalError('commented-out-code');",
      "/* throw new RefusalError('block-commented-code'); */",
      "/**",
      " * Historically this threw new RefusalError('documented-code') and must not again.",
      " */",
      "export function f(): number {",
      "  return 1;",
      "}",
    ].join("\n");
    expect(throwSitesInSource("probe.ts", source)).toEqual([]);
  });

  it("the same throws in code ARE sites, and are classified by their payload", () => {
    const source = [
      "export function coded(): never {",
      "  throw new RefusalError('parameters-rejected');",
      "}",
      "export function bare(): never {",
      "  throw new Error('that cannot happen');",
      "}",
      "export function rethrow(): never {",
      "  throw caught;",
      "}",
    ].join("\n");
    const found = throwSitesInSource("probe.ts", source);
    expect(found.map((s) => `${s.enclosing}:${s.kind}:${s.code ?? ""}`)).toEqual([
      "coded:coded:parameters-rejected",
      "bare:bare:",
      "rethrow:bare:",
    ]);
    // The lines are the code's own, so a census entry points at the throw and not at the file.
    expect(found.map((s) => s.line)).toEqual([2, 5, 8]);
  });

  it("a single-word string is not a code, so an ordinary message is not scored as one", () => {
    // The kebab rule needs two segments. Without this, `throw new Error("boom")` would count as coded
    // and the bare block would be undercounted -- the direction that hides the debt.
    const source = ["export function m(): never {", "  throw new Error('boom');", "}"].join("\n");
    expect(throwSitesInSource("probe.ts", source)[0]?.kind).toBe("bare");
  });

  it("a test file's throws are a separate population from a product refusal", () => {
    const inTest = throwSitesInSource("src/x/thing.test.ts", "throw new Error('x');");
    const inProduct = throwSitesInSource("src/x/thing.ts", "throw new Error('x');");
    expect(inTest[0]?.population).toBe("test");
    expect(inProduct[0]?.population).toBe("product");
  });
});
