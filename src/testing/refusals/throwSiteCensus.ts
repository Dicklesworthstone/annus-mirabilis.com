/**
 * EVERY THROW SITE, IDENTIFIED BY LOCATION RATHER THAN BY PAYLOAD (am-kfkw).
 *
 * The refusal ratchet's scanner matches on a kebab code string, so a throw that carries no code is
 * not reported as uncovered -- it is not reported at all. Measured here on 2026-10-05: of 3227 throw
 * statements in product code, 1745 carry a kebab code and 1482 do not. That second block is 46% of
 * the population the ratchet claims to measure, and it was a SILENT class: absent from the numerator
 * and from the denominator both.
 *
 * This module exists to make that block measured. It does not score coverage and it does not decide
 * whether a bare throw is a defect: a coded refusal and an ordinary invariant are both throws, and
 * telling them apart is a judgement this census deliberately leaves to its caller. What it
 * guarantees is an accounting with no silent class, so `coded + bare === total` always holds and the
 * excluded block has a number beside it.
 *
 * WHY AN AST AND NOT A REGEX. A scanner over raw source cannot tell a construct from prose ABOUT the
 * construct, and the densest writing about a forbidden throw is the comment explaining why it is
 * forbidden (AGENTS.md, "A gate that forbids a construct must read code, not text"). A TypeScript
 * AST cannot see a comment at all, so the distinction is structural rather than a stripping pass that
 * has to be proven in both directions. The test beside this file asserts exactly that: a throw
 * written inside a comment is not a throw site.
 *
 * Identity is `file:line`, which is what makes the bare block addressable: a bare throw has no
 * payload to name it by, and two bare throws in one function are distinguishable only by position.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/** A kebab-case code: two or more lowercase segments joined by hyphens. */
const KEBAB_CODE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

export type ThrowSitePopulation = "product" | "test";

export type ThrowSite = Readonly<{
  /** Repo-relative, with forward slashes, so a census is comparable across machines. */
  file: string;
  /** 1-indexed, from the source file's own line map. */
  line: number;
  /** The nearest named function, method or class, or "(module scope)". */
  enclosing: string;
  /** `coded` when any string in the thrown expression is a kebab code; `bare` otherwise. */
  kind: "coded" | "bare";
  /** The first kebab code found in the thrown expression, when there is one. */
  code?: string | undefined;
  population: ThrowSitePopulation;
}>;

export type ThrowSiteCensus = Readonly<{
  total: number;
  coded: number;
  bare: number;
  /** Per population, so a test-file throw is never counted as a product refusal. */
  byPopulation: Readonly<
    Record<ThrowSitePopulation, Readonly<{ total: number; coded: number; bare: number }>>
  >;
  /** Files holding at least one bare throw, with how many, descending then by name. */
  bareByFile: readonly Readonly<{ file: string; bare: number }>[];
  filesScanned: number;
}>;

function isTestFile(relPath: string): boolean {
  return /\.(test|spec)\.[cm]?tsx?$/.test(relPath) || relPath.includes("testing/fixtures/");
}

/** The nearest enclosing name, walking up from the throw. */
function enclosingName(node: ts.Node): string {
  for (let n: ts.Node | undefined = node.parent; n !== undefined; n = n.parent) {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) {
      if (n.name) return n.name.getText();
    }
    if (ts.isClassDeclaration(n) && n.name) return n.name.getText();
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.getText();
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) return n.name.getText();
  }
  return "(module scope)";
}

/** Every throw statement in one source text. Exported so a plant needs no file on disk. */
export function throwSitesInSource(
  relPath: string,
  text: string,
  population: ThrowSitePopulation = isTestFile(relPath) ? "test" : "product",
): readonly ThrowSite[] {
  const sourceFile = ts.createSourceFile(
    relPath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const sites: ThrowSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isThrowStatement(node)) {
      let code: string | undefined;
      const scan = (inner: ts.Node): void => {
        if (code !== undefined) return;
        if (
          (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) &&
          KEBAB_CODE.test(inner.text)
        ) {
          code = inner.text;
          return;
        }
        ts.forEachChild(inner, scan);
      };
      if (node.expression !== undefined) scan(node.expression);
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      sites.push({
        file: relPath,
        line: line + 1,
        enclosing: enclosingName(node),
        kind: code === undefined ? "bare" : "coded",
        ...(code === undefined ? {} : { code }),
        population,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(sites);
}

const SKIP_DIRECTORIES = new Set(["node_modules", "generated", ".next", "out", "artifacts"]);

/** Every throw site under `dirs`, relative to `root`. */
export function enumerateThrowSites(
  root: string,
  dirs: readonly string[] = ["src", "scripts"],
): { sites: readonly ThrowSite[]; filesScanned: number } {
  const sites: ThrowSite[] = [];
  let filesScanned = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
      filesScanned += 1;
      const rel = relative(root, full).split(sep).join("/");
      sites.push(...throwSitesInSource(rel, readFileSync(full, "utf8")));
    }
  };
  for (const dir of dirs) walk(join(root, dir));
  return { sites: Object.freeze(sites), filesScanned };
}

/** The accounting. `coded + bare === total` by construction, for every population. */
export function censusOf(sites: readonly ThrowSite[], filesScanned: number): ThrowSiteCensus {
  const empty = () => ({ total: 0, coded: 0, bare: 0 });
  const byPopulation: Record<ThrowSitePopulation, { total: number; coded: number; bare: number }> =
    {
      product: empty(),
      test: empty(),
    };
  const bareByFile = new Map<string, number>();
  for (const site of sites) {
    const bucket = byPopulation[site.population];
    bucket.total += 1;
    if (site.kind === "coded") bucket.coded += 1;
    else {
      bucket.bare += 1;
      bareByFile.set(site.file, (bareByFile.get(site.file) ?? 0) + 1);
    }
  }
  return {
    total: sites.length,
    coded: byPopulation.product.coded + byPopulation.test.coded,
    bare: byPopulation.product.bare + byPopulation.test.bare,
    byPopulation: Object.freeze({
      product: Object.freeze(byPopulation.product),
      test: Object.freeze(byPopulation.test),
    }),
    bareByFile: Object.freeze(
      [...bareByFile]
        .map(([file, bare]) => Object.freeze({ file, bare }))
        .sort((a, b) => b.bare - a.bare || a.file.localeCompare(b.file)),
    ),
    filesScanned,
  };
}

/**
 * One line carrying every count beside its denominator, and the exclusion stated as a number.
 *
 * The last clause is the point of this module: the code-string scanner the refusal ratchet runs can
 * see only the coded sites, so the sentence says how many it is excluding rather than leaving them
 * out of both the numerator and the denominator.
 */
export function summarizeThrowSiteCensus(census: ThrowSiteCensus): string {
  const p = census.byPopulation.product;
  const t = census.byPopulation.test;
  return (
    `${census.total} throw sites in ${census.filesScanned} files: ` +
    `product ${p.total} (${p.coded} kebab-coded, ${p.bare} bare), ` +
    `test ${t.total} (${t.coded} kebab-coded, ${t.bare} bare). ` +
    `A code-string scanner is blind to ${p.bare} product sites, in ${census.bareByFile.length} files, ` +
    `which is ${((p.bare / Math.max(1, p.total)) * 100).toFixed(1)}% of product throw sites.`
  );
}
