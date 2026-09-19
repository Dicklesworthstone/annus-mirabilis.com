import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";

const ROOT = process.cwd();
const MASS_ENERGY_BEAD = "am-edn-inventory-mass-energy-g2d";
const BIB_KEY = "ap-18-639";
const PAPER_SLUG = "mass-energy";

const logRoot = mkdtempSync(join(tmpdir(), "mass-energy-manifest-"));
const logger = new TestLogger("manifest-mass-energy", newRunIdentity(), logRoot);

function loadManifest() {
  const manifestPath = join(ROOT, "content/source-blocks/mass-energy/manifest.yaml");
  const raw = parseYaml(readFileSync(manifestPath, "utf8"));
  return { manifest: validateSourceManifest(raw, manifestPath), manifestPath };
}

describe("mass-energy source manifest inventory (am-edn-inventory-mass-energy-g2d)", () => {
  test("manifest validates with valid ids, locators, frozen headers, and absent derived statuses", () => {
    const { manifest, manifestPath } = loadManifest();
    expect(manifest.paper).toBe(PAPER_SLUG);
    expect(manifest.document).toBe(BIB_KEY);
    expect(manifest.status).toBe("in-preparation");
    expect(manifest.scope).toBe("full-document");
    expect(manifest.figures).toBe("none");
    expect(manifest.pageCount).toBe(3);
    expect(manifest.pageRange).toEqual([639, 641]);
    expect(manifest.idsFrozenAt).toBe("2026-09-19T00:00:00Z");
    expect(manifest.frozenBy).toBe(MASS_ENERGY_BEAD);

    expect(manifest.units.length).toBe(28);

    // No duplicate ids
    const idSet = new Set<string>();
    for (const unit of manifest.units) {
      expect(idSet.has(unit.id)).toBe(false);
      idSet.add(unit.id);

      // Every id begins with s0, masthead-, closing-, or eq-
      const hasValidPrefix =
        unit.id.startsWith("s0") ||
        unit.id.startsWith("masthead-") ||
        unit.id.startsWith("closing-") ||
        unit.id.startsWith("eq-");
      expect(hasValidPrefix).toBe(true);

      // At least one locator per unit
      expect(unit.locators.length).toBeGreaterThanOrEqual(1);

      // No authored statuses
      expect(unit.status).toBeUndefined();

      // Destination is non-empty
      expect(unit.destination).toBeDefined();
    }

    // Corpus validation has zero errors
    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.length).toBe(0);

    logger.log({
      testId: "mass-energy-manifest-schema-and-validation",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Manifest schema and validator pass with 0 errors and valid ID prefixes.",
      extra: { unitCount: manifest.units.length, check: "schema" },
    });
  });

  test("every display equation has an editorial label, locators, and valid containment", () => {
    const { manifest } = loadManifest();
    const displays = manifest.units.filter((u) => u.kind === "display-equation");
    expect(displays.length).toBe(7);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    for (let j = 1; j <= 7; j++) {
      const eqId = `eq-s0-d${j}`;
      const eq = unitMap.get(eqId);
      expect(eq).toBeDefined();
      expect(eq?.editorialLabel).toBe(`ed:s0-d${j}`);
      expect(eq?.locators.length).toBeGreaterThanOrEqual(1);
      expect(eq?.containedIn).toBeDefined();

      const parent = unitMap.get(eq!.containedIn!);
      expect(parent).toBeDefined();
      expect(parent?.kind).toBe("paragraph");
    }

    logger.log({
      testId: "mass-energy-displays-labels-and-containment",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 7 displays have editorial labels, locators, and valid parent containment.",
      extra: { displayCount: displays.length, check: "displays" },
    });
  });

  test("counts reconcile with receipt pageMap and SourceAsset.pageMapping", () => {
    const { manifest } = loadManifest();
    const receiptPath = join(ROOT, "docs/provenance/ap-18-639.md");
    expect(existsSync(receiptPath)).toBe(true);

    const receiptContent = readFileSync(receiptPath, "utf8");
    const parsedReceipt = parseReceipt(receiptContent, receiptPath);
    expect(parsedReceipt.ok).toBe(true);
    expect(parsedReceipt.frontMatter).toBeDefined();

    const fmPageMap = parsedReceipt.frontMatter!.pageMap;
    expect(fmPageMap.length).toBe(3);

    const sourceAsset = receiptToSourceAsset(parsedReceipt.frontMatter!);
    expect(sourceAsset.pageMapping).toEqual(fmPageMap);

    // Page 639
    const p1 = fmPageMap[0]!;
    expect(p1.pdfPageIndex).toBe(1);
    expect(p1.printedPage).toBe(639);
    expect(p1.displayEquations.unnumberedIds).toEqual(["eq-s0-d1"]);
    expect(p1.footnoteMarks).toEqual(["1)", "2)"]);
    expect(p1.refinedBy).toBe(MASS_ENERGY_BEAD);

    // Page 640
    const p2 = fmPageMap[1]!;
    expect(p2.pdfPageIndex).toBe(2);
    expect(p2.printedPage).toBe(640);
    expect(p2.displayEquations.unnumberedIds).toEqual(["eq-s0-d2", "eq-s0-d3", "eq-s0-d4"]);
    expect(p2.footnoteMarks).toEqual([]);
    expect(p2.refinedBy).toBe(MASS_ENERGY_BEAD);

    // Page 641
    const p3 = fmPageMap[2]!;
    expect(p3.pdfPageIndex).toBe(3);
    expect(p3.printedPage).toBe(641);
    expect(p3.displayEquations.unnumberedIds).toEqual(["eq-s0-d5", "eq-s0-d6", "eq-s0-d7"]);
    expect(p3.footnoteMarks).toEqual([]);
    expect(p3.refinedBy).toBe(MASS_ENERGY_BEAD);

    // Reconcile manifest displays per page
    const displaysOnP1 = manifest.units.filter(
      (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === 639),
    );
    expect(displaysOnP1.map((u) => u.id)).toEqual(p1.displayEquations.unnumberedIds!);

    const displaysOnP2 = manifest.units.filter(
      (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === 640),
    );
    expect(displaysOnP2.map((u) => u.id)).toEqual(p2.displayEquations.unnumberedIds!);

    const displaysOnP3 = manifest.units.filter(
      (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === 641),
    );
    expect(displaysOnP3.map((u) => u.id)).toEqual(p3.displayEquations.unnumberedIds!);

    // Reconcile paragraphs starting per page
    const pStartsP1 = manifest.units.filter(
      (u) => u.kind === "paragraph" && u.locators[0]?.page === 639,
    );
    expect(pStartsP1.length).toBe(5); // s0-p1 .. s0-p5

    const pStartsP2 = manifest.units.filter(
      (u) => u.kind === "paragraph" && u.locators[0]?.page === 640,
    );
    expect(pStartsP2.length).toBe(4); // s0-p6 .. s0-p9

    const pStartsP3 = manifest.units.filter(
      (u) => u.kind === "paragraph" && u.locators[0]?.page === 641,
    );
    expect(pStartsP3.length).toBe(6); // s0-p10 .. s0-p15

    // Paragraph s0-p9 spans across pages 640 and 641
    const p9 = manifest.units.find((u) => u.id === "s0-p9");
    expect(p9?.locators.map((l) => l.page)).toEqual([640, 641]);

    logger.log({
      testId: "mass-energy-counts-reconcile-pagemap",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Counts reconcile with receipt pageMap and SourceAsset.pageMapping.",
      extra: { check: "page-counts" },
    });
  });

  test("every row of the treatment map has at least one argument obligation recorded", () => {
    const { manifest } = loadManifest();

    const REQUIRED_OBLIGATIONS = [
      "imported-result",
      "equal-opposite-emissions",
      "energy-balances",
      "subtraction-kinetic-energy",
      "low-speed-expansion",
      "inertia-change-generalization",
      "empirical-closing-remarks",
      "dateline-receipt",
    ] as const;

    const recordedObligations = new Set<string>();
    for (const unit of manifest.units) {
      if (typeof unit.destination === "object" && unit.destination !== null) {
        const obligations = unit.destination.argumentObligations ?? [];
        for (const obl of obligations) {
          recordedObligations.add(obl);
        }
      }
    }

    for (const required of REQUIRED_OBLIGATIONS) {
      expect(recordedObligations.has(required)).toBe(true);
    }

    logger.log({
      testId: "mass-energy-treatment-map-obligations",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Every row of the treatment map has an obligation recorded against units.",
      extra: { obligations: Array.from(recordedObligations), check: "treatment-map" },
    });
  });

  test("masthead units and closing units exist", () => {
    const { manifest } = loadManifest();
    const ids = new Set(manifest.units.map((u) => u.id));

    expect(ids.has("masthead-title")).toBe(true);
    expect(ids.has("masthead-author")).toBe(true);
    expect(ids.has("closing-dateline")).toBe(true);
    expect(ids.has("closing-received")).toBe(true);

    const dateline = manifest.units.find((u) => u.id === "closing-dateline");
    expect(dateline?.locators[0]?.page).toBe(641);

    const received = manifest.units.find((u) => u.id === "closing-received");
    expect(received?.locators[0]?.page).toBe(641);

    logger.log({
      testId: "mass-energy-masthead-and-closings-exist",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Masthead and closing units exist and have locators on page 641.",
      extra: { check: "masthead-closings" },
    });
  });

  test("footnote count equals 2 matching image-verified count in difficulties file", () => {
    const { manifest } = loadManifest();
    const footnotes = manifest.units.filter((u) => u.kind === "footnote");
    expect(footnotes.length).toBe(2);

    expect(footnotes[0]?.id).toBe("s0-fn1");
    expect(footnotes[0]?.footnoteMark).toBe("1)");
    expect(footnotes[0]?.locators[0]?.page).toBe(639);

    expect(footnotes[1]?.id).toBe("s0-fn2");
    expect(footnotes[1]?.footnoteMark).toBe("2)");
    expect(footnotes[1]?.locators[0]?.page).toBe(639);

    const diffPath = join(ROOT, "docs/editorial/mass-energy-difficulties.md");
    const diffContent = readFileSync(diffPath, "utf8");
    expect(diffContent).toContain("`flag:watch-footnotes` matches");
    expect(diffContent).toContain("Footnotes 1 and 2 on page 639");

    logger.log({
      testId: "mass-energy-footnote-count",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Footnote count equals 2, matching difficulties file and receipt.",
      extra: { check: "footnotes" },
    });
  });

  test("references of kinds bibliographic and cross-paper exist with correct occurrence IDs and targets", () => {
    const { manifest } = loadManifest();

    // 1. Bibliographic citation in s0-fn1
    const fn1 = manifest.units.find((u) => u.id === "s0-fn1");
    expect(fn1?.references?.length).toBe(1);
    const rBib = fn1!.references![0];
    expect(rBib?.id).toBe("s0-fn1-r1");
    expect(rBib?.occurrenceId).toBe("s0-fn1-r1");
    expect(rBib?.kind).toBe("bibliographic");
    expect(rBib?.target?.citationId).toBe("ap-17-891");
    expect(rBib?.printedText).toContain("Ann. d. Phys. 17. p. 891. 1905");

    // 2. Cross-paper reference to §8 in s0-p4
    const p4 = manifest.units.find((u) => u.id === "s0-p4");
    expect(p4?.references?.length).toBe(1);
    const rP4 = p4!.references![0];
    expect(rP4?.id).toBe("s0-p4-r1");
    expect(rP4?.occurrenceId).toBe("s0-p4-r1");
    expect(rP4?.kind).toBe("cross-paper");
    expect(rP4?.target?.paper).toBe("special-relativity");
    expect(rP4?.target?.id).toBe("ap-17-891-s8");
    expect(rP4?.printedText).toBe("l. c. § 8");

    // 3. Cross-paper reference to §10 in s0-p10
    const p10 = manifest.units.find((u) => u.id === "s0-p10");
    expect(p10?.references?.length).toBe(1);
    const rP10 = p10!.references![0];
    expect(rP10?.id).toBe("s0-p10-r1");
    expect(rP10?.occurrenceId).toBe("s0-p10-r1");
    expect(rP10?.kind).toBe("cross-paper");
    expect(rP10?.target?.paper).toBe("special-relativity");
    expect(rP10?.target?.id).toBe("ap-17-891-s10");
    expect(rP10?.printedText).toBe("l. c. § 10");

    // Check that every reference sub-entry matches <containingUnitId>-r<i> with contiguous i
    const allRefIds = new Set<string>();
    for (const unit of manifest.units) {
      if (unit.references) {
        for (let i = 0; i < unit.references.length; i++) {
          const ref = unit.references[i]!;
          const expectedId = `${unit.id}-r${i + 1}`;
          expect(ref.id).toBe(expectedId);
          expect(ref.occurrenceId).toBe(expectedId);
          expect(allRefIds.has(ref.id)).toBe(false);
          allRefIds.add(ref.id);
          // Id must never encode target
          expect(ref.id).not.toContain("ap-17-891");
          expect(ref.id).not.toContain("s8");
          expect(ref.id).not.toContain("s10");
        }
      }
    }

    logger.log({
      testId: "mass-energy-references-valid",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Bibliographic and cross-paper references have valid occurrence IDs and targets.",
      extra: { check: "references" },
    });
  });

  test("mutation: reference occurrence id renumbering or target conflation fails validation", () => {
    const { manifest } = loadManifest();

    // Planted mutation 1: renumber reference id to wrong unit prefix
    const mutatedUnits1 = manifest.units.map((u) => {
      if (u.id === "s0-p10" && u.references) {
        return {
          ...u,
          references: [
            {
              ...u.references[0]!,
              id: "s0-p4-r1", // Collides with s0-p4's reference id!
              occurrenceId: "s0-p4-r1",
            },
          ],
        };
      }
      return u;
    });

    const mutatedManifest1 = { ...manifest, units: mutatedUnits1 };
    const diags1 = validateManifest(mutatedManifest1, {
      manifests: new Map([[mutatedManifest1.paper, mutatedManifest1]]),
    });
    const refDiags1 = diags1.filter((d) => d.rule === "reference-occurrence-id-invalid");
    expect(refDiags1.length).toBeGreaterThanOrEqual(1);

    logger.log({
      testId: "mass-energy-planted-reference-mutation",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Planted reference id mutation correctly flagged by validator.",
      extra: { check: "mutation-reference" },
    });
  });

  test("difficulties file has all 4 sections and states that beta is NOT printed", () => {
    const diffPath = join(ROOT, "docs/editorial/mass-energy-difficulties.md");
    expect(existsSync(diffPath)).toBe(true);

    const content = readFileSync(diffPath, "utf8");

    // All 4 sections exist
    expect(content).toContain("## 1. Translation difficulties");
    expect(content).toContain("## 2. Notation difficulties");
    expect(content).toContain("## 3. Segmentation decisions");
    expect(content).toContain("## 4. Verification flags");

    // Notation section explicitly addresses beta
    const notationSection = content.split("## 2. Notation difficulties")[1]?.split("## 3. Segmentation decisions")[0];
    expect(notationSection).toBeDefined();
    expect(notationSection?.toLowerCase()).toContain("beta");
    expect(notationSection).toContain("NOT printed");

    logger.log({
      testId: "mass-energy-difficulties-sections-and-beta",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Difficulties document contains all 4 sections and explicit beta absence note.",
      extra: { check: "difficulties" },
    });
  });

  test("alias file is empty and snapshot equals manifest IDs; mutation removing ID fails", () => {
    const { manifest } = loadManifest();

    // Alias file check
    const aliasPath = join(ROOT, "content/aliases/mass-energy.yaml");
    expect(existsSync(aliasPath)).toBe(true);

    const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8")) as Record<string, unknown>;
    expect(aliasRaw.paper).toBe(PAPER_SLUG);
    expect(aliasRaw.idsFrozenAt).toBe("2026-09-19T00:00:00Z");
    expect(aliasRaw.frozenBy).toBe(MASS_ENERGY_BEAD);
    expect(Array.isArray(aliasRaw.aliases)).toBe(true);
    expect((aliasRaw.aliases as unknown[]).length).toBe(0);

    // Snapshot check
    const snapshotPath = join(ROOT, "content/source-blocks/mass-energy/manifest.ids.snapshot.txt");
    expect(existsSync(snapshotPath)).toBe(true);

    const snapshotText = readFileSync(snapshotPath, "utf8");
    const snapshotIds = parseIdSnapshot(snapshotText);

    const manifestIds = manifest.units.map((u) => u.id);
    expect(snapshotIds).toEqual(manifestIds);

    // Validate frozen IDs against snapshot
    const frozenResult = validateFrozenIds(snapshotText, manifestIds, []);
    expect(frozenResult.ok).toBe(true);
    expect(frozenResult.missingCount).toBe(0);

    // Planted mutation: removing a frozen id without an alias fails
    const mutatedIds = manifestIds.filter((id) => id !== "eq-s0-d7");
    const mutatedResult = validateFrozenIds(snapshotText, mutatedIds, []);
    expect(mutatedResult.ok).toBe(false);
    expect(mutatedResult.missingCount).toBe(1);
    expect(
      mutatedResult.findings.some(
        (f) => f.kind === "frozen-id-missing" && f.id === "eq-s0-d7",
      ),
    ).toBe(true);

    logger.log({
      testId: "mass-energy-snapshot-and-alias-validation",
      beadId: MASS_ENERGY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Snapshot equals manifest IDs; removing frozen ID fails validation.",
      extra: { check: "snapshot-alias" },
    });
  });
});
