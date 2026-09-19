/**
 * Cross-paper glyph collisions, resolved per paper (am-eq-latex-generation-hc3).
 *
 * The edition reuses Einstein's own glyphs, and he reused them too. Across the four
 * concordances one printed glyph routinely carries different quantities in different
 * papers: beta is Wien's constant in paper 1 and the Lorentz factor in paper 3, k is
 * viscosity in paper 2, P is the work function in paper 1, the particle radius in paper 2
 * and the radiation pressure in paper 3, V is a volume in paper 2 and the speed of light
 * in papers 3 and 4. A global substitution has to pick one reading and is then wrong
 * everywhere else, which is why the lookup is section-scoped.
 *
 * The existing coverage of that property is a hand-picked pair per paper: beta for papers
 * 1 and 3, k for papers 2 and 3, L for papers 1 and 4. A hand-picked pair goes stale as
 * entries are authored, and it cannot say whether some paper has no case at all. This
 * builds the collision set FROM the concordances at test time, so a newly authored entry
 * that collides is covered the moment it lands, and every paper is exercised by
 * construction.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { ConcordanceEntry, PaperConcordance } from "../../content/schemas/concordance.ts";
import type { Expression } from "../ast.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";
import { renderLatex } from "./render.ts";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

type Reading = Readonly<{
  paper: string;
  entryId: string;
  quantityId: string;
  printedGlyph: string;
  modernGlyph: string;
  scope: string;
}>;

function glyphText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "latex" in value) {
    const latex = (value as { latex?: unknown }).latex;
    if (typeof latex === "string") return latex;
  }
  return undefined;
}

/** A rename entry that binds a quantity and declares both glyphs is a readable collision candidate. */
function readingOf(paper: string, entry: ConcordanceEntry): Reading | undefined {
  if (entry.operation.kind !== "rename") return undefined;
  if (!("quantityId" in entry.binding)) return undefined;
  const printedGlyph = glyphText(entry.glyph);
  const modernGlyph = glyphText(entry.operation.target.modernGlyph);
  const scope = entry.scope?.[0];
  if (!printedGlyph || !modernGlyph || !scope) return undefined;
  return {
    paper,
    entryId: entry.id,
    quantityId: entry.binding.quantityId,
    printedGlyph,
    modernGlyph,
    scope,
  };
}

function allReadings(concordances: ReadonlyMap<string, PaperConcordance>): readonly Reading[] {
  const out: Reading[] = [];
  for (const [paper, concordance] of concordances) {
    for (const entry of concordance.entries) {
      const reading = readingOf(paper, entry);
      if (reading) out.push(reading);
    }
  }
  return out;
}

/** A registry entry so the renderer has a role and a fallback; the glyph under test comes from the concordance. */
function registryFor(reading: Reading): QuantityRegistry {
  const quantity: Quantity = Object.freeze({
    id: reading.quantityId,
    name: reading.quantityId,
    glyph: reading.printedGlyph,
    dimension: Object.freeze(["0", "0", "0", "0", "0", "0"]),
    unit: "1",
    displayUnit: "1",
    displayPower: 0,
    semanticKind: "variable",
    role: "input",
    definition: "",
  }) as Quantity;
  return Object.freeze({ [reading.quantityId]: quantity }) as QuantityRegistry;
}

function renderModern(reading: Reading, concordance: PaperConcordance): string {
  const node: Expression = {
    kind: "symbol",
    termId: `t.${reading.quantityId}`,
    quantityId: reading.quantityId,
  };
  return renderLatex(node, {
    perspective: "modern",
    paper: reading.paper,
    sectionId: reading.scope,
    concordance,
    registry: registryFor(reading),
    equationId: `scoped-glyph-${reading.entryId}`,
  });
}

const concordances = new Map<string, PaperConcordance>(
  PAPERS.map((paper) => [paper, loadConcordanceForPaper(paper)] as const),
);
const readings = allReadings(concordances);

/** Printed glyphs that carry more than one quantity across more than one paper. */
function collisionGroups(): ReadonlyMap<string, readonly Reading[]> {
  const byGlyph = new Map<string, Reading[]>();
  for (const reading of readings) {
    const list = byGlyph.get(reading.printedGlyph) ?? [];
    list.push(reading);
    byGlyph.set(reading.printedGlyph, list);
  }
  const out = new Map<string, readonly Reading[]>();
  for (const [glyph, list] of byGlyph) {
    const papers = new Set(list.map((r) => r.paper));
    const quantities = new Set(list.map((r) => r.quantityId));
    if (papers.size > 1 && quantities.size > 1) out.set(glyph, list);
  }
  return out;
}

test("scopedGlyphs: the concordances really do reuse glyphs across papers", () => {
  const groups = collisionGroups();
  assert.ok(
    groups.size >= 10,
    `expected the known cross-paper glyph reuse, found ${groups.size} groups`,
  );
  // The three the doctrine calls out by name must be among them.
  for (const glyph of ["\\beta", "P", "V"]) {
    assert.ok(groups.has(glyph), `glyph ${glyph} must be a recorded cross-paper collision`);
  }
});

test("scopedGlyphs: every paper carries at least one cross-paper glyph collision", () => {
  const groups = collisionGroups();
  const covered = new Set<string>();
  for (const list of groups.values()) {
    for (const reading of list) covered.add(reading.paper);
  }
  for (const paper of PAPERS) {
    assert.ok(covered.has(paper), `${paper} has no cross-paper glyph collision in the set`);
  }
});

test("scopedGlyphs: each reading renders its OWN paper's modern glyph", () => {
  for (const list of collisionGroups().values()) {
    for (const reading of list) {
      const concordance = concordances.get(reading.paper);
      assert.ok(concordance);
      const rendered = renderModern(reading, concordance).trim();
      assert.ok(
        rendered === reading.modernGlyph || rendered.includes(reading.modernGlyph),
        `${reading.entryId}: modern render of printed ${reading.printedGlyph} in ${reading.paper} ` +
          `must show ${reading.modernGlyph}, got ${rendered}`,
      );
    }
  }
});

test("scopedGlyphs: a paper never renders another paper's reading of the same glyph", () => {
  let comparisons = 0;
  for (const [glyph, list] of collisionGroups()) {
    for (const a of list) {
      for (const b of list) {
        // Only pairs that the concordances themselves say disagree.
        if (a.paper === b.paper) continue;
        if (a.quantityId === b.quantityId) continue;
        if (a.modernGlyph === b.modernGlyph) continue;

        const concordance = concordances.get(a.paper);
        assert.ok(concordance);
        const rendered = renderModern(a, concordance).trim();
        // Compared whole, never by substring: R_{\mathrm{light}} contains R, and a
        // containment test would report a leak that is only a shared prefix.
        assert.equal(
          rendered,
          a.modernGlyph,
          `${a.entryId} must render its own glyph ${a.modernGlyph}, got ${rendered}`,
        );
        assert.notEqual(
          rendered,
          b.modernGlyph,
          `printed ${glyph} in ${a.paper} (${a.quantityId}) rendered ${b.paper}'s reading ` +
            `${b.modernGlyph} (${b.quantityId}); the lookup leaked across papers`,
        );
        comparisons += 1;
      }
    }
  }
  assert.ok(comparisons >= 20, `expected a real comparison matrix, ran ${comparisons}`);
});
