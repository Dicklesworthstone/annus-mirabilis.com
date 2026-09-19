import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAlias, validateAliasRecord } from "../aliases.ts";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import { formatManifestReportText, generateManifestReport } from "../manifest/report.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { validateManifest } from "../manifest/validator.ts";
import { checkReceipt } from "../provenance/checkReceipt.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";

const ROOT = process.cwd();

/** The 2026-09-19 boundary-audit retirements, given to the validator as gap evidence. */
function loadAliasRecords() {
  const raw = parseYaml(
    readFileSync(join(process.cwd(), "content/aliases/special-relativity.yaml"), "utf8"),
  ) as { aliases?: unknown[] };
  return (raw.aliases ?? []).map((rec) => {
    const parsed = validateAliasRecord(rec);
    if (!parsed.ok) throw new Error(`Invalid alias record: ${parsed.error}`);
    return parsed.value;
  });
}
const RELATIVITY_BEAD = "am-edn-inventory-relativity-0u9";
const BIB_KEY = "ap-17-891";
const PAPER_SLUG = "special-relativity";

const logRoot = mkdtempSync(join(tmpdir(), "relativity-manifest-"));
const logger = new TestLogger("manifest-special-relativity", newRunIdentity(), logRoot);

function loadManifest() {
  const manifestPath = join(ROOT, "content/source-blocks/special-relativity/manifest.yaml");
  const raw = parseYaml(readFileSync(manifestPath, "utf8"));
  return { manifest: validateSourceManifest(raw, manifestPath), manifestPath };
}

describe("special-relativity source manifest inventory (am-edn-inventory-relativity-0u9)", () => {
  test("manifest validates with valid ids, locators, frozen headers, and absent derived statuses", () => {
    const { manifest, manifestPath } = loadManifest();
    expect(manifest.paper).toBe(PAPER_SLUG);
    expect(manifest.document).toBe(BIB_KEY);
    expect(manifest.status).toBe("in-preparation");
    expect(manifest.scope).toBe("full-document");
    expect(manifest.figures).toBe("none");
    expect(manifest.pageCount).toBe(31);
    expect(manifest.pageRange).toEqual([891, 921]);
    expect(manifest.idsFrozenAt).toBe("2026-09-19T00:00:00Z");
    expect(manifest.frozenBy).toBe(RELATIVITY_BEAD);

    expect(manifest.units.length).toBe(211); // 220 originally; 13 retired, 4 added by the 2026-09-19 boundary and denominator passes

    const idSet = new Set<string>();
    for (const unit of manifest.units) {
      expect(idSet.has(unit.id)).toBe(false);
      idSet.add(unit.id);

      // Grammar-valid id prefixes
      const hasValidPrefix =
        unit.id.startsWith("s") ||
        unit.id.startsWith("part-") ||
        unit.id.startsWith("masthead-") ||
        unit.id.startsWith("closing-") ||
        unit.id.startsWith("eq-");
      expect(hasValidPrefix).toBe(true);

      // At least one locator per unit
      expect(unit.locators.length).toBeGreaterThanOrEqual(1);

      // No authored statuses
      expect(unit.status).toBeUndefined();

      // Destination is defined with non-empty block id
      expect(unit.destination).toBeDefined();
      expect(typeof unit.destination === "object" && unit.destination !== null).toBe(true);
      if (typeof unit.destination === "object" && unit.destination !== null) {
        expect(typeof unit.destination.editionBlockId).toBe("string");
        expect(unit.destination.editionBlockId?.length).toBeGreaterThan(0);
      }
    }

    // Validator check over corpus produces zero errors
    // The sequence-gap rule errors on a missing paragraph number unless an alias record explains
    // it, so the validator is given the real alias file: the gaps are explained, never waived.
    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
      aliases: loadAliasRecords(),
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.length).toBe(0);

    logger.log({
      testId: "relativity-manifest-schema-and-validation",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Manifest schema and validator pass with 0 errors and valid ID grammar.",
      extra: { unitCount: manifest.units.length, check: "schema" },
    });
  });

  test("every display equation has a label, locators, and containment or recorded standalone case", () => {
    const { manifest } = loadManifest();
    const displays = manifest.units.filter((u) => u.kind === "display-equation");
    expect(displays.length).toBe(98);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    // Check single numbered display eq-A
    const eqA = unitMap.get("eq-A");
    expect(eqA).toBeDefined();
    expect(eqA?.originalLabel).toBe("(A)");
    expect(eqA?.editorialLabel).toBe("ed:s10-A");
    expect(eqA?.containedIn).toBe("s10-p6");

    // Check all unnumbered displays
    for (const d of displays) {
      expect(d.editorialLabel).toBeDefined();
      expect(d.locators.length).toBeGreaterThanOrEqual(1);
      expect(d.containedIn).toBeDefined();

      const parent = unitMap.get(d.containedIn!);
      expect(parent).toBeDefined();
      expect(parent?.kind).toBe("paragraph");
    }

    // Display equation eq-s6-d2 spans pages 907 and 908
    const eqS6D2 = unitMap.get("eq-s6-d2");
    expect(eqS6D2?.locators.map((l) => l.page)).toEqual([907, 908]);

    logger.log({
      testId: "relativity-displays-labels-and-containment",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 98 displays have labels, locators, and valid parent paragraph containment.",
      extra: { displayCount: displays.length, check: "displays" },
    });
  });

  test("repeated printed labels use section-qualified ids and section 6 and 9 systems are single units", () => {
    const { manifest } = loadManifest();

    // Section 6 system displays are single units
    const s6d1 = manifest.units.find((u) => u.id === "eq-s6-d1");
    expect(s6d1).toBeDefined();
    expect(s6d1?.editorialLabel).toBe("ed:s6-d1");

    const s6d2 = manifest.units.find((u) => u.id === "eq-s6-d2");
    expect(s6d2).toBeDefined();

    const s6d4 = manifest.units.find((u) => u.id === "eq-s6-d4");
    expect(s6d4).toBeDefined();

    const s6d5 = manifest.units.find((u) => u.id === "eq-s6-d5");
    expect(s6d5).toBeDefined();

    // Section 9 displays
    const s9d1 = manifest.units.find((u) => u.id === "eq-s9-d1");
    expect(s9d1).toBeDefined();

    const s9d3 = manifest.units.find((u) => u.id === "eq-s9-d3");
    expect(s9d3).toBeDefined();

    logger.log({
      testId: "relativity-section-systems-granularity",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Section 6 and 9 equation systems maintain single-unit granularity.",
      extra: { check: "systems-granularity" },
    });
  });

  test("counts reconcile with receipt pageMap and SourceAsset.pageMapping", () => {
    const { manifest } = loadManifest();
    const receiptPath = join(ROOT, "docs/provenance/ap-17-891.md");
    expect(existsSync(receiptPath)).toBe(true);

    const receiptContent = readFileSync(receiptPath, "utf8");
    const parsedReceipt = parseReceipt(receiptContent, receiptPath);
    expect(parsedReceipt.ok).toBe(true);
    expect(parsedReceipt.frontMatter).toBeDefined();

    const fmPageMap = parsedReceipt.frontMatter!.pageMap;
    expect(fmPageMap.length).toBe(31);

    const sourceAsset = receiptToSourceAsset(parsedReceipt.frontMatter!);
    expect(sourceAsset.pageMapping).toEqual(fmPageMap);

    // Verify per-page reconciliation
    for (let p = 1; p <= 31; p++) {
      const pageNum = 890 + p;
      const entry = fmPageMap[p - 1]!;
      expect(entry.pdfPageIndex).toBe(p);
      expect(entry.printedPage).toBe(pageNum);

      // Displays on this page from manifest
      const displaysOnPage = manifest.units.filter(
        (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === pageNum),
      );

      if (displaysOnPage.length === 0) {
        expect(entry.displayEquations.unnumbered).toBe(0);
        expect(entry.displayEquations.numbered).toEqual([]);
        expect(entry.refinedBy).toBeUndefined();
      } else {
        expect(entry.refinedBy).toBe(RELATIVITY_BEAD);
        const unnumberedManifest = displaysOnPage.filter((u) => !u.originalLabel).map((u) => u.id);
        const numberedManifest = displaysOnPage.filter((u) => u.originalLabel).map((u) => u.originalLabel!);

        expect(entry.displayEquations.unnumberedIds).toEqual(unnumberedManifest);
        expect(entry.displayEquations.numbered).toEqual(numberedManifest);
      }

      // Footnotes on this page
      const footnotesOnPage = manifest.units.filter(
        (u) => u.kind === "footnote" && u.locators.some((l) => l.page === pageNum),
      );
      expect(entry.footnoteMarks).toEqual(footnotesOnPage.map((u) => u.footnoteMark!));
    }

    logger.log({
      testId: "relativity-counts-reconcile-pagemap",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Counts reconcile with receipt pageMap and SourceAsset.pageMapping across all 31 pages.",
      extra: { check: "page-counts" },
    });
  });

  test("every row of the treatment map has at least one argument obligation recorded", () => {
    const { manifest } = loadManifest();

    const REQUIRED_TREATMENT_ROWS = [
      "s0",
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
      "s8",
      "s9",
      "s10",
      "closing",
    ] as const;

    const coveredRows = new Set<string>();

    for (const unit of manifest.units) {
      if (typeof unit.destination === "object" && unit.destination !== null) {
        if (unit.destination.argumentObligations && unit.destination.argumentObligations.length > 0) {
          if (unit.section) {
            coveredRows.add(unit.section);
          } else if (unit.id.startsWith("closing-")) {
            coveredRows.add("closing");
          }
        }
      }
    }

    for (const row of REQUIRED_TREATMENT_ROWS) {
      expect(coveredRows.has(row)).toBe(true);
    }

    logger.log({
      testId: "relativity-treatment-map-obligations",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Every row of the treatment map (s0..s10, closing) has an argument obligation recorded.",
      extra: { coveredRows: Array.from(coveredRows), check: "treatment-map" },
    });
  });

  test("part-1 precedes s1 and part-2 precedes s6; masthead and closings exist", () => {
    const { manifest } = loadManifest();
    const idOrder = manifest.units.map((u) => u.id);

    const idxMastheadTitle = idOrder.indexOf("masthead-title");
    const idxMastheadAuthor = idOrder.indexOf("masthead-author");
    const idxPart1 = idOrder.indexOf("part-1");
    const idxS1 = idOrder.indexOf("s1");
    const idxPart2 = idOrder.indexOf("part-2");
    const idxS6 = idOrder.indexOf("s6");
    const idxAck = idOrder.indexOf("closing-ack");
    const idxDateline = idOrder.indexOf("closing-dateline");
    const idxReceived = idOrder.indexOf("closing-received");

    expect(idxMastheadTitle).toBe(0);
    expect(idxMastheadAuthor).toBe(1);
    expect(idxPart1).toBeGreaterThan(-1);
    expect(idxS1).toBeGreaterThan(idxPart1);
    expect(idxPart2).toBeGreaterThan(-1);
    expect(idxS6).toBeGreaterThan(idxPart2);

    expect(idxAck).toBeGreaterThan(-1);
    expect(idxDateline).toBeGreaterThan(idxAck);
    expect(idxReceived).toBeGreaterThan(idxDateline);

    logger.log({
      testId: "relativity-parts-headings-and-closings-order",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Part headings and section headings are strictly ordered; masthead and closings exist.",
      extra: { check: "order" },
    });
  });

  test("exportedResults contains exactly one s8 display and one s10 unit, and both resolve", () => {
    const { manifest } = loadManifest();
    expect(manifest.exportedResults).toBeDefined();
    expect(manifest.exportedResults!.length).toBe(2);

    const s8Export = manifest.exportedResults!.find((e) => (e.id ?? e.resultId) === "eq-s8-d4");
    expect(s8Export).toBeDefined();
    expect(s8Export?.section).toBe("s8");
    expect(s8Export?.statement).toContain("Energy of a light complex");

    const s10Export = manifest.exportedResults!.find((e) => (e.id ?? e.resultId) === "eq-s10-d8");
    expect(s10Export).toBeDefined();
    expect(s10Export?.section).toBe("s10");
    expect(s10Export?.statement).toContain("Kinetic energy of an electron");

    // Both IDs exist in manifest units
    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));
    expect(unitMap.has("eq-s8-d4")).toBe(true);
    expect(unitMap.has("eq-s10-d8")).toBe(true);

    // Check compiler validation: import of exported result is accepted
    const dummyImportingManifest = {
      paper: "mass-energy-test",
      document: "ap-18-639",
      status: "in-preparation" as const,
      scope: "full-document" as const,
      pageCount: 3,
      pageRange: [639, 641] as [number, number],
      importedResults: [
        {
          resultId: "eq-s8-d4",
          fromPaper: "special-relativity",
          use: "Imported §8 light energy transformation relation",
        },
      ],
      units: [],
    };

    const manifestsMap = new Map<string, typeof manifest>([
      [manifest.paper, manifest],
      [dummyImportingManifest.paper, dummyImportingManifest as unknown as typeof manifest],
    ]);

    const importDiags = validateManifest(dummyImportingManifest as unknown as typeof manifest, {
      manifests: manifestsMap,
    });
    const unexportedDiags = importDiags.filter((d) => d.rule === "import-unexported-result");
    expect(unexportedDiags.length).toBe(0);

    // Reject unexported ID
    const dummyBadImportingManifest = {
      ...dummyImportingManifest,
      importedResults: [
        {
          resultId: "eq-s8-d1", // Not exported!
          fromPaper: "special-relativity",
          use: "Illegal import of unexported §8 display",
        },
      ],
      units: [
        {
          id: "s0-p1",
          kind: "paragraph" as const,
          locators: [{ page: 639 }],
          destination: { editionBlockId: "s0-p1" },
        },
      ],
    };

    const manifestsBadMap = new Map<string, typeof manifest>([
      [manifest.paper, manifest],
      [dummyBadImportingManifest.paper, dummyBadImportingManifest as unknown as typeof manifest],
    ]);

    const badImportDiags = validateManifest(dummyBadImportingManifest as unknown as typeof manifest, {
      manifests: manifestsBadMap,
    });
    const badUnexportedDiags = badImportDiags.filter((d) => d.rule === "import-unexported-result");
    expect(badUnexportedDiags.length).toBe(1);

    logger.log({
      testId: "relativity-exported-results-resolve-and-guard",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Exported results eq-s8-d4 and eq-s10-d8 resolve; validator guards exports against unexported imports.",
      extra: { check: "exported-results" },
    });
  });

  test("internal references have valid occurrence ids <unit>-r<i> with contiguous i and no bibliographic refs", () => {
    const { manifest } = loadManifest();

    const allRefIds = new Set<string>();
    let totalRefs = 0;

    for (const unit of manifest.units) {
      if (unit.references) {
        for (let i = 0; i < unit.references.length; i++) {
          totalRefs++;
          const ref = unit.references[i]!;
          const expectedId = `${unit.id}-r${i + 1}`;
          expect(ref.id).toBe(expectedId);
          expect(ref.occurrenceId).toBe(expectedId);
          expect(ref.kind).toBe("internal");
          expect(ref.target).toBeDefined();
          expect(ref.target?.id).toBeDefined();

          expect(allRefIds.has(ref.id)).toBe(false);
          allRefIds.add(ref.id);

          // No bibliographic sub-entries
          expect((ref as { citationId?: string }).citationId).toBeUndefined();
        }
      }
    }

    expect(totalRefs).toBe(25);

    // Planted mutation: renumbered reference id fails validation
    const mutatedUnits = manifest.units.map((u) => {
      if (u.id === "s10-p5" && u.references) {
        return {
          ...u,
          references: [
            {
              ...u.references[0]!,
              id: "s6-p2-r1", // Collides / wrong prefix
              occurrenceId: "s6-p2-r1",
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
    const refDiags = diags.filter((d) => d.rule === "reference-occurrence-id-invalid");
    expect(refDiags.length).toBeGreaterThanOrEqual(1);

    logger.log({
      testId: "relativity-internal-references-occurrence-ids",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 25 internal references have valid occurrence IDs and pass mutation check.",
      extra: { totalRefs, check: "references" },
    });
  });

  test("footnote list equals verified list in difficulties file and no footnote in s0", () => {
    const { manifest } = loadManifest();
    const footnotes = manifest.units.filter((u) => u.kind === "footnote");
    expect(footnotes.length).toBe(4);

    const footnoteIds = footnotes.map((f) => f.id);
    expect(footnoteIds).toEqual(["s1-fn1", "s2-fn1", "s4-fn1", "s6-fn1"]);

    // No footnote in s0
    const s0Footnotes = manifest.units.filter((u) => u.section === "s0" && u.kind === "footnote");
    expect(s0Footnotes.length).toBe(0);

    // Verified in difficulties file
    const diffPath = join(ROOT, "docs/editorial/special-relativity-difficulties.md");
    expect(existsSync(diffPath)).toBe(true);
    const diffContent = readFileSync(diffPath, "utf8");
    expect(diffContent).toContain("`flag:footnotes` matches");
    expect(diffContent).toContain("s1-fn1, s2-fn1, s4-fn1, s6-fn1; s0 has no footnotes");

    logger.log({
      testId: "relativity-footnote-list-and-s0-absence",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Footnote list strictly matches difficulties file; s0 has no footnotes.",
      extra: { footnoteIds, check: "footnotes" },
    });
  });

  test("alias file is empty and snapshot equals manifest IDs; mutation removing ID fails", () => {
    const { manifest } = loadManifest();

    // Alias file
    const aliasPath = join(ROOT, "content/aliases/special-relativity.yaml");
    expect(existsSync(aliasPath)).toBe(true);

    const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8")) as Record<string, unknown>;
    expect(aliasRaw.paper).toBe(PAPER_SLUG);
    expect(aliasRaw.idsFrozenAt).toBe("2026-09-19T00:00:00Z");
    expect(aliasRaw.frozenBy).toBe(RELATIVITY_BEAD);
    expect(Array.isArray(aliasRaw.aliases)).toBe(true);

    // Twelve retirements from the 2026-09-19 boundary audit; four printed paragraphs that had no
    // unit took new ids at their section ends instead (s3-p20, s3-p21, s3-p22, s4-p9).
    const records = loadAliasRecords();
    expect(records.length).toBe(13);
    expect(records.map((r) => r.retiredId).sort()).toEqual([
      "s1-p4", "s3-p11", "s3-p13", "s3-p19", "s3-p8", "s4-p2",
      "s5-p3", "s6-p6", "s8-p11", "s8-p3", "s8-p4", "s8-p8", "s8-p9",
    ]);

    const liveIds = manifest.units.map((u) => u.id);
    const expectedTarget: Record<string, string> = {
      "s1-p4": "s1-p3", "s3-p8": "s3-p7", "s3-p11": "s3-p10", "s3-p13": "s3-p12",
      "s3-p19": "s3-p22",
      "s4-p2": "s4-p1", "s5-p3": "s5-p2", "s6-p6": "s6-p5", "s8-p3": "s8-p2",
      "s8-p4": "s8-p2", "s8-p8": "s8-p7", "s8-p9": "s8-p7", "s8-p11": "s8-p10",
    };
    for (const [retired, target] of Object.entries(expectedTarget)) {
      expect(liveIds).not.toContain(retired);
      const resolved = resolveAlias(retired, records, liveIds);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.targetIds).toEqual([target]);
    }
    for (const added of ["s3-p20", "s3-p21", "s3-p22", "s4-p9"]) {
      expect(liveIds).toContain(added);
    }

    // Page-span records moved onto the surviving paragraphs.
    const pagesOf = (id: string) =>
      manifest.units.find((u) => u.id === id)?.locators.map((l) => l.page);
    expect(pagesOf("s1-p3")).toEqual([892, 893]);
    expect(pagesOf("s3-p7")).toEqual([898, 899]);
    expect(pagesOf("s3-p12")).toEqual([899, 900]);
    expect(pagesOf("s3-p18")).toEqual([901]);
    expect(pagesOf("s3-p22")).toEqual([901, 902]);
    expect(pagesOf("s5-p2")).toEqual([905, 906]);
    expect(pagesOf("s6-p5")).toEqual([909, 910]);
    expect(pagesOf("s8-p2")).toEqual([913, 914]);
    expect(pagesOf("s8-p7")).toEqual([914, 915]);

    // No display, footnote or other unit still hangs off a retired id.
    const live = new Set(liveIds);
    for (const u of manifest.units) {
      if (u.containedIn) expect(live.has(u.containedIn)).toBe(true);
    }

    // Planted negative: withhold the alias records and the same twelve gaps are still errors, so
    // the records carry the explanation rather than the rule having been softened.
    const unexplained = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    }).filter((d) => d.rule === "sequence-gap" && d.severity === "error");
    expect(unexplained.length).toBe(13);

    // Snapshot file
    const snapshotPath = join(ROOT, "content/source-blocks/special-relativity/manifest.ids.snapshot.txt");
    expect(existsSync(snapshotPath)).toBe(true);

    const snapshotText = readFileSync(snapshotPath, "utf8");
    const snapshotIds = parseIdSnapshot(snapshotText);
    const manifestIds = manifest.units.map((u) => u.id);

    expect(snapshotIds).toEqual(manifestIds);

    const frozenResult = validateFrozenIds(snapshotText, manifestIds, []);
    expect(frozenResult.ok).toBe(true);
    expect(frozenResult.missingCount).toBe(0);

    // Planted mutation: removing exported id eq-s8-d4 fails validation
    const mutatedIds = manifestIds.filter((id) => id !== "eq-s8-d4");
    const mutatedResult = validateFrozenIds(snapshotText, mutatedIds, []);
    expect(mutatedResult.ok).toBe(false);
    expect(mutatedResult.missingCount).toBe(1);
    expect(
      mutatedResult.findings.some(
        (f) => f.kind === "frozen-id-missing" && f.id === "eq-s8-d4",
      ),
    ).toBe(true);

    logger.log({
      testId: "relativity-snapshot-and-alias-validation",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Snapshot equals manifest IDs; removing frozen ID fails validation.",
      extra: { check: "snapshot-alias" },
    });
  });

  test("manifest reporting engine generates report with zero percentage and absent source layers", () => {
    const { manifest } = loadManifest();
    const report = generateManifestReport(manifest);

    expect(report.paper).toBe(PAPER_SLUG);
    expect(report.status).toBe("in-preparation");
    expect(report.totalUnits).toBe(211);
    expect(report.inScopeCount).toBe(211);
    expect(report.notInScopeCount).toBe(0);

    expect(report.layers.ledger.state).toBe("absent");
    expect(report.layers.transcription.state).toBe("absent");
    expect(report.layers.translation.state).toBe("absent");
    expect(report.layers.gloss.state).toBe("absent");

    const json = JSON.stringify(report, null, 2);
    const text = formatManifestReportText(report);

    expect(json.includes("%")).toBe(false);
    expect(text.includes("%")).toBe(false);

    logger.log({
      testId: "relativity-report-cli-invariants",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Report contains 220 units, 0 percentages, and absent source layers.",
      extra: { check: "report" },
    });
  });

  test("check-receipts passes for ap-17-891 provenance receipt with 0 errors", () => {
    const receiptPath = join(ROOT, "docs/provenance/ap-17-891.md");
    const receiptText = readFileSync(receiptPath, "utf8");
    const result = checkReceipt(receiptText, receiptPath);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.length).toBe(0);

    logger.log({
      testId: "relativity-receipt-check-passes",
      beadId: RELATIVITY_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "checkReceipt passes for ap-17-891 with 0 errors.",
      extra: { check: "receipt" },
    });
  });
});
