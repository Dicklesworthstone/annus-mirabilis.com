/**
 * THE INLINE-EQUATION UNIT CLASS, AND WHAT WOULD MAKE ITS IDS WRONG.
 *
 * The criterion and its measurement live in inlineEquationUnits.ts. What this file holds is the one
 * property that makes the editorial judgment safe to take, plus the two-sided corpus check.
 *
 * THE PROPERTY WORTH A TEST. `i` counts EVERY inline math region in printed order, including the
 * ones the criterion drops. The natural wrong implementation indexes only the regions it KEEPS,
 * which is a one-line difference, passes every count, and silently assigns `-m1` to the second
 * region of a sentence whose first region is a lone symbol. Those ids are frozen on publication, so
 * that mistake is not recoverable by editing: it is recoverable only through alias records. Asserting
 * it from the module's structure would be tautological, so it is asserted from the OUTSIDE, on a
 * fixture built so a kept-only index gives a different answer: `firstRegionIsBareSymbol` below fails
 * loudly for a wrong implementation and cannot be satisfied by one.
 *
 * WHAT IS NOT ASSERTED. The count of units per paper. A census is for reporting (AGENTS.md), and
 * this one changes whenever a transcription correction lands; the two-sided corpus check below
 * states the property that holds at any size -- a paper's manifest records exactly the derived set,
 * or declares the debt and records none.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../provenance/yaml.ts";
import type { Inline } from "../schemas/inlines.ts";
import { strictParse } from "../schemas/strictParse.ts";
import {
  type InlineUnitSource,
  inlineEquationUnits,
  inlineMathRegions,
  isSubstantiveInlineMath,
  unplacedRegions,
} from "./inlineEquationUnits.ts";
import { DECLARED_ABSENCES } from "./requiredUnitKinds.ts";
import type { ManifestLocator } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

const math = (latex: string): Inline => ({ kind: "math", latex }) as Inline;
const text = (value: string): Inline => ({ kind: "text", text: value }) as Inline;

describe("the criterion can fail, in both directions", () => {
  test("a lone symbol is not substantive; structure of any kind is", () => {
    // Rejected: one command, one character, either wrapped in braces or carrying the sentence's
    // punctuation. The plate prints "der Kraft $K$," and that comma is not part of the formula.
    for (const bare of ["v", "N", "2", "\\varphi", "\\nu", "{K}", "K,", "\\varrho;", " x "]) {
      expect(isSubstantiveInlineMath(bare)).toBe(false);
    }
    // Admitted: a relation, an operation, a subscript, a tuple, a ratio, a multi-digit numeral.
    for (const real of [
      "p = \\frac{RT}{N}\\nu",
      "\\sqrt{2Dt}",
      "V^*",
      "p_1",
      "(\\xi, \\eta, \\zeta)",
      "H - E",
      "L/2",
      "0{,}8",
      "6\\cdot10^{23}",
    ]) {
      expect(isSubstantiveInlineMath(real)).toBe(true);
    }
    // An empty region is not a unit, and must not throw.
    expect(isSubstantiveInlineMath("")).toBe(false);
    expect(isSubstantiveInlineMath("   ")).toBe(false);
  });
});

describe("a dropped region still consumes its index", () => {
  test("firstRegionIsBareSymbol: the second region of the sentence is -m2, never -m1", () => {
    // One sentence, two regions, the first a lone symbol the criterion drops. An implementation
    // that numbers only the regions it keeps calls the relation -m1. The plate decides the index,
    // so it is -m2, and promoting the lone symbol later must not move it.
    const inlines = [
      text("Mit der Kraft "),
      math("K"),
      text(" folgt "),
      math("p = \\frac{RT}{N}\\nu"),
      text("."),
    ];
    const spans = [{ id: "s1-p1-s1", span: { start: 0, end: 200 } }];
    const regions = inlineMathRegions(inlines, spans, "s1-p1");

    expect(regions.map((r) => `${r.ownerUnitId}-m${r.index}`)).toEqual([
      "s1-p1-s1-m1",
      "s1-p1-s1-m2",
    ]);
    expect(regions.map((r) => r.substantive)).toEqual([false, true]);

    // And the unit list keeps the gap: exactly one unit, bearing the index 2.
    const units = inlineEquationUnits(
      [
        {
          blockId: "s1-p1",
          paper: "brownian-motion",
          section: "s1",
          inlines,
          sentenceSpans: spans,
        },
      ],
      new Map([["s1-p1-s1", { locators: [{ page: 549 }], section: "s1" }]]),
    );
    expect(units.map((u) => u.id)).toEqual(["s1-p1-s1-m2"]);
    expect(units[0]?.kind).toBe("inline-equation");
    expect(units[0]?.containedIn).toBe("s1-p1-s1");
  });

  test("indices restart per owning unit, and a footnote owns its own regions", () => {
    const inlines = [math("a = b"), text(" erster Satz. "), math("c = d"), text(" zweiter Satz.")];
    // "a = b" is 5 code points, " erster Satz. " is 14, so the second sentence starts at 19.
    const spans = [
      { id: "s2-p1-s1", span: { start: 0, end: 19 } },
      { id: "s2-p1-s2", span: { start: 19, end: 100 } },
    ];
    expect(
      inlineMathRegions(inlines, spans, "s2-p1").map((r) => `${r.ownerUnitId}-m${r.index}`),
    ).toEqual(["s2-p1-s1-m1", "s2-p1-s2-m1"]);

    // A footnote has no sentence spans, so the block itself owns the regions: s<n>-fn<k>-m<i>.
    expect(
      inlineMathRegions([math("x = y"), text(" vgl. "), math("z = w")], [], "s2-fn1").map(
        (r) => `${r.ownerUnitId}-m${r.index}`,
      ),
    ).toEqual(["s2-fn1-m1", "s2-fn1-m2"]);
  });

  test("a display body is not an inline region, under either of its two spellings", () => {
    // The first pass over this corpus read 914 regions instead of 714 because the 200
    // `equation`-kind blocks carry their body as a math inline with `equationId` set and `display`
    // unset. Both spellings are excluded, and this is the plant for that correction.
    const display = { kind: "math", latex: "E = mc^2", display: true } as unknown as Inline;
    const body = { kind: "math", latex: "E = mc^2", equationId: "eq-1" } as unknown as Inline;
    expect(inlineMathRegions([display, body], [], "eq-1")).toEqual([]);
    expect(
      inlineMathRegions([display, body, math("a = b")], [], "s1-fn1").map((r) => r.latex),
    ).toEqual(["a = b"]);
  });
});

/** Every source block of a paper that can hold an inline region, with its spans. */
function sourceBlocks(paper: string): readonly InlineUnitSource[] {
  const dir = join(ROOT, "content", "source-blocks", paper);
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".yaml") && entry !== "manifest.yaml") files.push(path);
    }
  };
  walk(dir);

  const out: InlineUnitSource[] = [];
  for (const file of files) {
    let record: Record<string, unknown>;
    try {
      record = strictParse(readFileSync(file, "utf8"), "yaml") as Record<string, unknown>;
    } catch {
      continue; // Parse failures belong to the ledger and manifest checks, not to this one.
    }
    if (record.kind === "equation") continue;
    const inlines = Array.isArray(record.inlines) ? (record.inlines as Inline[]) : [];
    if (inlines.length === 0) continue;
    const spans = (
      Array.isArray(record.sentenceSpans) ? (record.sentenceSpans as Record<string, unknown>[]) : []
    ).map((s) => ({
      id: String(s.id),
      span: s.span as { start: number; end: number },
    }));
    out.push({
      blockId: String(record.id),
      paper,
      section: typeof record.section === "string" ? record.section : undefined,
      inlines,
      sentenceSpans: spans,
    });
  }
  return out;
}

function manifestUnits(paper: string): readonly Readonly<{
  id: string;
  kind: string;
  locators: readonly ManifestLocator[];
  section?: string;
  obligations?: readonly string[] | undefined;
}>[] {
  const path = join(ROOT, "content", "source-blocks", paper, "manifest.yaml");
  const parsed = parseYaml(readFileSync(path, "utf8")) as {
    units?: Readonly<{
      id: string;
      kind: string;
      locators: readonly ManifestLocator[];
      section?: string;
      destination?: { argumentObligations?: readonly string[] };
    }>[];
  };
  return (parsed.units ?? []).map((u) => ({
    ...u,
    obligations: u.destination?.argumentObligations,
  }));
}

describe("the corpus: every region is placed, and every manifest matches its derivation", () => {
  test("no inline region falls outside the sentence spans of its own block", () => {
    // Named, not counted. An unplaced region would otherwise be dropped from the inventory or given
    // an index under a neighbouring sentence, which freezes an id naming the wrong passage.
    const unplaced: string[] = [];
    let blocks = 0;
    for (const paper of PAPERS) {
      for (const source of sourceBlocks(paper)) {
        blocks++;
        for (const region of unplacedRegions(
          source.inlines,
          source.sentenceSpans,
          source.blockId,
        )) {
          unplaced.push(`${paper}/${region.blockId}: ${region.latex}`);
        }
      }
    }
    expect(blocks).toBeGreaterThan(0);
    expect(unplaced).toEqual([]);
  });

  test("a paper records exactly its derived inline units, or declares the debt and records none", () => {
    // Two-sided on purpose. "Equals the derivation" alone passes vacuously for a paper with no
    // units and no derivation; "declares the debt" alone never tightens as papers land. Together
    // they move each paper from one branch to the other in the commit that pays it, and
    // requiredUnitKinds.test.ts refuses a declaration that has gone stale.
    const lines: string[] = [];
    for (const paper of PAPERS) {
      const units = manifestUnits(paper);
      const containers = new Map(
        units.map((u) => [
          u.id,
          { locators: u.locators, section: u.section, argumentObligations: u.obligations },
        ]),
      );
      const derived = inlineEquationUnits(sourceBlocks(paper), containers);
      const recorded = units.filter((u) => u.kind === "inline-equation").map((u) => u.id);
      const declared = DECLARED_ABSENCES.get(paper)?.get("inline-equation") !== undefined;

      expect(derived.length).toBeGreaterThan(0); // the derivation reaches every paper
      if (declared) {
        expect(recorded).toEqual([]);
        lines.push(`${paper}: debt declared, ${derived.length} derivable`);
      } else {
        expect([...recorded].sort()).toEqual([...derived.map((u) => u.id)].sort());
        lines.push(`${paper}: ${recorded.length} recorded, matching the derivation`);
      }
    }
    console.log(`inline-equation units over ${PAPERS.length} papers:\n  ${lines.join("\n  ")}`);
  });

  test("the census prints what it examined, per paper and per criterion", () => {
    let regions = 0;
    let substantive = 0;
    const perPaper: string[] = [];
    for (const paper of PAPERS) {
      let r = 0;
      let s = 0;
      const owners = new Set<string>();
      for (const source of sourceBlocks(paper)) {
        for (const region of inlineMathRegions(
          source.inlines,
          source.sentenceSpans,
          source.blockId,
        )) {
          r++;
          owners.add(region.ownerUnitId);
          if (region.substantive) s++;
        }
      }
      regions += r;
      substantive += s;
      perPaper.push(
        `${paper.padEnd(20)} ${String(r).padStart(4)} regions  ${String(s).padStart(4)} substantive  ${String(owners.size).padStart(3)} owning units`,
      );
    }
    console.log(
      `inline math regions: examined ${regions} across ${PAPERS.length} papers, ${substantive} substantive\n  ${perPaper.join("\n  ")}`,
    );
    // Non-vacuity, and the shape of the judgment: the subset is a strict, non-empty subset, so it
    // both admits regions and leaves the gaps the id grammar predicts.
    expect(regions).toBeGreaterThan(0);
    expect(substantive).toBeGreaterThan(0);
    expect(substantive).toBeLessThan(regions);
  });
});
