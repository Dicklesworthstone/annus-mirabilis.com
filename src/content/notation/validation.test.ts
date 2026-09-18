/**
 * Tests for Concordance Compiler Validation & Diagnostic Rules.
 * Specification: am-not-concordance-model-uag, AGENTS.md (§2.3, §4.5, §4.7, §6.1, §11.4)
 */

import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { buildSourceManifestIndex } from "./resolve.ts";
import type { PaperConcordance } from "./types.ts";
import { checkConcordance } from "./validation.ts";

const logger = getLogger("notation-model");

describe("Concordance Compiler Validation (am-not-concordance-model-uag)", () => {
  test("detects unflagged modern-glyph-collision when distinct quantities map to same modern glyph", () => {
    const invalidConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        // Quantity 1: friction coefficient f -> modern symbol p
        {
          id: "bm.f.friction",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "f", latex: "f" },
          meaning: "Friction coefficient",
          binding: { quantityId: "frictionCoefficient" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
        // Quantity 2: pressure p -> modern symbol p (unflagged collision)
        {
          id: "bm.p.pressure",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "p", latex: "p" },
          meaning: "Hydrostatic pressure",
          binding: { quantityId: "pressure" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(invalidConcordance);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "modern-glyph-collision")).toBe(true);

    logger.log({
      testId: "diag-modern-glyph-collision",
      outcome: "passed",
      message:
        "Detected modern-glyph-collision for distinct quantities mapping to p in same section",
    });
  });

  test("passes modern-glyph-collision when collision record is properly declared", () => {
    const validConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.f.friction",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "f", latex: "f" },
          meaning: "Friction coefficient",
          binding: { quantityId: "frictionCoefficient" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          collision: {
            severity: "caution",
            kind: "within-paper",
            collidesWith: ["bm.p.pressure"],
            firstUseAnchor: "bm-s3-p1",
            firstUseBySection: [{ sectionId: "s3", anchor: "bm-s3-p1" }],
          },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
        {
          id: "bm.p.pressure",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "p", latex: "p" },
          meaning: "Hydrostatic pressure",
          binding: { quantityId: "pressure" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          collision: {
            severity: "caution",
            kind: "within-paper",
            collidesWith: ["bm.f.friction"],
            firstUseAnchor: "bm-s3-p1",
            firstUseBySection: [{ sectionId: "s3", anchor: "bm-s3-p1" }],
          },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(validConcordance);
    expect(res.valid).toBe(true);
    expect(res.diagnostics.some((d) => d.rule === "modern-glyph-collision")).toBe(false);
  });

  test("detects cross-toggle-unflagged when modern-only symbol collides with printed symbol across scopes without caution", () => {
    const invalidConcordance: PaperConcordance = {
      paper: "light-quanta",
      entries: [
        // Printed \mu for mass in section 2
        {
          id: "lq.mu.mass",
          paper: "light-quanta",
          scope: ["s2"],
          glyph: { unicode: "μ", latex: "\\mu" },
          meaning: "Mass of a particle",
          binding: { quantityId: "particleMass" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "m" } },
          sources: { anchor: "lq-s2-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
      modernOnlySymbols: [
        // Modern-only \mu for mobility in modern lens for section 1
        {
          id: "mobility",
          glyph: { unicode: "μ", latex: "\\mu" },
          binding: { quantityId: "mobility" },
          scope: ["s1"],
          introducedBy: "modern-lens",
          label: "Particle mobility",
        },
      ],
    };

    const res = checkConcordance(invalidConcordance);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "cross-toggle-unflagged")).toBe(true);

    logger.log({
      testId: "diag-cross-toggle-unflagged",
      outcome: "passed",
      message: "Detected unflagged cross-toggle collision between modern mobility and printed mass",
    });
  });

  test("unconditionally refuses modern-only symbol that matches printed glyph in the same scope", () => {
    const invalidConcordance: PaperConcordance = {
      paper: "special-relativity",
      entries: [
        // Printed \varphi in §3 as scale factor
        {
          id: "sr.varphi.scaleFactor",
          paper: "special-relativity",
          scope: ["s3"],
          glyph: { unicode: "φ", latex: "\\varphi" },
          meaning: "Unknown scale factor",
          binding: { quantityId: "scaleFactor" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\phi(v)" } },
          sources: { anchor: "sr-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
      modernOnlySymbols: [
        // Attempting to define modern-only rapidity with \varphi in the SAME section s3
        {
          id: "rapidity",
          glyph: { unicode: "φ", latex: "\\varphi" },
          binding: { quantityId: "rapidity" },
          scope: ["s3"],
          introducedBy: "modern-lens",
          label: "Rapidity",
        },
      ],
    };

    const res = checkConcordance(invalidConcordance);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "same-scope-modern-only-printed-clash")).toBe(
      true,
    );

    logger.log({
      testId: "diag-same-scope-modern-only-printed-clash",
      outcome: "passed",
      message:
        "Unconditionally refused modern-only rapidity clashing with printed varphi in same section",
    });
  });

  test("detects scope-overlap for multiple entries defining the same printed glyph in overlapping scope", () => {
    const invalidConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.k.viscosity",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "k", latex: "k" },
          meaning: "Viscosity",
          binding: { quantityId: "viscosity" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\eta" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
        {
          id: "bm.k.boltzmann",
          paper: "brownian-motion",
          scope: ["s3", "s4"], // Overlaps with s3!
          glyph: { unicode: "k", latex: "k" },
          meaning: "Boltzmann constant",
          binding: { quantityId: "boltzmannConstant" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "k_B" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(invalidConcordance);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "scope-overlap")).toBe(true);

    logger.log({
      testId: "diag-scope-overlap",
      outcome: "passed",
      message: "Detected scope overlap for k defined twice in s3",
    });
  });

  test("detects invalid unit system and scaled-rename mismatch", () => {
    const invalidUnitConcordance: PaperConcordance = {
      paper: "special-relativity",
      entries: [
        {
          id: "sr.X.field",
          paper: "special-relativity",
          scope: ["s6"],
          glyph: { unicode: "X", latex: "X" },
          meaning: "Electric field",
          binding: { quantityId: "electricField" },
          operation: {
            kind: "unitConversion",
            fromSystem: "gaussian" as any, // Loose name 'gaussian' is invalid!
            toSystem: "si",
            factor: 1,
          },
          sources: { anchor: "sr-s6-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
        {
          id: "sr.scaled.bad",
          paper: "special-relativity",
          scope: ["s1"],
          glyph: { unicode: "a", latex: "a" },
          meaning: "Bad scale",
          binding: {
            quantityId: "someQuantity",
            scale: { num: 2, den: 4 }, // Unreduced fraction!
          },
          operation: {
            kind: "rename",
            target: {
              form: "scaled",
              modernTree: null as any, // Missing tree!
            },
          },
          sources: { anchor: "sr-s1-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(invalidUnitConcordance);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "unit-conversion-invalid-system")).toBe(true);
    expect(res.diagnostics.some((d) => d.rule === "scaled-rename-mismatch")).toBe(true);
  });

  test("detects missing or invalid collision anchors against source manifest", () => {
    const manifestIndex = buildSourceManifestIndex({
      paper: "brownian-motion",
      document: "ap-17-549",
      status: "complete",
      pageCount: 12,
      pageRange: [549, 560],
      units: [{ id: "bm-s3-p1", kind: "paragraph", section: "s3", locators: [{ page: 552 }] }],
    });

    const invalidCollisionConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.k.viscosity",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "k", latex: "k" },
          meaning: "Viscosity",
          binding: { quantityId: "viscosity" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\eta" } },
          collision: {
            severity: "caution",
            kind: "cross-paper",
            collidesWith: [],
            collidesWithModern: [], // Empty targets!
            firstUseAnchor: "non-existent-anchor", // Bad anchor!
            firstUseBySection: [{ sectionId: "s3", anchor: "also-bad" }],
          },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(invalidCollisionConcordance, { manifestIndex });
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "collision-targets-empty")).toBe(true);
    expect(res.diagnostics.some((d) => d.rule === "collision-missing-first-use")).toBe(true);
  });

  test("validates entry.sources.anchor and entry.scope against manifest index, failing on unknown anchors/scopes and passing when valid", () => {
    const manifestIndex = buildSourceManifestIndex({
      paper: "brownian-motion",
      document: "ap-17-549",
      status: "complete",
      pageCount: 12,
      pageRange: [549, 560],
      units: [{ id: "bm-s3-p1", kind: "paragraph", section: "s3", locators: [{ page: 552 }] }],
    });

    // Refusal: bad sources.anchor and bad scope
    const invalidAnchorsConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.k.viscosity",
          paper: "brownian-motion",
          scope: ["non-existent-section"], // Unknown scope!
          glyph: { unicode: "k", latex: "k" },
          meaning: "Viscosity",
          binding: { quantityId: "viscosity" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\eta" } },
          sources: { anchor: "non-existent-anchor" }, // Unknown source anchor!
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const failRes = checkConcordance(invalidAnchorsConcordance, { manifestIndex });
    expect(failRes.valid).toBe(false);
    expect(failRes.diagnostics.some((d) => d.rule === "unknown-source-anchor")).toBe(true);
    expect(failRes.diagnostics.some((d) => d.rule === "unknown-scope")).toBe(true);

    // Passing counterpart: valid sources.anchor and valid section scope in manifest
    const validAnchorsConcordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.k.viscosity",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "k", latex: "k" },
          meaning: "Viscosity",
          binding: { quantityId: "viscosity" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\eta" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const passRes = checkConcordance(validAnchorsConcordance, { manifestIndex });
    expect(passRes.valid).toBe(true);
    expect(passRes.diagnostics.some((d) => d.rule === "unknown-source-anchor")).toBe(false);
    expect(passRes.diagnostics.some((d) => d.rule === "unknown-scope")).toBe(false);

    logger.log({
      testId: "diag-sources-anchor-and-scope-manifest-validation",
      outcome: "passed",
      message:
        "Refused unknown sources.anchor and unknown scope against manifest index, and passed valid counterpart",
    });
  });

  test("detects unknown quantity IDs when knownQuantityIds provided", () => {
    const concordance: PaperConcordance = {
      paper: "brownian-motion",
      entries: [
        {
          id: "bm.k.viscosity",
          paper: "brownian-motion",
          scope: ["s3"],
          glyph: { unicode: "k", latex: "k" },
          meaning: "Viscosity",
          binding: { quantityId: "unregisteredQuantity123" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "\\eta" } },
          sources: { anchor: "bm-s3-p1" },
          verification: { printed: true, checkedAgainst: "AP", by: "rev", date: "2026-09-17" },
        },
      ],
    };

    const res = checkConcordance(concordance, {
      knownQuantityIds: ["speedOfLight", "viscosity", "boltzmannConstant"],
    });
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "unknown-quantity-id")).toBe(true);
  });
});
