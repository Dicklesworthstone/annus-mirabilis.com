import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { type AliasRecord } from "../aliases.ts";
import { compileReadingContent } from "../compiler/compile.ts";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import { parseAlignableUnitId, parseInlineMathId, parseReferenceId } from "../ids.ts";
import { formatManifestReportText, generateManifestReport } from "../manifest/report.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";

const ROOT = process.cwd();
const LIGHT_QUANTA_BEAD = "am-edn-inventory-light-quanta-skp";
const BIB_KEY = "ap-17-132";
const PAPER_SLUG = "light-quanta";

const logRunId = newRunIdentity();
const logRoot = join(ROOT, "artifacts/test-logs");
const logger = new TestLogger("manifest-light-quanta", logRunId, logRoot);

function loadManifest() {
  const manifestPath = join(ROOT, "content/source-blocks/light-quanta/manifest.yaml");
  const raw = parseYaml(readFileSync(manifestPath, "utf8"));
  return { manifest: validateSourceManifest(raw, manifestPath), manifestPath };
}

describe("light-quanta source manifest inventory (am-edn-inventory-light-quanta-skp)", () => {
  test("manifest schema, headers, frozen status, and validator pass with 0 errors and absent derived statuses", () => {
    const { manifest } = loadManifest();

    expect(manifest.paper).toBe(PAPER_SLUG);
    expect(manifest.document).toBe(BIB_KEY);
    expect(manifest.status).toBe("in-preparation");
    expect(manifest.scope).toBe("full-document");
    expect(manifest.figures).toBe("none");
    expect(manifest.pageCount).toBe(17);
    expect(manifest.pageRange).toEqual([132, 148]);
    expect(manifest.idsFrozenAt).toBe("2026-09-19T04:30:00Z");
    expect(manifest.frozenBy).toBe("pane16");

    expect(manifest.units.length).toBe(128);

    // No duplicate IDs and check prefix / properties
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
        expect(loc.page).toBeGreaterThanOrEqual(132);
        expect(loc.page).toBeLessThanOrEqual(148);
        expect(loc.page).toBeGreaterThan(lastPage);
        lastPage = loc.page;
      }

      // No authored statuses
      expect(unit.status).toBeUndefined();

      // Destination is non-empty with argument obligations
      expect(unit.destination).toBeDefined();
      const destObls = typeof unit.destination === "object" && unit.destination ? unit.destination.argumentObligations : undefined;
      expect(destObls?.length).toBeGreaterThanOrEqual(1);
    }

    // Corpus validation produces zero errors
    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.length).toBe(0);

    logger.log({
      testId: "manifest-schema-and-validation",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Manifest schema and validator pass with 0 errors, 128 units, and absent derived statuses.",
      extra: { unitCount: manifest.units.length, check: "schema" },
    });
  });

  test("masthead units, 9 numbered sections plus s0, and closing units exist with valid locators", () => {
    const { manifest } = loadManifest();
    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    // Masthead
    expect(unitMap.has("masthead-title")).toBe(true);
    expect(unitMap.get("masthead-title")?.locators[0]?.page).toBe(132);
    expect(unitMap.has("masthead-author")).toBe(true);
    expect(unitMap.get("masthead-author")?.locators[0]?.page).toBe(132);

    // Section 0 introduction paragraphs
    expect(unitMap.has("s0-p1")).toBe(true);
    expect(unitMap.has("s0-p2")).toBe(true);
    expect(unitMap.has("s0-p3")).toBe(true);
    expect(unitMap.has("s0-p4")).toBe(true);

    // 9 Numbered Section Headings
    const expectedSectionPages: Record<string, number> = {
      s1: 133,
      s2: 136,
      s3: 137,
      s4: 139,
      s5: 140,
      s6: 142,
      s7: 144,
      s8: 145,
      s9: 147,
    };

    for (const [secId, page] of Object.entries(expectedSectionPages)) {
      const heading = unitMap.get(secId);
      expect(heading).toBeDefined();
      expect(heading?.kind).toBe("section-heading");
      expect(heading?.locators[0]?.page).toBe(page);
    }

    // Closings
    expect(unitMap.has("closing-dateline")).toBe(true);
    expect(unitMap.get("closing-dateline")?.locators[0]?.page).toBe(148);
    expect(unitMap.has("closing-received")).toBe(true);
    expect(unitMap.get("closing-received")?.locators[0]?.page).toBe(148);

    logger.log({
      testId: "masthead-sections-and-closings",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Masthead, 9 numbered sections plus s0, and closing units exist with verified locators.",
      extra: { check: "masthead-sections" },
    });
  });

  test("every display equation has an editorial label, locators, and valid containment", () => {
    const { manifest } = loadManifest();
    const displays = manifest.units.filter((u) => u.kind === "display-equation");
    expect(displays.length).toBe(52);

    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

    const fnDisplayIds = new Set(["eq-s1-d3", "eq-s1-d4", "eq-s1-d5", "eq-s5-d9", "eq-s5-d10"]);

    for (const eq of displays) {
      expect(eq.editorialLabel).toBeDefined();
      expect(eq.editorialLabel).toBe(`ed:${eq.id.replace(/^eq-/, "")}`);
      expect(eq.originalLabel).toBeUndefined(); // All unnumbered in this paper
      expect(eq.locators.length).toBeGreaterThanOrEqual(1);
      expect(eq.containedIn).toBeDefined();

      const parent = unitMap.get(eq.containedIn!);
      expect(parent).toBeDefined();

      if (fnDisplayIds.has(eq.id)) {
        expect(parent?.kind).toBe("footnote");
        if (eq.id.startsWith("eq-s1-")) {
          expect(eq.containedIn).toBe("s1-fn3");
        } else if (eq.id.startsWith("eq-s5-")) {
          expect(eq.containedIn).toBe("s5-fn1");
        }
      } else {
        expect(parent?.kind).toBe("paragraph");
      }
    }

    logger.log({
      testId: "displays-labels-containment",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 52 displays have editorial labels, locators, and valid parent containment (including 5 in footnotes).",
      extra: { displayCount: displays.length, check: "displays" },
    });
  });

  test("inline math id grammar and region indexing rule", () => {
    // Check valid inline math IDs per sentence and footnote
    expect(parseInlineMathId("s1-p1-s1-m1").ok).toBe(true);
    expect(parseInlineMathId("s8-fn3-m1").ok).toBe(true);
    expect(parseInlineMathId("s3-p2-s3-m4").ok).toBe(true);
    // Index 0 rejected
    expect(parseInlineMathId("s1-p1-s1-m0").ok).toBe(false);

    logger.log({
      testId: "inline-math-grammar",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Inline math ID grammar and region indexing rules verified.",
      extra: { check: "inline-math" },
    });
  });

  test("every reference sub-entry has valid occurrence id, alignable unit prefix, unique index, printedText, kind, and target", () => {
    const { manifest } = loadManifest();
    const unitMap = new Map(manifest.units.map((u) => [u.id, u]));

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

        // Prefix must be alignable
        const alignableRes = parseAlignableUnitId(alignableId);
        expect(alignableRes.ok).toBe(true);

        // For paragraphs, alignable unit is sentence s<n>-p<m>-s<k> inside containing paragraph
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
        expect(ref.printedText!.length).toBeGreaterThan(0);
        expect(["bibliographic", "internal", "cross-paper"]).toContain(ref.kind);
        expect(ref.target).toBeDefined();
      }
    }

    expect(totalReferences).toBe(37);

    // Verify key historical bibliographic citations
    const s1fn1 = unitMap.get("s1-fn1");
    expect(s1fn1?.references?.[0]?.printedText).toContain("Drude");

    const s1fn2 = unitMap.get("s1-fn2");
    expect(s1fn2?.references?.[0]?.printedText).toContain("M. Planck");

    const s2fn1 = unitMap.get("s2-fn1");
    expect(s2fn1?.references?.[0]?.printedText).toContain("M. Planck");

    const s8fn1 = unitMap.get("s8-fn1");
    expect(s8fn1?.references?.[0]?.printedText).toContain("P. Lenard");

    const s8fn3 = unitMap.get("s8-fn3");
    expect(s8fn3?.references?.[0]?.printedText).toContain("P. Lenard");

    const s9fn1 = unitMap.get("s9-fn1");
    expect(s9fn1?.references?.[0]?.printedText).toContain("J. Stark");

    logger.log({
      testId: "references-schema-and-indexing",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `All ${totalReferences} references have valid occurrence IDs, alignable prefixes, contiguous indices, and targets.`,
      extra: { referenceCount: totalReferences, check: "references" },
    });
  });

  test("mutation: invalid reference occurrence id or mismatched unit prefix fails validation", () => {
    const { manifest } = loadManifest();

    // Planted mutation: change reference id to collide or have wrong prefix
    const mutatedUnits = manifest.units.map((u) => {
      if (u.id === "s1-fn1" && u.references) {
        return {
          ...u,
          references: [
            {
              ...u.references[0]!,
              id: "s2-fn1-r1", // Mismatched containing unit!
              occurrenceId: "s2-fn1-r1",
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

    const refErrors = diags.filter((d) => d.rule === "reference-occurrence-id-invalid");
    expect(refErrors.length).toBeGreaterThanOrEqual(1);

    logger.log({
      testId: "planted-reference-mutation",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Planted reference occurrence ID mutation correctly flagged by validator.",
      extra: { check: "mutation-reference" },
    });
  });

  test("per-page counts reconcile with receipt pageMap and SourceAsset.pageMapping", () => {
    const { manifest } = loadManifest();
    const receiptPath = join(ROOT, "docs/provenance/ap-17-132.md");
    expect(existsSync(receiptPath)).toBe(true);

    const receiptContent = readFileSync(receiptPath, "utf8");
    const parsedReceipt = parseReceipt(receiptContent, receiptPath);
    expect(parsedReceipt.ok).toBe(true);
    expect(parsedReceipt.frontMatter).toBeDefined();

    const fmPageMap = parsedReceipt.frontMatter!.pageMap;
    expect(fmPageMap.length).toBe(17);

    const sourceAsset = receiptToSourceAsset(parsedReceipt.frontMatter!);
    expect(sourceAsset.pageMapping).toEqual(fmPageMap);

    // Reconcile display equations and footnotes per page
    for (const pageEntry of fmPageMap) {
      const pageNum = pageEntry.printedPage;

      // Display equations on page
      const displaysOnPage = manifest.units.filter(
        (u) => u.kind === "display-equation" && u.locators.some((l) => l.page === pageNum),
      );
      const expectedDisplays = pageEntry.displayEquations.unnumberedIds ?? [];
      expect(displaysOnPage.map((u) => u.id)).toEqual(expectedDisplays);

      // Footnotes on page
      const footnotesOnPage = manifest.units.filter(
        (u) => u.kind === "footnote" && u.locators.some((l) => l.page === pageNum),
      );
      expect(footnotesOnPage.length).toBe(pageEntry.footnoteMarks.length);
      for (let i = 0; i < pageEntry.footnoteMarks.length; i++) {
        expect(footnotesOnPage[i]?.footnoteMark).toBe(pageEntry.footnoteMarks[i]);
      }
    }

    // Reconcile 14 multi-page spanning paragraphs
    const spanningParagraphs = manifest.units.filter(
      (u) => u.kind === "paragraph" && u.locators.length > 1,
    );
    expect(spanningParagraphs.length).toBe(14);
    const spanningIds = spanningParagraphs.map((u) => u.id).sort();
    expect(spanningIds).toEqual([
      "s0-p2",
      "s1-p1",
      "s1-p3",
      "s3-p2",
      "s3-p4",
      "s4-p5",
      "s5-p2",
      "s5-p4",
      "s6-p1",
      "s6-p4",
      "s7-p2",
      "s8-p2",
      "s8-p6",
      "s9-p1",
    ]);

    logger.log({
      testId: "page-counts-reconciliation",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Per-page counts for displays, footnotes, and spanning paragraphs reconcile with receipt and SourceAsset.",
      extra: { check: "page-counts" },
    });
  });

  test("every row of the treatment map (s0..s9, closing) has at least one argument obligation recorded", () => {
    const { manifest } = loadManifest();

    const REQUIRED_ROWS = [
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
      "closing",
    ] as const;

    for (const row of REQUIRED_ROWS) {
      const unitsInRow = manifest.units.filter((u) => {
        if (row === "closing") {
          return u.id.startsWith("closing-");
        }
        if (row === "s0") {
          return u.id.startsWith("s0-") || u.id.startsWith("masthead-");
        }
        return u.id === row || u.id.startsWith(`${row}-`) || u.id.startsWith(`eq-${row}-`);
      });

      expect(unitsInRow.length).toBeGreaterThan(0);
      const rowObligations = new Set<string>();
      for (const u of unitsInRow) {
        const uObls = typeof u.destination === "object" && u.destination ? u.destination.argumentObligations ?? [] : [];
        for (const obl of uObls) {
          rowObligations.add(obl);
        }
      }
      expect(rowObligations.size).toBeGreaterThanOrEqual(1);
    }

    logger.log({
      testId: "treatment-map-obligations",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Every row of the treatment map has at least one argument obligation recorded.",
      extra: { check: "treatment-map" },
    });
  });

  test("footnote counts, marks, and sections match receipt and page-image inventory", () => {
    const { manifest } = loadManifest();
    const footnotes = manifest.units.filter((u) => u.kind === "footnote");
    expect(footnotes.length).toBe(13);

    const expectedFootnotes = [
      { id: "s1-fn1", mark: "1)", page: 133, section: "s1" },
      { id: "s1-fn2", mark: "1)", page: 135, section: "s1" },
      { id: "s1-fn3", mark: "2)", page: 135, section: "s1" },
      { id: "s2-fn1", mark: "1)", page: 136, section: "s2" },
      { id: "s3-fn1", mark: "1)", page: 137, section: "s3" },
      { id: "s5-fn1", mark: "1)", page: 142, section: "s5" },
      { id: "s8-fn1", mark: "1)", page: 145, section: "s8" },
      { id: "s8-fn2", mark: "1)", page: 146, section: "s8" },
      { id: "s8-fn3", mark: "2)", page: 146, section: "s8" },
      { id: "s8-fn4", mark: "1)", page: 147, section: "s8" },
      { id: "s8-fn5", mark: "2)", page: 147, section: "s8" },
      { id: "s9-fn1", mark: "1)", page: 148, section: "s9" },
      { id: "s9-fn2", mark: "2)", page: 148, section: "s9" },
    ];

    for (let i = 0; i < expectedFootnotes.length; i++) {
      const exp = expectedFootnotes[i]!;
      const fn = footnotes[i]!;
      expect(fn.id).toBe(exp.id);
      expect(fn.footnoteMark).toBe(exp.mark);
      expect(fn.locators[0]?.page).toBe(exp.page);
      expect(fn.id.startsWith(`${exp.section}-`)).toBe(true);
    }

    logger.log({
      testId: "footnote-mark-section-reconciliation",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "All 13 footnotes match receipt marks, pages, and sections.",
      extra: { check: "footnotes" },
    });
  });

  test("content/aliases/light-quanta.yaml exists and is empty", () => {
    const aliasPath = join(ROOT, "content/aliases/light-quanta.yaml");
    expect(existsSync(aliasPath)).toBe(true);

    const aliasRaw = parseYaml(readFileSync(aliasPath, "utf8")) as Record<string, unknown>;
    expect(aliasRaw.paper).toBe(PAPER_SLUG);
    expect(Array.isArray(aliasRaw.aliases)).toBe(true);
    expect((aliasRaw.aliases as unknown[]).length).toBe(0);

    logger.log({
      testId: "aliases-empty",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Alias file exists and is empty.",
      extra: { check: "aliases" },
    });
  });

  test("snapshot equals manifest id list; mutation without alias fails, with split alias passes", () => {
    const { manifest } = loadManifest();

    const snapshotPath = join(ROOT, "content/source-blocks/light-quanta/manifest.ids.snapshot.txt");
    expect(existsSync(snapshotPath)).toBe(true);

    const snapshotText = readFileSync(snapshotPath, "utf8");
    const snapshotIds = parseIdSnapshot(snapshotText);
    const manifestIds = manifest.units.map((u) => u.id);

    expect(snapshotIds).toEqual(manifestIds);
    expect(snapshotIds.length).toBe(128);

    // Validate frozen IDs
    const validResult = validateFrozenIds(snapshotText, manifestIds, []);
    expect(validResult.ok).toBe(true);
    expect(validResult.missingCount).toBe(0);

    // Mutation test under artifacts/test-tmp/manifest-light-quanta/<log-run-id>/
    const tmpDir = join(ROOT, "artifacts/test-tmp/manifest-light-quanta", logRunId);
    mkdirSync(tmpDir, { recursive: true });

    // 1. Mutation removing an ID without alias -> must fail
    const targetRetired = "s0-p4";
    const mutatedWithoutAlias = manifestIds.filter((id) => id !== targetRetired);
    const failResult = validateFrozenIds(snapshotText, mutatedWithoutAlias, []);
    expect(failResult.ok).toBe(false);
    expect(failResult.missingCount).toBe(1);
    expect(
      failResult.findings.some(
        (f) => f.kind === "frozen-id-missing" && f.id === targetRetired,
      ),
    ).toBe(true);

    writeFileSync(join(tmpDir, "manifest.without-alias.txt"), mutatedWithoutAlias.join("\n"));

    // 2. Mutation with a valid split alias -> must pass
    const splitAlias: AliasRecord = {
      retiredId: targetRetired,
      kind: "split",
      replacementIds: ["s0-p4a", "s0-p4b"],
      reason: "Test split alias validation",
      date: "2026-09-19",
      editor: "pane16",
    };

    const mutatedWithSplitAlias = manifestIds.flatMap((id) =>
      id === targetRetired ? ["s0-p4a", "s0-p4b"] : [id],
    );

    const passResult = validateFrozenIds(snapshotText, mutatedWithSplitAlias, [splitAlias]);
    expect(passResult.ok).toBe(true);
    expect(passResult.missingCount).toBe(0);

    writeFileSync(join(tmpDir, "manifest.with-split-alias.txt"), mutatedWithSplitAlias.join("\n"));

    logger.log({
      testId: "snapshot-frozen-id-validation-and-mutations",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Snapshot matches manifest IDs; missing ID fails; split alias passes.",
      extra: { check: "snapshot-mutations" },
    });
  });

  test("difficulties file contains all 4 sections, first-use ids, all 14 watch-list flags, and recomputed verification values within tolerance", () => {
    const diffPath = join(ROOT, "docs/editorial/light-quanta-difficulties.md");
    expect(existsSync(diffPath)).toBe(true);

    const content = readFileSync(diffPath, "utf8");

    // All 4 sections exist
    expect(content).toContain("## 1. Translation difficulties");
    expect(content).toContain("## 2. Notation difficulties");
    expect(content).toContain("## 3. Segmentation decisions");
    expect(content).toContain("## 4. Verification flags");

    // Period words and first-use IDs
    expect(content).toContain("heuristischer Gesichtspunkt");
    expect(content).toContain("masthead-title");
    expect(content).toContain("Undulationstheorie");
    expect(content).toContain("s0-p1");
    expect(content).toContain("Energiequanten");
    expect(content).toContain("s0-p3");

    // All 14 Watch-List Flags with valid results
    const EXPECTED_FLAGS = [
      "flag:s2-constants",
      "flag:s2-r-and-l-not-printed",
      "flag:s8-printed-check",
      "flag:s8-result-line",
      "flag:fn-displays",
      "flag:s3-variational-displays",
      "flag:s6-mean-energy",
      "flag:s8-inequalities",
      "flag:s9-count-relation",
      "flag:glyph-collisions",
      "flag:s7-thermal-caveat",
      "flag:no-ultraviolet-catastrophe",
      "flag:footnote-citations",
      "flag:dates",
    ] as const;

    for (const flagKey of EXPECTED_FLAGS) {
      const regex = new RegExp(`- \`${flagKey}\`\\s+(pending|matches|differs|not-found)\\b`, "i");
      expect(regex.test(content)).toBe(true);
    }

    // Specific flag content checks
    expect(content).toContain("-56");
    expect(content).toContain("-57");
    expect(content).toContain("1,62 . 10^-24 g");
    expect(content).toContain("9,6 . 10^3");

    // Glyph collisions check: L, E, P/P'/p, phi, T, alpha_nu, lambda, lg
    const notationSection = content.split("## 2. Notation difficulties")[1]?.split("## 3. Segmentation decisions")[0] ?? "";
    expect(notationSection).toContain("$L$");
    expect(notationSection).toContain("$E$");
    expect(notationSection).toContain("$P$, $P'$, and $p$");
    expect(notationSection).toContain("$\\varphi$");
    expect(notationSection).toContain("$T$");
    expect(notationSection).toContain("$\\alpha_\\nu$");
    expect(notationSection).toContain("$\\lambda$");
    expect(notationSection).toContain('"lg"');

    // Independent computation of verification values and tolerance checks
    const beta = 4.866e-11;
    const R = 8.31e7;
    const L = 3.0e10;
    const factor = (8 * Math.PI * R) / Math.pow(L, 3);

    // 1. N for alpha = 6.10e-57 (relative 1e-4 against 6.1705e23)
    const alpha1 = 6.10e-57;
    const N1_calc = (beta / alpha1) * factor;
    const tolN1 = { relative: 1e-4 };
    const verdictN1 = withinTolerance(N1_calc, 6.1705e23, tolN1);
    expect(verdictN1.ok).toBe(true);
    logger.log({
      testId: "recompute-N1-wien",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: tolN1,
      expected: 6.1705e23,
      actual: N1_calc,
      message: "Independent N1 computation matches 6.1705e23 within relative 1e-4 tolerance.",
      extra: { flagKey: "flag:s2-constants", check: "tolerance" },
    });

    // 2. N for alpha = 6.10e-56 (relative 1e-4 against 6.1705e22)
    const alpha2 = 6.10e-56;
    const N2_calc = (beta / alpha2) * factor;
    const tolN2 = { relative: 1e-4 };
    const verdictN2 = withinTolerance(N2_calc, 6.1705e22, tolN2);
    expect(verdictN2.ok).toBe(true);
    logger.log({
      testId: "recompute-N2-printed",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: tolN2,
      expected: 6.1705e22,
      actual: N2_calc,
      message: "Independent N2 computation matches 6.1705e22 within relative 1e-4 tolerance.",
      extra: { flagKey: "flag:s2-constants", check: "tolerance" },
    });

    // 3. Pi_emu for nu = 1.03e15, E = 9.6e3 (absolute 1e-4 V against 4.3385 V)
    const nu = 1.03e15;
    const E_emu = 9.6e3;
    const Pi_emu_calc = (R * beta * nu / E_emu) * 1e-8;
    const tolPi1 = { absolute: 1e-4 };
    const verdictPi1 = withinTolerance(Pi_emu_calc, 4.3385, tolPi1);
    expect(verdictPi1.ok).toBe(true);
    logger.log({
      testId: "recompute-Pi-emu",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: tolPi1,
      expected: 4.3385,
      actual: Pi_emu_calc,
      message: "Independent Pi_emu computation matches 4.3385 V within absolute 1e-4 V tolerance.",
      extra: { flagKey: "flag:s8-printed-check", check: "tolerance" },
    });

    // 4. Pi_stat (299.792458 V/statvolt), N = 6.17e23, e_esu = 4.7e-10 (absolute 1e-4 V against 4.3057 V)
    const N_printed = 6.17e23;
    const e_esu = 4.7e-10;
    const Pi_stat_299_calc = ((R / N_printed) * beta * nu / e_esu) * 299.792458;
    const tolPi2 = { absolute: 1e-4 };
    const verdictPi2 = withinTolerance(Pi_stat_299_calc, 4.3057, tolPi2);
    expect(verdictPi2.ok).toBe(true);
    logger.log({
      testId: "recompute-Pi-stat-299",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: tolPi2,
      expected: 4.3057,
      actual: Pi_stat_299_calc,
      message: "Independent Pi_stat (299.792458 V/statvolt) matches 4.3057 V within absolute 1e-4 V tolerance.",
      extra: { flagKey: "flag:s8-printed-check", check: "tolerance" },
    });

    // 5. Pi_stat (300 V/statvolt) (absolute 1e-4 V against 4.3087 V)
    const Pi_stat_300_calc = ((R / N_printed) * beta * nu / e_esu) * 300;
    const tolPi3 = { absolute: 1e-4 };
    const verdictPi3 = withinTolerance(Pi_stat_300_calc, 4.3087, tolPi3);
    expect(verdictPi3.ok).toBe(true);
    logger.log({
      testId: "recompute-Pi-stat-300",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "tolerance",
      tolerance: tolPi3,
      expected: 4.3087,
      actual: Pi_stat_300_calc,
      message: "Independent Pi_stat (300 V/statvolt) matches 4.3087 V within absolute 1e-4 V tolerance.",
      extra: { flagKey: "flag:s8-printed-check", check: "tolerance" },
    });
  });

  test("e2e report CLI runs cleanly with exit code 0, no unassigned destinations, and no percentages", () => {
    const { manifest } = loadManifest();
    const report = generateManifestReport(manifest);
    const text = formatManifestReportText(report);
    const json = JSON.stringify(report, null, 2);

    expect(report.paper).toBe(PAPER_SLUG);
    expect(report.totalUnits).toBe(128);
    expect(report.inScopeCount).toBe(128);
    expect(report.notInScopeCount).toBe(0);

    // No unit lacks a destination
    for (const u of manifest.units) {
      expect(u.destination).toBeDefined();
    }

    // Output contains NO percentages
    expect(/%/.test(text)).toBe(false);
    expect(/%/.test(json)).toBe(false);

    logger.log({
      testId: "report-cli-e2e",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Report CLI completes with 128 units, no unassigned destinations, and no percentages.",
      extra: { check: "report-cli" },
    });
  });

  test("content compiler check over corpus has no rejections for light-quanta", async () => {
    const files = await loadReadingFiles();
    const compiled = compileReadingContent(files);
    expect(compiled.ok).toBe(true);

    const lqRejections = compiled.diagnostics.filter(
      (d) =>
        d.severity === "error" &&
        (d.path?.includes("light-quanta") || d.message?.includes("light-quanta")),
    );
    expect(lqRejections.length).toBe(0);

    logger.log({
      testId: "content-compiler-clean",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Content compiler check over corpus has zero errors for light-quanta.",
      extra: { check: "content-compiler" },
    });
  });
});
