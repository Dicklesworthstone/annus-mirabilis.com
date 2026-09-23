/**
 * Every equation record prints in its own paper's letters wherever it is exported as text. The
 * Markdown a reader downloads from a paper's page, and the search index, rendered every paper with
 * the Brownian table, so a light-quanta, relativity or mass-energy symbol printed as its term id:
 * "eq-model-me-exact-drop.t.kineticEnergyDifference = ...", in 15 to 40 display blocks per paper
 * on BUILD 25. The property is held over every real record, and then over the real Markdown.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { paperMarkdown } from "../content/compiler/emitter.ts";
import { expressionLatex } from "./latex.ts";
import { BROWNIAN_QUANTITIES } from "./quantities.ts";
import { recordLatex } from "./recordLatex.ts";

const ROOT = new URL("../../content/equations/", import.meta.url);
const RECORDS = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) =>
    readdirSync(new URL(`${d.name}/`, ROOT))
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(new URL(`${d.name}/${f}`, ROOT), "utf8"))),
  ) as { id: string; paper: string; tree: never; printedGlyphs?: Record<string, string> }[];
const TERM_ID = /eq-model-[a-z0-9-]+\.t\./;

describe("a record's formula as exported text", () => {
  test("every record prints in its own paper's letters: no term id reaches the LaTeX", () => {
    const leaking = RECORDS.filter((r) => TERM_ID.test(recordLatex(r) ?? "eq-model-x.t.missing"));
    expect(leaking.map((r) => r.id)).toEqual([]);
    // Non-vacuity: every paper with records was examined, not an empty directory.
    const papers = new Set(RECORDS.map((r) => r.paper));
    for (const paper of [
      "brownian-motion",
      "light-quanta",
      "special-relativity",
      "mass-energy",
      "foundations",
    ])
      expect(papers.has(paper)).toBe(true);
  });

  test("positive control: the old single table leaks on every non-Brownian paper", () => {
    // The property above can fail: rendering with the Brownian table, as both exports did, prints
    // a term id in at least one record of each other paper.
    for (const paper of ["light-quanta", "special-relativity", "mass-energy"]) {
      const leaks = RECORDS.filter(
        (r) => r.paper === paper && TERM_ID.test(expressionLatex(r.tree, BROWNIAN_QUANTITIES)),
      );
      expect(leaks.length).toBeGreaterThan(0);
    }
  });

  test("a record's printed letters reach the export", () => {
    const continuity = RECORDS.find((r) => r.id === "eq-model-fd-continuity");
    expect(continuity?.printedGlyphs).toEqual({ numberDensity: "c" });
    expect(recordLatex(continuity as never)).toContain("\\partial c");
  });

  test("a paper with no teaching table gives no LaTeX rather than term ids", () => {
    const first = RECORDS[0];
    expect(first).toBeDefined();
    if (first) expect(recordLatex({ ...first, paper: "no-such-paper" })).toBeUndefined();
  });
});

describe("the Markdown a reader downloads from a paper's page", () => {
  test("no display block in any paper prints a term id", async () => {
    const result = compileReadingContent(await loadReadingFiles());
    const titleOf = (id: string) => result.foundations.find((f) => f.id === id)?.title;
    const blocks = result.papers.map((p) => ({
      paper: p.paper.id,
      equations: p.equations.length,
      display: [...paperMarkdown(p, titleOf).matchAll(/\$\$\n([\s\S]*?)\n\$\$/g)].map((m) => m[1]),
    }));
    // Non-vacuity, by identity: each of the four papers is exported, with its teaching equations
    // as display blocks.
    const exported = blocks.map((b) => b.paper);
    for (const paper of ["brownian-motion", "light-quanta", "special-relativity", "mass-energy"])
      expect(exported).toContain(paper);
    for (const b of blocks) {
      expect(b.equations).toBeGreaterThan(0);
      expect(b.display.length).toBeGreaterThanOrEqual(b.equations);
    }
    const leaking = blocks.flatMap((b) =>
      b.display.filter((d) => TERM_ID.test(d ?? "")).map((d) => `${b.paper}: ${d?.slice(0, 80)}`),
    );
    expect(leaking).toEqual([]);
  });
});
