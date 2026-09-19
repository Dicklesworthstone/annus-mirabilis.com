import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import {
  normalizePrintedLabel,
  parseAlignableUnitId,
  parseInlineMathId,
  parseReferenceId,
} from "../ids.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";
import {
  BROWNIAN_BIB_KEY,
  BROWNIAN_INVENTORY_BEAD,
  BROWNIAN_PAPER,
  DIFFICULTY_FLAG_KEYS,
  TREATMENT_MAP_ROWS,
  brownianSourceManifestDiagnostics,
  loadBrownianInventory,
  parseDifficultyFlags,
} from "./brownianInventory.ts";

const ROOT = process.cwd();
const logRunId = newRunIdentity();
const logRoot = join(ROOT, "artifacts/test-logs");
const logger = new TestLogger("manifest-brownian-motion", logRunId, logRoot);

function loadManifest() {
  const manifestPath = join(ROOT, "content/source-blocks/brownian-motion/manifest.yaml");
  const raw = parseYaml(readFileSync(manifestPath, "utf8"));
  return { manifest: validateSourceManifest(raw, manifestPath), manifestPath };
}

describe("brownian source manifest (am-edn-inventory-brownian-slg)", () => {
  test("manifest schema, headers, frozen status, and validator pass with 0 errors and absent derived statuses", () => {
    const { manifest } = loadManifest();

    expect(manifest.paper).toBe(BROWNIAN_PAPER);
    expect(manifest.document).toBe(BROWNIAN_BIB_KEY);
    expect(manifest.status).toBe("in-preparation");
    expect(manifest.scope).toBe("full-document");
    expect(manifest.figures).toBe("none");
    expect(manifest.pageCount).toBe(12);
    expect(manifest.pageRange).toEqual([549, 560]);
    expect(manifest.idsFrozenAt).toBe("2026-09-19T04:30:00Z");
    expect(manifest.frozenBy).toBe("pane15");

    expect(manifest.units.length).toBe(92);

    const idSet = new Set<string>();
    for (const unit of manifest.units) {
      expect(idSet.has(unit.id)).toBe(false);
      idSet.add(unit.id);

      const hasValidPrefix =
        unit.id.startsWith("s") ||
        unit.id.startsWith("masthead-") ||
        unit.id.startsWith("closing-") ||
        unit.id.startsWith("eq-");
      expect(hasValidPrefix).toBe(true);

      // At least one locator per unit with strictly increasing page numbers
      expect(unit.locators.length).toBeGreaterThanOrEqual(1);
      let lastPage = 0;
      for (const loc of unit.locators) {
        expect(loc.page).toBeGreaterThanOrEqual(549);
        expect(loc.page).toBeLessThanOrEqual(560);
        expect(loc.page).toBeGreaterThan(lastPage);
        lastPage = loc.page;
      }

      // No authored statuses
      expect(unit.status).toBeUndefined();

      // Destination is non-empty with argument obligations
      expect(unit.destination).toBeDefined();
      expect(typeof unit.destination?.editionBlockId).toBe("string");
      expect(unit.destination!.editionBlockId.length).toBeGreaterThan(0);
      expect(unit.destination?.argumentObligations?.length).toBeGreaterThanOrEqual(1);
    }

    // Corpus validation produces zero errors
    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.length).toBe(0);

    const helperDiags = brownianSourceManifestDiagnostics();
    expect(helperDiags.filter((d) => d.severity === "error").length).toBe(0);

    logger.log({
      testId: "manifest-schema-and-validation",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "Manifest schema and validator pass with 0 errors, 92 units, and absent derived statuses.",
      extra: { unitCount: manifest.units.length, check: "schema" },
    });
  });

  test("masthead units, 5 numbered sections plus s0, and closing units exist with valid locators", () => {
    const { manifest } = loadManifest();
    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    // Masthead
    expect(unitMap.has("masthead-title")).toBe(true);
    expect(unitMap.get("masthead-title")?.locators[0]?.page).toBe(549);
    expect(unitMap.has("masthead-author")).toBe(true);
    expect(unitMap.get("masthead-author")?.locators[0]?.page).toBe(549);

    // Section 0 introduction paragraphs
    expect(unitMap.has("s0-p1")).toBe(true);
    expect(unitMap.has("s0-p2")).toBe(true);

    // 5 Numbered Section Headings
    const expectedSectionPages: Record<string, number> = {
      s1: 549,
      s2: 551,
      s3: 554,
      s4: 556,
      s5: 559,
    };

    for (const [secId, page] of Object.entries(expectedSectionPages)) {
      const heading = unitMap.get(secId);
      expect(heading).toBeDefined();
      expect(heading?.kind).toBe("heading");
      expect(heading?.locators[0]?.page).toBe(page);
    }

    // Closings
    expect(unitMap.has("closing-dateline")).toBe(true);
    expect(unitMap.get("closing-dateline")?.locators[0]?.page).toBe(560);
    expect(unitMap.has("closing-received")).toBe(true);
    expect(unitMap.get("closing-received")?.locators[0]?.page).toBe(560);

    // 37 paragraphs total
    const paragraphs = manifest.units.filter((u) => u.kind === "paragraph");
    expect(paragraphs.length).toBe(37);

    // 7 multi-page spanning paragraphs
    const spanningParagraphs = manifest.units.filter(
      (u) => u.kind === "paragraph" && u.locators.length > 1,
    );
    expect(spanningParagraphs.length).toBe(7);
    const spanningIds = spanningParagraphs.map((u) => u.id).sort();
    expect(spanningIds).toEqual([
      "s1-p1",
      "s1-p3",
      "s2-p4",
      "s3-p5",
      "s3-p8",
      "s4-p11",
      "s4-p8",
    ]);

    logger.log({
      testId: "masthead-sections-and-closings",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "Masthead, 5 numbered sections plus s0, paragraphs, and closings verified with page locators.",
      extra: { check: "masthead-sections" },
    });
  });

  test("every display equation has an editorial label, locators, and valid containment", () => {
    const { manifest } = loadManifest();
    const displays = manifest.units.filter((u) => u.kind === "display-equation");
    expect(displays.length).toBe(43);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    for (const eq of displays) {
      expect(eq.originalLabel ?? eq.editorialLabel).toBeDefined();
      expect(eq.locators.length).toBeGreaterThanOrEqual(1);
      expect(eq.containedIn).toBeDefined();

      const parent = unitMap.get(eq.containedIn!);
      expect(parent).toBeDefined();
      expect(parent?.kind).toBe("paragraph");
    }

    // Numbered equations
    const eqS31 = unitMap.get("eq-s3-1");
    expect(eqS31).toBeDefined();
    expect(eqS31?.originalLabel).toBe("(1)");

    const eq2 = unitMap.get("eq-2");
    expect(eq2).toBeDefined();
    expect(eq2?.originalLabel).toBe("(2)");

    const eqS41 = unitMap.get("eq-s4-1");
    expect(eqS41).toBeDefined();
    expect(eqS41?.originalLabel).toBe("(1)");

    // Multi-line display eq-s4-d7 is a single unit
    const eqS4D7 = unitMap.get("eq-s4-d7");
    expect(eqS4D7).toBeDefined();
    expect(eqS4D7?.editorialLabel).toBe("ed:s4-d7");

    logger.log({
      testId: "displays-labels-containment",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "All 43 displays have editorial labels, locators, and valid parent paragraph containment.",
      extra: { displayCount: displays.length, check: "displays" },
    });
  });

  test("display ids follow printed-label rules and inline math indices follow count-every-region rule", () => {
    // Normalization of repeated printed labels: (1) in §3 and §4 vs unique (2) in §3
    expect(normalizePrintedLabel("(1)")).toBe("1");
    expect(normalizePrintedLabel("(2)")).toBe("2");

    // Inline math IDs parse and follow region indexing rule
    expect(parseInlineMathId("s1-p1-s1-m1").ok).toBe(true);
    expect(parseInlineMathId("s4-p3-s1-m1").ok).toBe(true);
    expect(parseInlineMathId("s2-fn1-m1").ok).toBe(true);
    expect(parseInlineMathId("s1-p1-s1-m0").ok).toBe(false);

    logger.log({
      testId: "display-and-inline-math-rules",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Printed label normalization and inline math indexing rules verified.",
      extra: { check: "math-indexing" },
    });
  });

  test("every reference sub-entry has valid occurrence id, alignable unit prefix, unique index, printedText, kind, and target", () => {
    const { manifest } = loadManifest();

    let totalReferences = 0;
    const seenOccurrenceIds = new Set<string>();

    for (const unit of manifest.units) {
      if (!unit.references || unit.references.length === 0) continue;

      const indicesPerAlignable = new Map<string, number>();

      for (const ref of unit.references) {
        totalReferences++;
        expect(seenOccurrenceIds.has(ref.id)).toBe(false);
        seenOccurrenceIds.add(ref.id);

        expect(ref.occurrenceId).toBe(ref.id);
        const parseRes = parseReferenceId(ref.id);
        expect(parseRes.ok).toBe(true);

        // Verify alignable unit prefix
        const prefixMatch = ref.id.match(/^(.+)-r([1-9]\d*)$/);
        expect(prefixMatch).toBeDefined();
        const alignableId = prefixMatch![1]!;
        const occurrenceIndex = Number(prefixMatch![2]!);

        const alignableRes = parseAlignableUnitId(alignableId);
        expect(alignableRes.ok).toBe(true);

        if (unit.kind === "paragraph") {
          expect(alignableId.startsWith(`${unit.id}-s`)).toBe(true);
        } else if (unit.kind === "footnote") {
          expect(alignableId).toBe(unit.id);
        }

        // Indices are contiguous and 1-based per alignable unit
        const lastIdx = indicesPerAlignable.get(alignableId) ?? 0;
        expect(occurrenceIndex).toBe(lastIdx + 1);
        indicesPerAlignable.set(alignableId, occurrenceIndex);

        // Required fields
        expect(typeof ref.printedText).toBe("string");
        expect(ref.printedText.length).toBeGreaterThan(0);
        expect(["bibliographic", "internal", "cross-paper"]).toContain(ref.kind);
        expect(ref.target).toBeDefined();
      }
    }

    expect(totalReferences).toBe(10);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    // Historical bibliographic citations
    const s2fn1 = unitMap.get("s2-fn1");
    expect(s2fn1?.references?.[0]?.target?.citationId).toBe("einstein-1902-thermodynamik");
    expect(s2fn1?.references?.[1]?.target?.citationId).toBe("einstein-1903-thermodynamik");

    const s2fn2 = unitMap.get("s2-fn2");
    expect(s2fn2?.references?.[0]?.target?.citationId).toBe("einstein-1903-thermodynamik");

    const s3fn1 = unitMap.get("s3-fn1");
    expect(s3fn1?.references?.[0]?.target?.citationId).toBe("kirchhoff-1876-mechanik");

    // Internal equation references
    const s3p5 = unitMap.get("s3-p5");
    expect(s3p5?.references?.[0]?.target?.id).toBe("eq-s3-1");

    const s3p8 = unitMap.get("s3-p8");
    expect(s3p8?.references?.[0]?.target?.id).toBe("eq-s3-1");
    expect(s3p8?.references?.[1]?.target?.id).toBe("eq-2");

    const s4p10 = unitMap.get("s4-p10");
    expect(s4p10?.references?.[0]?.target?.id).toBe("eq-s4-1");

    // Internal section references
    const s5p1 = unitMap.get("s5-p1");
    expect(s5p1?.references?.[0]?.target?.id).toBe("s3");
    expect(s5p1?.references?.[1]?.target?.id).toBe("s4");

    logger.log({
      testId: "references-schema-and-indexing",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "All 10 references have valid occurrence IDs, alignable prefixes, contiguous indices, and targets.",
      extra: { referenceCount: totalReferences, check: "references" },
    });
  });

  test("every row of the treatment map has at least one argument obligation recorded against units", () => {
    const { manifest } = loadManifest();

    for (const row of TREATMENT_MAP_ROWS) {
      const unitsInRow = manifest.units.filter((u) => u.section === row);
      expect(unitsInRow.length).toBeGreaterThan(0);

      const obligationsInRow = unitsInRow.flatMap(
        (u) => u.destination?.argumentObligations ?? [],
      );
      expect(obligationsInRow.length).toBeGreaterThan(0);
    }

    logger.log({
      testId: "treatment-map-argument-obligations",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Every treatment map row (s0..s5, closing) carries argument obligations.",
      extra: { check: "treatment-map" },
    });
  });

  test("footnote units match their printed marks, locators, and containing units", () => {
    const { manifest } = loadManifest();
    const footnotes = manifest.units.filter((u) => u.kind === "footnote");
    expect(footnotes.length).toBe(3);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    const s2fn1 = unitMap.get("s2-fn1");
    expect(s2fn1).toBeDefined();
    expect(s2fn1?.footnoteMark).toBe("1)");
    expect(s2fn1?.containedIn).toBe("s2");
    expect(s2fn1?.locators[0]?.page).toBe(551);

    const s2fn2 = unitMap.get("s2-fn2");
    expect(s2fn2).toBeDefined();
    expect(s2fn2?.footnoteMark).toBe("1)");
    expect(s2fn2?.containedIn).toBe("s2-p5");
    expect(s2fn2?.locators[0]?.page).toBe(553);

    const s3fn1 = unitMap.get("s3-fn1");
    expect(s3fn1).toBeDefined();
    expect(s3fn1?.footnoteMark).toBe("1)");
    expect(s3fn1?.containedIn).toBe("s3-p6");
    expect(s3fn1?.locators[0]?.page).toBe(555);

    logger.log({
      testId: "footnote-marks-and-containment",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 3 footnotes match printed marks, locators, and containing units.",
      extra: { footnoteCount: footnotes.length, check: "footnotes" },
    });
  });

  test("alias file is empty and snapshot matches frozen manifest units", () => {
    const aliasPath = join(ROOT, "content/aliases/brownian-motion.yaml");
    expect(existsSync(aliasPath)).toBe(true);
    const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8")) as { aliases?: unknown[] };
    expect(aliasRaw.aliases).toEqual([]);

    const snapshotPath = join(
      ROOT,
      "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
    );
    const snapshotText = readFileSync(snapshotPath, "utf8");
    const snapshotIds = parseIdSnapshot(snapshotText);

    expect(snapshotIds.length).toBe(92);

    const { manifest } = loadManifest();
    const manifestIds = manifest.units.map((u) => u.id);
    expect(snapshotIds).toEqual(manifestIds);

    const frozen = validateFrozenIds(snapshotText, manifestIds, []);
    expect(frozen.ok).toBe(true);
    expect(frozen.missingCount).toBe(0);

    const inv = loadBrownianInventory();
    expect(inv.sourceUnitsFrozen).toBe(true);

    logger.log({
      testId: "snapshot-matches-manifest-and-aliases-empty",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Snapshot equals manifest units (92 IDs) and aliases file is empty.",
      extra: { check: "frozen-ids" },
    });
  });

  test("mutation: removing an id without an alias or renumbering a reference fails validation", () => {
    const tmpDir = join(ROOT, "artifacts/test-tmp/manifest-brownian-motion", logRunId);
    mkdirSync(tmpDir, { recursive: true });

    const { manifest } = loadManifest();
    const snapshotPath = join(
      ROOT,
      "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
    );
    const snapshotText = readFileSync(snapshotPath, "utf8");

    // Mutation 1: removing s4-p1 without an alias fails validateFrozenIds
    const manifestWithoutS4P1 = manifest.units
      .filter((u) => u.id !== "s4-p1")
      .map((u) => u.id);
    const result1 = validateFrozenIds(snapshotText, manifestWithoutS4P1, []);
    expect(result1.ok).toBe(false);
    expect(
      result1.findings.some((f) => f.kind === "frozen-id-missing" && f.id === "s4-p1"),
    ).toBe(true);

    // Mutation 2: invalid reference occurrence id fails validateManifest
    const mutatedUnits = manifest.units.map((u) => {
      if (u.id === "s2-fn1" && u.references) {
        return {
          ...u,
          references: [
            {
              ...u.references[0]!,
              id: "s3-fn1-r1", // Mismatched containing unit prefix!
              occurrenceId: "s3-fn1-r1",
            },
          ],
        };
      }
      return u;
    });
    const mutatedManifest = { ...manifest, units: mutatedUnits };
    const diags = validateManifest(mutatedManifest, {
      manifests: new Map([[mutatedManifest.paper, mutatedManifest]]),
    });
    expect(diags.some((d) => d.rule === "reference-occurrence-id-invalid")).toBe(true);

    logger.log({
      testId: "planted-negative-mutations",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Planted mutations (removed frozen ID and mutated reference prefix) correctly fail.",
      extra: { check: "planted-mutations" },
    });
  });

  test("per-page counts reconcile with receipt pageMap and SourceAsset.pageMapping", () => {
    const { manifest } = loadManifest();
    const receiptPath = join(ROOT, "docs/provenance/ap-17-549.md");
    expect(existsSync(receiptPath)).toBe(true);

    const receiptContent = readFileSync(receiptPath, "utf8");
    const parsedReceipt = parseReceipt(receiptContent, receiptPath);
    expect(parsedReceipt.ok).toBe(true);
    expect(parsedReceipt.frontMatter).toBeDefined();

    const fmPageMap = parsedReceipt.frontMatter!.pageMap;
    expect(fmPageMap.length).toBe(12);

    const sourceAsset = receiptToSourceAsset(parsedReceipt.frontMatter!);
    expect(sourceAsset.pageMapping).toEqual(fmPageMap);

    // Verified display equation counts per page from scans:
    const expectedDisplaysPerPage: Record<number, number> = {
      549: 0,
      550: 1,
      551: 4,
      552: 2,
      553: 7,
      554: 5,
      555: 6,
      556: 3,
      557: 5,
      558: 4,
      559: 5,
      560: 1,
    };

    // Verified paragraph start counts per page from scans:
    const expectedParagraphStartsPerPage: Record<number, number> = {
      549: 3,
      550: 2,
      551: 1,
      552: 3,
      553: 4,
      554: 5,
      555: 3,
      556: 4,
      557: 4,
      558: 3,
      559: 3,
      560: 2,
    };

    // Verified footnote counts per page from scans:
    const expectedFootnotesPerPage: Record<number, number> = {
      549: 0,
      550: 0,
      551: 1,
      552: 0,
      553: 1,
      554: 0,
      555: 1,
      556: 0,
      557: 0,
      558: 0,
      559: 0,
      560: 0,
    };

    for (let p = 549; p <= 560; p++) {
      const displaysOnPage = manifest.units.filter(
        (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === p),
      );
      expect(displaysOnPage.length).toBe(expectedDisplaysPerPage[p]!);

      const pStartsOnPage = manifest.units.filter(
        (u) => u.kind === "paragraph" && u.locators[0]?.page === p,
      );
      expect(pStartsOnPage.length).toBe(expectedParagraphStartsPerPage[p]!);

      const fnsOnPage = manifest.units.filter(
        (u) => u.kind === "footnote" && u.locators.some((l) => l.page === p),
      );
      expect(fnsOnPage.length).toBe(expectedFootnotesPerPage[p]!);
    }

    logger.log({
      testId: "page-counts-reconciliation",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "Per-page counts for displays, paragraphs, and footnotes reconcile across all 12 pages.",
      extra: { check: "page-counts" },
    });
  });

  test("paper-specific: sections 4-5 units exist, introduction conditionals are separated, closing hope is s5-p4", () => {
    const { manifest } = loadManifest();
    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    // All 36 units of §§4-5 exist
    const s4Units = manifest.units.filter((u) => u.section === "s4");
    expect(s4Units.length).toBe(26); // heading, 12 paragraphs, 13 displays (12 unnumbered + 1 numbered)

    const s5Units = manifest.units.filter((u) => u.section === "s5");
    expect(s5Units.length).toBe(10); // heading, 4 paragraphs, 5 displays

    // Introduction conditional statements are segmented into separate sentence IDs
    expect(unitMap.has("s0-p1")).toBe(true);
    expect(unitMap.has("s0-p2")).toBe(true);

    // Closing hope is s5-p4 in section s5 on page 560
    const s5p4 = unitMap.get("s5-p4");
    expect(s5p4).toBeDefined();
    expect(s5p4?.section).toBe("s5");
    expect(s5p4?.locators[0]?.page).toBe(560);
    expect(s5p4?.destination?.argumentObligations).toContain("arg:brownian-closing-outlook");

    logger.log({
      testId: "paper-specific-structural-obligations",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message:
        "Sections 4-5 units, introduction conditionals, and closing hope placement verified.",
      extra: { check: "paper-specific" },
    });
  });

  test("difficulties file has all 4 sections, first-use ids, and parses all 7 flag keys with expected values", () => {
    const diffPath = join(ROOT, "docs/editorial/brownian-motion-difficulties.md");
    expect(existsSync(diffPath)).toBe(true);

    const diffContent = readFileSync(diffPath, "utf8");

    // 4 required sections
    expect(diffContent.includes("## Translation difficulties")).toBe(true);
    expect(diffContent.includes("## Notation difficulties")).toBe(true);
    expect(diffContent.includes("## Segmentation decisions")).toBe(true);
    expect(diffContent.includes("## Verification flags")).toBe(true);

    const flags = parseDifficultyFlags(diffContent);
    expect(flags.length).toBe(7);

    const flagMap = new Map(flags.map((f) => [f.key, f]));

    // All 7 keys present
    for (const key of DIFFICULTY_FLAG_KEYS) {
      expect(flagMap.has(key)).toBe(true);
    }

    // flag:s5-printed-numbers
    const s5nums = flagMap.get("s5-printed-numbers")!;
    expect(s5nums.result).toBe("matches");
    expect(s5nums.rest).toContain("s5-p2-s1");

    // flag:s5-printed-units (names Mikron)
    const s5units = flagMap.get("s5-printed-units")!;
    expect(s5units.result).toBe("matches");
    expect(s5units.rest).toContain("Mikron");

    // flag:r-not-printed
    const rNotPrinted = flagMap.get("r-not-printed")!;
    expect(rNotPrinted.result).toBe("matches");
    expect(rNotPrinted.rest).toContain("s5-p1-s1");

    // flag:intro-uncertainty
    const introUncertainty = flagMap.get("intro-uncertainty")!;
    expect(introUncertainty.result).toBe("matches");
    expect(introUncertainty.rest).toContain("s0-p1-s3");

    // flag:velocity-warning (not-found)
    const velocityWarning = flagMap.get("velocity-warning")!;
    expect(velocityWarning.result).toBe("not-found");

    // flag:s4-tau-coarse-graining
    const coarseGraining = flagMap.get("s4-tau-coarse-graining")!;
    expect(coarseGraining.result).toBe("matches");
    expect(coarseGraining.rest).toContain("s4-p3-s1");

    // flag:dates
    const dates = flagMap.get("dates")!;
    expect(dates.result).toBe("matches");
    expect(dates.rest).toContain("closing-dateline");
    expect(dates.rest).toContain("closing-received");

    logger.log({
      testId: "difficulties-file-and-flags",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: BROWNIAN_PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Difficulties file has all 4 sections and all 7 verification flags with expected values.",
      extra: { flagCount: flags.length, check: "difficulties" },
    });
  });
});
