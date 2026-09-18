/**
 * Refusal diagnostic coverage for src/content/notation/validation.ts (am-muyh).
 *
 * Covers all 8 refusal diagnostic sites in validation.ts:
 * 1. (validation.ts:63)  empty-concordance
 * 2. (validation.ts:80)  duplicate-entry-id
 * 3. (validation.ts:144) scaled-rename-mismatch (scale factor not reduced to lowest terms)
 * 4. (validation.ts:158) scaled-rename-mismatch (scaled rename requires modernTree)
 * 5. (validation.ts:182) unit-conversion-invalid-system (invalid toSystem)
 * 6. (validation.ts:223) collision-missing-first-use (firstUseAnchor not in source manifest)
 * 7. (validation.ts:234) collision-missing-first-use (missing or empty firstUseBySection)
 * 8. (validation.ts:248) collision-missing-first-use (firstUseBySection anchor not in source manifest)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSourceManifestIndex } from "./resolve.ts";
import type { ConcordanceEntry, PaperConcordance, RenameTarget } from "./types.ts";
import { checkConcordance } from "./validation.ts";

function createValidEntry(overrides?: Partial<ConcordanceEntry>): ConcordanceEntry {
  return {
    id: "bm.k.viscosity",
    paper: "brownian-motion",
    scope: ["s1"],
    glyph: { unicode: "k", latex: "k" },
    meaning: "Viscosity coefficient",
    binding: { quantityId: "viscosity" },
    operation: { kind: "rename", target: { form: "symbol", modernGlyph: "k" } },
    sources: { anchor: "s1-p1" },
    verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
    ...overrides,
  };
}

describe("Notation Validation Refusals (validation.ts)", () => {
  // 1. (validation.ts:63) empty-concordance
  describe("Site (validation.ts:63): empty-concordance", () => {
    it("reports empty-concordance diagnostic when concordance has zero entries (validation.ts:63)", () => {
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [],
      };
      const res = checkConcordance(pc);
      assert.ok(res.diagnostics.some((d) => d.rule === "empty-concordance"));
    });

    it("accepts concordance with at least one entry without empty-concordance diagnostic (validation.ts:63)", () => {
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [createValidEntry()],
      };
      const res = checkConcordance(pc);
      assert.ok(!res.diagnostics.some((d) => d.rule === "empty-concordance"));
    });
  });

  // 2. (validation.ts:80) duplicate-entry-id
  describe("Site (validation.ts:80): duplicate-entry-id", () => {
    it("reports duplicate-entry-id diagnostic when two entries share the same ID (validation.ts:80)", () => {
      const entryA = createValidEntry({ id: "bm.k.same-id" });
      const entryB = createValidEntry({ id: "bm.k.same-id", meaning: "Second duplicate entry" });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entryA, entryB],
      };
      const res = checkConcordance(pc);
      assert.ok(res.diagnostics.some((d) => d.rule === "duplicate-entry-id"));
    });

    it("accepts concordance with distinct entry IDs without duplicate-entry-id diagnostic (validation.ts:80)", () => {
      const entryA = createValidEntry({ id: "bm.k.first" });
      const entryB = createValidEntry({ id: "bm.k.second", glyph: { unicode: "p", latex: "p" } });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entryA, entryB],
      };
      const res = checkConcordance(pc);
      assert.ok(!res.diagnostics.some((d) => d.rule === "duplicate-entry-id"));
    });
  });

  // 3. (validation.ts:144) scaled-rename-mismatch (scale factor not reduced to lowest terms)
  describe("Site (validation.ts:144): scaled-rename-mismatch (rational reduction)", () => {
    it("reports scaled-rename-mismatch when scale factor is not in lowest terms (validation.ts:144)", () => {
      const entry = createValidEntry({
        binding: {
          quantityId: "viscosity",
          scale: { num: 2, den: 4 }, // 2/4 is not reduced to lowest terms
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      const diag = res.diagnostics.find(
        (d) => d.rule === "scaled-rename-mismatch" && d.message.includes("lowest terms"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "scaled-rename-mismatch");
    });

    it("accepts scale factor reduced to lowest terms (validation.ts:144)", () => {
      const entry = createValidEntry({
        binding: {
          quantityId: "viscosity",
          scale: { num: 1, den: 2 }, // 1/2 is reduced
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      assert.ok(
        !res.diagnostics.some(
          (d) => d.rule === "scaled-rename-mismatch" && d.message.includes("lowest terms"),
        ),
      );
    });
  });

  // 4. (validation.ts:158) scaled-rename-mismatch (scaled rename requires modernTree)
  describe("Site (validation.ts:158): scaled-rename-mismatch (modernTree required)", () => {
    it("reports scaled-rename-mismatch when scaled rename target lacks modernTree (validation.ts:158)", () => {
      const entry = createValidEntry({
        operation: {
          kind: "rename",
          target: {
            form: "scaled",
            modernGlyph: "c",
            // modernTree is missing
          } as unknown as RenameTarget,
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      const diag = res.diagnostics.find(
        (d) => d.rule === "scaled-rename-mismatch" && d.message.includes("requires modernTree"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "scaled-rename-mismatch");
    });

    it("accepts scaled rename target when modernTree is present (validation.ts:158)", () => {
      const entry = createValidEntry({
        operation: {
          kind: "rename",
          target: {
            form: "scaled",
            modernGlyph: "c",
            modernTree: { kind: "symbol", symbol: "c" } as unknown as Record<string, unknown>,
          },
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      assert.ok(
        !res.diagnostics.some(
          (d) => d.rule === "scaled-rename-mismatch" && d.message.includes("requires modernTree"),
        ),
      );
    });
  });

  // 5. (validation.ts:182) unit-conversion-invalid-system (invalid toSystem)
  describe("Site (validation.ts:182): unit-conversion-invalid-system (toSystem)", () => {
    it("reports unit-conversion-invalid-system when toSystem is not in allowed unit systems (validation.ts:182)", () => {
      const entry = createValidEntry({
        operation: {
          kind: "unitConversion",
          fromSystem: "cgs",
          toSystem: "unapproved-system" as unknown as "si",
          factor: 1,
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      const diag = res.diagnostics.find(
        (d) => d.rule === "unit-conversion-invalid-system" && d.message.includes("toSystem"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "unit-conversion-invalid-system");
    });

    it("accepts recognized toSystem like si (validation.ts:182)", () => {
      const entry = createValidEntry({
        operation: {
          kind: "unitConversion",
          fromSystem: "cgs",
          toSystem: "si",
          factor: 1,
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };
      const res = checkConcordance(pc);
      assert.ok(
        !res.diagnostics.some(
          (d) => d.rule === "unit-conversion-invalid-system" && d.message.includes("toSystem"),
        ),
      );
    });
  });

  // 6. (validation.ts:223) collision-missing-first-use (firstUseAnchor not in manifest)
  describe("Site (validation.ts:223): collision-missing-first-use (firstUseAnchor in manifest)", () => {
    it("reports collision-missing-first-use when firstUseAnchor is absent from manifest index (validation.ts:223)", () => {
      const manifestIndex = buildSourceManifestIndex({
        paper: "brownian-motion",
        document: "ap-17-549",
        status: "complete",
        pageCount: 12,
        pageRange: [549, 560],
        units: [{ id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 549 }] }],
      });

      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "unknown-manifest-anchor",
          firstUseBySection: [{ sectionId: "s1", anchor: "s1-p1" }],
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc, { manifestIndex });
      const diag = res.diagnostics.find(
        (d) => d.rule === "collision-missing-first-use" && d.message.includes("firstUseAnchor"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "collision-missing-first-use");
    });

    it("accepts collision record when firstUseAnchor is present in manifest index (validation.ts:223)", () => {
      const manifestIndex = buildSourceManifestIndex({
        paper: "brownian-motion",
        document: "ap-17-549",
        status: "complete",
        pageCount: 12,
        pageRange: [549, 560],
        units: [{ id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 549 }] }],
      });

      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "s1-p1",
          firstUseBySection: [{ sectionId: "s1", anchor: "s1-p1" }],
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc, { manifestIndex });
      assert.ok(
        !res.diagnostics.some(
          (d) => d.rule === "collision-missing-first-use" && d.message.includes("firstUseAnchor"),
        ),
      );
    });
  });

  // 7. (validation.ts:234) collision-missing-first-use (missing/empty firstUseBySection)
  describe("Site (validation.ts:234): collision-missing-first-use (firstUseBySection required)", () => {
    it("reports collision-missing-first-use when firstUseBySection is empty (validation.ts:234)", () => {
      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "s1-p1",
          firstUseBySection: [], // empty
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc);
      const diag = res.diagnostics.find(
        (d) =>
          d.rule === "collision-missing-first-use" &&
          d.message.includes("requires non-empty firstUseBySection"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "collision-missing-first-use");
    });

    it("accepts collision record when firstUseBySection contains sections (validation.ts:234)", () => {
      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "s1-p1",
          firstUseBySection: [{ sectionId: "s1", anchor: "s1-p1" }],
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc);
      assert.ok(
        !res.diagnostics.some(
          (d) =>
            d.rule === "collision-missing-first-use" &&
            d.message.includes("requires non-empty firstUseBySection"),
        ),
      );
    });
  });

  // 8. (validation.ts:248) collision-missing-first-use (section anchor not in manifest)
  describe("Site (validation.ts:248): collision-missing-first-use (section anchor in manifest)", () => {
    it("reports collision-missing-first-use when section anchor in firstUseBySection is absent from manifest index (validation.ts:248)", () => {
      const manifestIndex = buildSourceManifestIndex({
        paper: "brownian-motion",
        document: "ap-17-549",
        status: "complete",
        pageCount: 12,
        pageRange: [549, 560],
        units: [{ id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 549 }] }],
      });

      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "s1-p1",
          firstUseBySection: [{ sectionId: "s1", anchor: "unknown-section-anchor" }],
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc, { manifestIndex });
      const diag = res.diagnostics.find(
        (d) =>
          d.rule === "collision-missing-first-use" &&
          d.message.includes("Collision section anchor"),
      );
      assert.ok(diag !== undefined);
      assert.equal(diag.rule, "collision-missing-first-use");
    });

    it("accepts collision record when all section anchors in firstUseBySection exist in manifest index (validation.ts:248)", () => {
      const manifestIndex = buildSourceManifestIndex({
        paper: "brownian-motion",
        document: "ap-17-549",
        status: "complete",
        pageCount: 12,
        pageRange: [549, 560],
        units: [{ id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 549 }] }],
      });

      const entry = createValidEntry({
        collision: {
          severity: "caution",
          kind: "cross-paper",
          collidesWith: ["sr.beta.velocity"],
          firstUseAnchor: "s1-p1",
          firstUseBySection: [{ sectionId: "s1", anchor: "s1-p1" }],
        },
      });
      const pc: PaperConcordance = {
        paper: "brownian-motion",
        entries: [entry],
      };

      const res = checkConcordance(pc, { manifestIndex });
      assert.ok(
        !res.diagnostics.some(
          (d) =>
            d.rule === "collision-missing-first-use" &&
            d.message.includes("Collision section anchor"),
        ),
      );
    });
  });
});
