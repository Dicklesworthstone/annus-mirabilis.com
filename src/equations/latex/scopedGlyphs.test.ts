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
import { PAPER_SLUGS } from "../../content/schemas/source.ts";
import type { Expression } from "../ast.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";
import { renderLatex } from "./render.ts";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/**
 * The papers coverage is REQUIRED for, taken from the canonical slug set rather than from
 * PAPERS above. Deriving the requirement from the same list the data is loaded from makes
 * the coverage test vacuous: drop a paper and both the data and the requirement vanish
 * together. The companion dissertation is excluded; it is not one of the four.
 */
const REQUIRED_PAPERS = (PAPER_SLUGS as readonly string[]).filter(
  (slug) => slug !== "molecular-dimensions",
);

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
  if (entry.operation.kind === "unitConversion") return undefined;
  if (!("quantityId" in entry.binding)) return undefined;
  const printedGlyph = glyphText(entry.glyph);
  // A modernization is no new name: the modern perspective leaves the printed letter
  // (notation.ts, "Non-rename operations ... leave the symbol unconverted"). It still collides.
  // Light quanta's β became one in dispatch 259, and it must never render as relativity's γ.
  const modernGlyph =
    entry.operation.kind === "rename"
      ? glyphText(entry.operation.target.modernGlyph)
      : printedGlyph;
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
  // Named glyphs, not a count. A threshold of ten would be satisfied by ten collisions that
  // are not the ones the doctrine cares about, which is the shape of error pane30 found in
  // the light-quanta manifest: the total matched while the specifics were wrong.
  for (const glyph of ["\\beta", "P", "V", "L", "N", "\\nu"]) {
    assert.ok(groups.has(glyph), `glyph ${glyph} must be a recorded cross-paper collision`);
  }
  // And the specific readings AGENTS.md calls out by name, each pinned to its paper.
  const readingOfPaper = (glyph: string, paper: string) =>
    [...(groups.get(glyph) ?? [])].find((r) => r.paper === paper);
  assert.equal(readingOfPaper("\\beta", "light-quanta")?.quantityId, "wienConstantBeta");
  assert.equal(readingOfPaper("\\beta", "special-relativity")?.quantityId, "lorentzFactor");
  assert.equal(readingOfPaper("P", "brownian-motion")?.quantityId, "particleRadius");
  assert.equal(readingOfPaper("P", "light-quanta")?.quantityId, "workFunction");
  assert.equal(readingOfPaper("V", "special-relativity")?.quantityId, "speedOfLight");
  assert.equal(readingOfPaper("V", "brownian-motion")?.quantityId, "volume");
});

test("scopedGlyphs: every paper carries at least one cross-paper glyph collision", () => {
  const groups = collisionGroups();
  const covered = new Set<string>();
  for (const list of groups.values()) {
    for (const reading of list) covered.add(reading.paper);
  }
  // The four by name. A length of 4 is satisfied by any four slugs, including a set that
  // silently swapped a paper for the companion.
  assert.deepEqual(
    [...REQUIRED_PAPERS].sort(),
    ["brownian-motion", "light-quanta", "mass-energy", "special-relativity"],
    "coverage is required for exactly the four papers of the edition",
  );
  for (const paper of REQUIRED_PAPERS) {
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
  const compared = new Set<string>();
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
        compared.add(`${glyph}|${a.paper}|${b.paper}`);
      }
    }
  }
  // Named pairs, not a count: a threshold would be met by twenty comparisons among glyphs
  // nobody cares about while beta or V quietly dropped out of the matrix.
  for (const [glyph, paperA, paperB] of [
    ["\\beta", "light-quanta", "special-relativity"],
    ["V", "brownian-motion", "special-relativity"],
    ["P", "light-quanta", "brownian-motion"],
    ["L", "light-quanta", "mass-energy"],
  ] as const) {
    assert.ok(
      compared.has(`${glyph}|${paperA}|${paperB}`) || compared.has(`${glyph}|${paperB}|${paperA}`),
      `the ${glyph} collision between ${paperA} and ${paperB} was never compared`,
    );
  }
});

/**
 * THE COLLISION THE POPULATION ABOVE CANNOT SEE, and it is one of the two AGENTS.md calls out
 * in red (am-w8v1).
 *
 * `readingOf` requires `quantityId` in the binding, because a Reading has to be renderable as a
 * symbol node. That is right for rendering and wrong for deciding what COLLIDES. Measured over
 * the four concordances on 2026-09-22:
 *
 *     bm.k.viscosity     glyph k  scope [bm-s3, bm-s5]   binding quantityId=viscosity
 *     sr.k.movingSystem  glyph k  scope [sr-s0..sr-s10]  binding nonQuantityKind=coordinate-system-label
 *
 * The second is dropped by that filter, so k yields ONE reading, `papers.size > 1` is false, k
 * never becomes a collision group, and the matrix above never compares it. Its sibling \kappa IS
 * among the 28 groups (brownian's boltzmannConstant against special-relativity's
 * speedDeficitFromLight), so the blindness is specific to a partner that binds a LABEL rather
 * than a quantity, not to k as a character.
 *
 * AGENTS.md: "Einstein's k in paper 2 and in the dissertation is viscosity, not Boltzmann's
 * constant." A hand-written block in notation.test.ts drove this until f4535c8f removed it, and
 * nothing has since: `movingSystem` appears in no other test in the repository. The behaviour is
 * correct today and was simply unguarded, which is the case a ratchet exists for.
 *
 * BOTH DIRECTIONS ARE ASSERTED. A notEqual on its own is satisfied by a renderer that returns
 * the empty string for everything, so the own-paper arm is the positive control that gives the
 * cross-paper arm its meaning. This is also why the assertion compares whole strings rather than
 * using containment, for the reason the test above records: a shared prefix is not a leak.
 */
type LabelPartner = Readonly<{
  readonly paper: string;
  readonly entryId: string;
  readonly printedGlyph: string;
  readonly scope: string;
}>;

/**
 * Rename entries that declare a printed glyph and a scope but bind something that is not a
 * quantity. They cannot be rendered as a symbol node, and they are exactly what makes a glyph a
 * cross-paper collision for a reader.
 */
function labelPartners(): readonly LabelPartner[] {
  const out: LabelPartner[] = [];
  for (const [paper, concordance] of concordances) {
    for (const entry of concordance.entries) {
      if (entry.operation.kind !== "rename") continue;
      if ("quantityId" in entry.binding) continue;
      const printedGlyph = glyphText(entry.glyph);
      const scope = entry.scope?.[0];
      if (!printedGlyph || !scope) continue;
      out.push({ paper, entryId: entry.id, printedGlyph, scope });
    }
  }
  return out;
}

/** The same modern render as `renderModern`, but under a paper and scope chosen by the caller. */
function renderReadingUnder(
  reading: Reading,
  paper: string,
  sectionId: string,
  concordance: PaperConcordance,
): string {
  const node: Expression = {
    kind: "symbol",
    termId: `t.${reading.quantityId}`,
    quantityId: reading.quantityId,
  };
  return renderLatex(node, {
    perspective: "modern",
    paper,
    sectionId,
    concordance,
    registry: registryFor(reading),
    equationId: `scoped-glyph-cross-${reading.entryId}`,
  }).trim();
}

test("scopedGlyphs: a quantity glyph does not modernize inside a paper that spends it on a label", () => {
  const partners = labelPartners();
  const compared = new Set<string>();

  for (const reading of readings) {
    for (const partner of partners) {
      if (partner.printedGlyph !== reading.printedGlyph) continue;
      if (partner.paper === reading.paper) continue;
      // An IDENTITY RENAME carries no information for a leak test, and this arm reported a
      // false leak before the guard existed: light-quanta's \nu is frequency and modernizes to
      // \nu, so "did light-quanta's reading appear inside brownian-motion" cannot be decided by
      // comparing the output to \nu - every paper that correctly leaves the glyph alone matches
      // it too. Measured: without this line the arm failed on \nu (light-quanta:frequency)
      // against bm.nu.index, which is not a leak. Same family as the whole-string comparison
      // above: the test has to be able to tell the two readings apart before it can accuse one.
      if (reading.modernGlyph === reading.printedGlyph) continue;

      const ownConcordance = concordances.get(reading.paper);
      const otherConcordance = concordances.get(partner.paper);
      assert.ok(ownConcordance);
      assert.ok(otherConcordance);

      // Positive control. Without it the assertion below is satisfied by any renderer that
      // stops producing this glyph at all, including a broken one.
      assert.equal(
        renderReadingUnder(reading, reading.paper, reading.scope, ownConcordance),
        reading.modernGlyph,
        `${reading.entryId} must still render ${reading.modernGlyph} in its own paper`,
      );

      assert.notEqual(
        renderReadingUnder(reading, partner.paper, partner.scope, otherConcordance),
        reading.modernGlyph,
        `printed ${reading.printedGlyph} rendered ${reading.paper}'s reading ` +
          `${reading.modernGlyph} (${reading.quantityId}) inside ${partner.paper}, where that ` +
          `glyph is ${partner.entryId}; the lookup leaked across papers`,
      );
      compared.add(`${reading.printedGlyph}|${reading.paper}|${partner.paper}`);
    }
  }

  // Named, not counted, for the same reason as the matrix above: a count is satisfied by
  // comparisons among glyphs nobody is worried about while k quietly drops out. Measured on
  // 2026-09-22 this arm compares 3 pairs out of 149 quantity-bound readings against 15 label
  // partners, with 4 dropped by the identity-rename guard - a small population, which is exactly
  // why it is anchored by identity rather than by a threshold.
  //
  // Both anchors are glyphs AGENTS.md names: k is viscosity in paper 2 and the moving system in
  // paper 3, K is a force in paper 2 and the stationary system in paper 3. The first is the case
  // f4535c8f left uncovered (am-w8v1); the second came with it and is kept for the same reason.
  for (const [glyph, quantityPaper, labelPaper] of [
    ["k", "brownian-motion", "special-relativity"],
    ["K", "brownian-motion", "special-relativity"],
  ] as const) {
    assert.ok(
      compared.has(`${glyph}|${quantityPaper}|${labelPaper}`),
      `the ${glyph} collision between ${quantityPaper} and ${labelPaper} was never compared; ` +
        `it is a case AGENTS.md calls out by name. ` +
        `Compared: ${[...compared].sort().join(", ") || "(nothing)"}`,
    );
  }
});
