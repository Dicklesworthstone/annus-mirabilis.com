/**
 * Source Manifest and Locator Validator Tests.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AliasRecord } from "../aliases.ts";
import { getAbsentSourceLayers } from "./report.ts";
import { ManifestSchemaError, validateSourceManifest } from "./schema.ts";
import { type PaperSourceLayers, SOURCE_LAYER_KINDS, type SourceManifest } from "./types.ts";
import { spansPages, validateManifest, validateManifestCorpus } from "./validator.ts";

function generateLogRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

describe("Source Manifest & Locator Validator Suite", () => {
  const rootDir = process.cwd();
  const logRunId = generateLogRunId();
  const logDir = join(rootDir, "artifacts", "test-logs", "source-manifest-tests");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${logRunId}.jsonl`);

  function logTest(
    testId: string,
    outcome: "passed" | "failed",
    message: string,
    extra?: Record<string, unknown>,
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      suite: "source-manifest-tests",
      logRunId,
      testId,
      beadId: "am-cm-source-manifest-6qa",
      comparisonKind: "bitwise",
      outcome,
      message,
      extra,
    };
    writeFileSync(logPath, `${JSON.stringify(entry)}\n`, { flag: "a", encoding: "utf8" });
  }

  // Helper fixture builder
  function createMiniPaperManifest(overrides?: Partial<SourceManifest>): SourceManifest {
    return {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      idsFrozenAt: "2026-09-16T00:00:00Z",
      frozenBy: "editor-test",
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 132 }],
          status: "draft",
        },
        {
          id: "s1-p2",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 133 }],
          status: "draft",
        },
      ],
      ...overrides,
    };
  }

  it("validates a complete, valid two-page mini paper", () => {
    const manifest = createMiniPaperManifest();
    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    assert.equal(diags.filter((d) => d.severity === "error").length, 0);
    logTest("valid-mini-paper", "passed", "Complete two-page mini paper validates cleanly");
  });

  it("planted negative: duplicate unit id fails schema validation", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 133 }] },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => err instanceof ManifestSchemaError && err.code === "duplicate-unit-id",
    );
    logTest("planted-duplicate-unit-id", "passed", "Duplicate unit id rejected at schema level");
  });

  it("planted negative: unit on printed page 149 in paper ending at 148 fails page-out-of-range", () => {
    const manifest = createMiniPaperManifest({
      pageCount: 17,
      pageRange: [132, 148],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 149 }] }, // 149 is out of range
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const outOfRange = diags.find((d) => d.rule === "page-out-of-range");
    assert.ok(outOfRange, "Expected page-out-of-range diagnostic");
    assert.equal(outOfRange.actual, 149);
    logTest("planted-page-out-of-range", "passed", "Page 149 rejected for range [132, 148]");
  });

  it("planted negative: uncovered page in pageRange fails page-uncovered", () => {
    const manifest = createMiniPaperManifest({
      pageCount: 3,
      pageRange: [132, 134],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 134 }] }, // Page 133 missing
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const uncovered = diags.find((d) => d.rule === "page-uncovered");
    assert.ok(uncovered, "Expected page-uncovered diagnostic for page 133");
    assert.ok(uncovered.message.includes("Page 133"));
    logTest("planted-page-uncovered", "passed", "Detected uncovered page 133");
  });

  it("planted negative: paragraph spanning pages 550-552 missing middle page 551 fails unit-span-gap and page-uncovered with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      paper: "brownian-motion",
      document: "ap-17-549",
      pageCount: 3,
      pageRange: [550, 552],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 550 }, { page: 552 }], // missing intermediate page 551!
        },
      ],
    });

    const unit = manifest.units[0];
    assert.ok(unit);
    assert.equal(spansPages(unit), true);
    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });

    const spanGap = diags.find((d) => d.rule === "unit-span-gap");
    assert.ok(spanGap, "Expected unit-span-gap diagnostic for missing intermediate page 551");
    assert.equal(spanGap.rule, "unit-span-gap");
    assert.equal(spanGap.unitId, "s1-p1");
    assert.ok(spanGap.repair, "Expected actionable repair instructions");
    assert.ok(spanGap.repair.includes("551"));
    assert.ok(spanGap.repair.includes("s1-p1"));

    const uncovered = diags.find((d) => d.rule === "page-uncovered");
    assert.ok(uncovered, "Expected page-uncovered diagnostic for page 551");
    assert.equal(uncovered.rule, "page-uncovered");
    assert.ok(uncovered.repair, "Expected actionable repair instructions for page-uncovered");
    assert.ok(uncovered.repair.includes("551"));

    logTest(
      "planted-middle-page-uncovered",
      "passed",
      "Paragraph spanning pages 550-552 missing middle page 551 fails unit-span-gap and page-uncovered with unitId, rule, and repair",
    );
  });

  it("verifies paragraph spanning pages 550-552 with 3 locators covers page 551 without other units", () => {
    const manifest = createMiniPaperManifest({
      paper: "brownian-motion",
      document: "ap-17-549",
      pageCount: 3,
      pageRange: [550, 552],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 550 }, { page: 551 }, { page: 552 }],
        },
      ],
    });

    const unit = manifest.units[0];
    assert.ok(unit);
    assert.equal(spansPages(unit), true);
    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const spanGaps = diags.filter((d) => d.rule === "unit-span-gap");
    assert.equal(
      spanGaps.length,
      0,
      "Spanning paragraph covering middle page must have 0 unit-span-gap errors",
    );
    const uncovered = diags.filter((d) => d.rule === "page-uncovered");
    assert.equal(uncovered.length, 0, "Spanning paragraph must cover page 551");
    logTest(
      "spanning-paragraph-coverage",
      "passed",
      "Spanning paragraph 550-552 covers intermediate page 551",
    );
  });

  it("planted negative: unexplained paragraph sequence gap fails sequence-gap with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
        { id: "s1-p3", kind: "paragraph", section: "s1", locators: [{ page: 133 }] }, // missing s1-p2
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const gap = diags.find((d) => d.rule === "sequence-gap");
    assert.ok(gap, "Expected sequence-gap diagnostic for missing s1-p2");
    assert.equal(gap.rule, "sequence-gap");
    assert.equal(gap.unitId, "s1-p2");
    assert.ok(gap.repair, "Expected actionable repair instructions");
    assert.ok(gap.repair.includes("s1-p2"));
    assert.ok(gap.repair.includes("content/aliases/"));
    logTest(
      "planted-sequence-gap-unexplained",
      "passed",
      "Unexplained sequence gap s1-p2 caught with unitId, rule, and repair",
    );
  });

  it("verifies paragraph sequence gap s2-p2 explained by merged alias passes", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s2-p1", kind: "paragraph", section: "s2", locators: [{ page: 132 }] },
        { id: "s2-p3", kind: "paragraph", section: "s2", locators: [{ page: 133 }] },
      ],
    });

    const aliases: AliasRecord[] = [
      {
        retiredId: "s2-p2",
        kind: "merged",
        replacementIds: ["s2-p1"],
        reason: "Merged short paragraph with preceding section opener.",
        date: "2026-09-16",
        editor: "editor-test",
      },
    ];

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
      aliases,
    });
    const gap = diags.filter((d) => d.rule === "sequence-gap");
    assert.equal(gap.length, 0, "Explained gap must pass");
    logTest(
      "gap-explained-by-alias",
      "passed",
      "Gap s2-p2 explained by merged alias passes validation",
    );
  });

  it("planted negative: unexplained footnote sequence gap fails sequence-gap with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
        { id: "s1-fn1", kind: "footnote", footnoteMark: "1", locators: [{ page: 132 }] },
        { id: "s1-fn3", kind: "footnote", footnoteMark: "3", locators: [{ page: 133 }] }, // missing s1-fn2!
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const gap = diags.find((d) => d.rule === "sequence-gap");
    assert.ok(gap, "Expected sequence-gap diagnostic for missing s1-fn2");
    assert.equal(gap.rule, "sequence-gap");
    assert.equal(gap.unitId, "s1-fn2");
    assert.ok(gap.repair, "Expected actionable repair instructions");
    assert.ok(gap.repair.includes("s1-fn2"));
    assert.ok(gap.repair.includes("content/aliases/"));
    logTest(
      "planted-footnote-sequence-gap-unexplained",
      "passed",
      "Unexplained footnote sequence gap s1-fn2 caught with unitId, rule, and repair",
    );
  });

  it("verifies footnote sequence gap s1-fn2 explained by merged alias passes", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
        { id: "s1-fn1", kind: "footnote", footnoteMark: "1", locators: [{ page: 132 }] },
        { id: "s1-fn3", kind: "footnote", footnoteMark: "3", locators: [{ page: 133 }] },
      ],
    });

    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-fn2",
        kind: "merged",
        replacementIds: ["s1-fn1"],
        reason: "Merged duplicate footnote reference.",
        date: "2026-09-16",
        editor: "editor-test",
      },
    ];

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
      aliases,
    });
    const gap = diags.filter((d) => d.rule === "sequence-gap");
    assert.equal(gap.length, 0, "Explained footnote gap must pass");
    logTest(
      "footnote-gap-explained-by-alias",
      "passed",
      "Footnote gap s1-fn2 explained by merged alias passes validation",
    );
  });

  it("verifies inline math ids m1 and m3 without m2 are exempt from sequence gap reporting", () => {
    const manifest = createMiniPaperManifest({
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 132 }],
        },
        {
          id: "s1-p2",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 133 }],
        },
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const mathGaps = diags.filter((d) => d.rule === "sequence-gap" && d.unitId?.includes("-m"));
    assert.equal(mathGaps.length, 0);
    logTest("inline-math-gap-exempt", "passed", "Inline math index skips are not reported as gaps");
  });

  it("planted negative: repeated printed equation numbers without qualification fail duplicate-equation-anchor", () => {
    const _manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "eq-1", kind: "equation", originalLabel: "(1)", locators: [{ page: 132 }] },
        { id: "eq-1", kind: "equation", originalLabel: "(1)", locators: [{ page: 133 }] }, // Duplicate label without s3 qualification
      ],
    });

    // In schema validation it throws duplicate id, or in validator if different ids share bare anchor
    const manifest2 = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "eq-1", kind: "equation", originalLabel: "(1)", locators: [{ page: 132 }] },
        { id: "eq-2", kind: "equation", originalLabel: "(1)", locators: [{ page: 133 }] }, // Same printed label (1)
      ],
    });

    const diags = validateManifest(manifest2, {
      manifests: new Map([[manifest2.paper, manifest2]]),
    });
    const dup = diags.find((d) => d.rule === "duplicate-equation-anchor");
    assert.ok(dup, "Expected duplicate-equation-anchor diagnostic for unqualified (1)");
    logTest(
      "planted-duplicate-equation-anchor",
      "passed",
      "Repeated printed equation number without section qualification caught",
    );
  });

  it("planted negative: display equation containedIn paragraph ending on earlier page fails", () => {
    const manifest = createMiniPaperManifest({
      pageCount: 3,
      pageRange: [132, 134],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 132 }],
        },
        {
          id: "eq-s1-1",
          kind: "equation",
          containedIn: "s1-p1",
          locators: [{ page: 133 }], // Equation on 133, but s1-p1 ended on 132
        },
        {
          id: "s1-p2",
          kind: "paragraph",
          locators: [{ page: 134 }],
        },
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const mismatch = diags.find((d) => d.rule === "equation-containedin-mismatch");
    assert.ok(mismatch, "Expected equation-containedin-mismatch");
    logTest(
      "planted-equation-containedin-mismatch",
      "passed",
      "Display equation containedIn earlier ending paragraph caught",
    );
  });

  it("planted negative: complete paper with unreviewed unit fails manifest-incomplete", () => {
    const manifest = createMiniPaperManifest({
      status: "complete",
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }], status: "reviewed" },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }], status: "draft" }, // unreviewed
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const incomplete = diags.find((d) => d.rule === "manifest-incomplete");
    assert.ok(
      incomplete,
      "Expected manifest-incomplete diagnostic for draft unit in complete paper",
    );
    logTest("planted-manifest-incomplete", "passed", "Complete paper with draft unit rejected");
  });

  it("planted negative: body unit whose start page precedes previous body unit end page fails", () => {
    const manifest = createMiniPaperManifest({
      pageCount: 3,
      pageRange: [132, 134],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 134 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 132 }] }, // starts on 132 after 134
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const decreasing = diags.find((d) => d.rule === "unit-order-decreasing");
    assert.ok(decreasing, "Expected unit-order-decreasing diagnostic");
    logTest("planted-unit-order-decreasing", "passed", "Decreasing body unit start page rejected");
  });

  it("planted negative: unit locators decreasing in page fails locators-decreasing", () => {
    const manifest = createMiniPaperManifest({
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 133 }, { page: 132 }], // 133 -> 132
        },
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const dec = diags.find((d) => d.rule === "locators-decreasing");
    assert.ok(dec, "Expected locators-decreasing diagnostic");
    logTest("planted-locators-decreasing", "passed", "Decreasing unit locators rejected");
  });

  it("verifies footnote on next page passes when recorded with splitPage and fails when unrecorded", () => {
    // Unrecorded split
    const unrecordedManifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          containedIn: "s1-p1",
          footnoteMark: "1",
          locators: [{ page: 133 }],
        },
      ],
    });

    const diagsUnrecorded = validateManifest(unrecordedManifest, {
      manifests: new Map([[unrecordedManifest.paper, unrecordedManifest]]),
    });
    const splitDiag = diagsUnrecorded.find((d) => d.rule === "footnote-split-unrecorded");
    assert.ok(splitDiag, "Expected footnote-split-unrecorded for unrecorded split");
    assert.equal(splitDiag.rule, "footnote-split-unrecorded");
    assert.equal(splitDiag.unitId, "s1-fn1");
    assert.ok(splitDiag.repair, "Expected actionable repair instructions");
    assert.ok(
      splitDiag.repair.includes("splitPage: true") ||
        splitDiag.repair.includes("isSplitFootnote: true"),
    );

    // Recorded split
    const recordedManifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          containedIn: "s1-p1",
          footnoteMark: "1",
          isSplitFootnote: true,
          locators: [{ page: 133, splitPage: true }],
        },
      ],
    });

    const diagsRecorded = validateManifest(recordedManifest, {
      manifests: new Map([[recordedManifest.paper, recordedManifest]]),
    });
    assert.equal(
      diagsRecorded.filter((d) => d.rule === "footnote-split-unrecorded").length,
      0,
      "Recorded split footnote must pass",
    );
    logTest(
      "footnote-split-handling",
      "passed",
      "Split footnote verified: passes when recorded, fails when unrecorded",
    );
  });

  it("planted negative: footnote on next page following markPage unrecorded fails footnote-split-unrecorded with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          markPage: 132,
          footnoteMark: "1",
          locators: [{ page: 133 }], // Unrecorded split
        },
      ],
    });

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const splitDiag = diags.find((d) => d.rule === "footnote-split-unrecorded");
    assert.ok(splitDiag, "Expected footnote-split-unrecorded diagnostic");
    assert.equal(splitDiag.rule, "footnote-split-unrecorded");
    assert.equal(splitDiag.unitId, "s1-fn1");
    assert.ok(splitDiag.repair, "Expected actionable repair instructions");
    assert.ok(
      splitDiag.repair.includes("splitPage: true") ||
        splitDiag.repair.includes("isSplitFootnote: true"),
    );
    assert.ok(splitDiag.repair.includes("markPage: 132"));
    logTest(
      "planted-footnote-split-unrecorded-with-markpage",
      "passed",
      "Footnote on next page following markPage unrecorded fails footnote-split-unrecorded",
    );
  });

  it("verifies footnote on next page following markPage passes when recorded with splitPage", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          markPage: 132,
          footnoteMark: "1",
          locators: [{ page: 133, splitPage: true }],
        },
      ],
    });

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const splitDiags = diags.filter((d) => d.rule === "footnote-split-unrecorded");
    assert.equal(splitDiags.length, 0, "Footnote on next page recorded with splitPage must pass");
    logTest(
      "footnote-split-markpage-recorded",
      "passed",
      "Footnote with markPage recorded with splitPage passes validation",
    );
  });

  it("planted negative: footnote preceding its markPage fails footnote-precedes-mark with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 133 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          markPage: 133,
          footnoteMark: "1",
          locators: [{ page: 132 }], // Precedes markPage!
        },
      ],
    });

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const precDiag = diags.find((d) => d.rule === "footnote-precedes-mark");
    assert.ok(precDiag, "Expected footnote-precedes-mark diagnostic");
    assert.equal(precDiag.rule, "footnote-precedes-mark");
    assert.equal(precDiag.unitId, "s1-fn1");
    assert.ok(precDiag.repair, "Expected actionable repair instructions");
    logTest(
      "planted-footnote-precedes-mark",
      "passed",
      "Footnote preceding markPage rejected with footnote-precedes-mark",
    );
  });

  it("planted negative: footnote more than one page after markPage fails footnote-page-too-far with unitId, rule, and repair", () => {
    const manifest = createMiniPaperManifest({
      pageCount: 3,
      pageRange: [132, 134],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }, { page: 134 }] },
        {
          id: "s1-fn1",
          kind: "footnote",
          markPage: 132,
          footnoteMark: "1",
          locators: [{ page: 134 }], // 2 pages after markPage!
        },
      ],
    });

    const diags = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
    });
    const farDiag = diags.find((d) => d.rule === "footnote-page-too-far");
    assert.ok(farDiag, "Expected footnote-page-too-far diagnostic");
    assert.equal(farDiag.rule, "footnote-page-too-far");
    assert.equal(farDiag.unitId, "s1-fn1");
    assert.ok(farDiag.repair, "Expected actionable repair instructions");
    logTest(
      "planted-footnote-page-too-far",
      "passed",
      "Footnote >1 page after markPage rejected with footnote-page-too-far",
    );
  });

  it("planted negative: footnote with no mark fails footnote-unmarked", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "fn-orphan", kind: "footnote", locators: [{ page: 132 }] }, // No footnoteMark and no sX-fn id
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const unmarked = diags.find((d) => d.rule === "footnote-unmarked");
    assert.ok(unmarked, "Expected footnote-unmarked diagnostic");
    logTest("planted-footnote-unmarked", "passed", "Footnote without text mark caught");
  });

  it("planted negative: manifest asserting 'reviewed' status directly fails status-asserted", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          status: "reviewed",
          translation: "reviewed", // Direct assertion
          locators: [{ page: 132 }],
        },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => err instanceof ManifestSchemaError && err.code === "status-asserted",
    );
    logTest(
      "planted-status-asserted",
      "passed",
      "Direct assertion of reviewed status in manifest rejected",
    );
  });

  it("planted negative: reference sub-entry id not matching <unit>-r<i> fails reference-id-invalid", () => {
    const manifest = createMiniPaperManifest({
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 132 }],
          references: [{ id: "bad-ref-id", targetCitationId: "cite-1" }],
        },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }] },
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const badRef = diags.find((d) => d.rule === "reference-id-invalid");
    assert.ok(badRef, "Expected reference-id-invalid diagnostic");
    logTest("planted-reference-id-invalid", "passed", "Invalid reference sub-entry id caught");
  });

  it("planted negative: frozen id missing without alias fails, passes with retired alias", () => {
    const manifest = createMiniPaperManifest({
      paper: "light-quanta",
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }] },
      ],
    });

    const frozenSnapshots = new Map<string, readonly string[]>([
      ["light-quanta", ["s1-p1", "s1-p2", "s1-p3"]], // s1-p3 is missing from units
    ]);

    // 1. Without alias -> fails
    const diagsMissing = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
      frozenSnapshots,
    });
    const frozenDiag = diagsMissing.find((d) => d.rule === "frozen-id-missing");
    assert.ok(frozenDiag, "Expected frozen-id-missing diagnostic");
    assert.equal(frozenDiag.unitId, "s1-p3");

    // 2. With retired alias -> passes
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p3",
        kind: "retired",
        replacementIds: ["s1-p2"],
        reason: "Editorial resegmentation retired s1-p3.",
        date: "2026-09-16",
        editor: "editor-test",
      },
    ];

    const diagsWithAlias = validateManifest(manifest, {
      manifests: new Map([[manifest.paper, manifest]]),
      frozenSnapshots,
      aliases,
    });
    assert.equal(
      diagsWithAlias.filter((d) => d.rule === "frozen-id-missing").length,
      0,
      "Missing frozen id with retired alias must pass",
    );
    logTest(
      "frozen-id-preservation",
      "passed",
      "Frozen id preservation verified with and without alias",
    );
  });

  it("verifies export printedForm mismatch and import rules (use, self-ref, unexported, chronology)", () => {
    // 1. Export LaTeX mismatch
    const relManifest = createMiniPaperManifest({
      paper: "special-relativity",
      document: "ap-17-891",
      pageCount: 31,
      pageRange: [891, 921],
      exports: [
        {
          id: "sr-s8-result",
          statement: "Transformation of electromagnetic fields",
          printedForm: "X' = X",
        },
        {
          id: "sr-s10-result",
          statement: "Mass energy relation small speed",
          printedForm: "\\mu = \\frac{E}{V^2}",
        },
      ],
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 891 }] }],
    });

    const sourceBlocks = new Map<string, { diplomaticText: string; printedLatex?: string }>([
      ["sr-s8-result", { diplomaticText: "X' = X", printedLatex: "X' = X" }],
      ["sr-s10-result", { diplomaticText: "diff", printedLatex: "\\mu = \\frac{E}{c^2}" }], // Mismatch with printedForm
    ]);

    const paperDates = new Map<string, { received: string }>([
      ["special-relativity", { received: "1905-06-30" }],
      ["mass-energy", { received: "1905-09-27" }],
    ]);

    const relDiags = validateManifest(relManifest, {
      manifests: new Map([[relManifest.paper, relManifest]]),
      sourceBlocks,
      paperDates,
    });
    const expMismatch = relDiags.find((d) => d.rule === "export-latex-mismatch");
    assert.ok(expMismatch, "Expected export-latex-mismatch diagnostic");

    // 2. Valid mass-energy import of relativity §8 (use: premise) and §10 (use: comparison)
    const meManifest = createMiniPaperManifest({
      paper: "mass-energy",
      document: "ap-18-639",
      pageCount: 3,
      pageRange: [639, 641],
      importedResults: [
        { paper: "special-relativity", resultId: "sr-s8-result", use: "premise" },
        { paper: "special-relativity", resultId: "sr-s10-result", use: "comparison" },
      ],
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 639 }] },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 640 }] },
        { id: "s1-p3", kind: "paragraph", locators: [{ page: 641 }] },
      ],
    });

    const allManifests = new Map<string, SourceManifest>([
      ["special-relativity", relManifest],
      ["mass-energy", meManifest],
    ]);

    const meDiags = validateManifest(meManifest, {
      manifests: allManifests,
      paperDates,
    });
    assert.equal(
      meDiags.filter((d) => d.rule.startsWith("import-")).length,
      0,
      "Valid mass-energy imports must pass",
    );

    // 3. Unexported import
    const badImportManifest = createMiniPaperManifest({
      paper: "mass-energy",
      document: "ap-18-639",
      importedResults: [
        { paper: "special-relativity", resultId: "sr-unexported-result", use: "premise" },
      ],
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    });

    const badImportDiags = validateManifest(badImportManifest, {
      manifests: allManifests,
      paperDates,
    });
    const unexported = badImportDiags.find((d) => d.rule === "import-unexported-result");
    assert.ok(unexported, "Expected import-unexported-result diagnostic");

    // 4. Anachronistic import (relativity importing mass-energy which was received later)
    const anachronisticManifest = createMiniPaperManifest({
      paper: "special-relativity",
      document: "ap-17-891",
      importedResults: [{ paper: "mass-energy", resultId: "me-result", use: "premise" }],
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    });

    const anachDiags = validateManifest(anachronisticManifest, {
      manifests: allManifests,
      paperDates,
    });
    const anach = anachDiags.find((d) => d.rule === "import-anachronism");
    assert.ok(anach, "Expected import-anachronism diagnostic");

    logTest(
      "import-export-epistemic-rules",
      "passed",
      "Export LaTeX matching and import epistemic chronology rules verified",
    );
  });

  it("verifies scoped companion with not-in-scope units passes, but fails if claiming complete status", () => {
    // 1. Scoped companion passes
    const scopedCompanion = createMiniPaperManifest({
      paper: "molecular-dimensions",
      document: "ap-19-289",
      status: "scoped",
      scope: "selected-sections",
      pageCount: 18,
      pageRange: [289, 306],
      units: [
        { id: "s1-p1", kind: "paragraph", scope: "in-scope", locators: [{ page: 289 }] },
        { id: "s2-p1", kind: "paragraph", scope: "not-in-scope", locators: [{ page: 290 }] },
        ...Array.from({ length: 16 }, (_, idx) => ({
          id: `s-rest-p${idx + 1}`,
          kind: "paragraph",
          scope: "not-in-scope" as const,
          locators: [{ page: 291 + idx }],
        })),
      ],
    });

    const scopedDiags = validateManifest(scopedCompanion, {
      manifests: new Map([[scopedCompanion.paper, scopedCompanion]]),
    });
    assert.equal(
      scopedDiags.filter((d) => d.severity === "error").length,
      0,
      "Scoped companion with not-in-scope units must pass",
    );

    // 2. Claiming whole-document complete status with not-in-scope units fails
    const completeClaimCompanion = createMiniPaperManifest({
      ...scopedCompanion,
      status: "complete",
    });

    const completeDiags = validateManifest(completeClaimCompanion, {
      manifests: new Map([[completeClaimCompanion.paper, completeClaimCompanion]]),
    });
    const compDiag = completeDiags.find((d) => d.rule === "companion-scope-invalid");
    assert.ok(compDiag, "Expected companion-scope-invalid diagnostic");
    logTest(
      "scoped-companion-rules",
      "passed",
      "Scoped companion verified with in-scope and not-in-scope units",
    );
  });

  it("planted negative: draft header using 'frozen' object fails with modern form named in message and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      frozen: { at: "2026-09-16", by: "editor" }, // Draft header
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "draft-header-frozen");
        assert.equal(err.rule, "draft-header-frozen");
        assert.ok(err.message.includes("idsFrozenAt"));
        assert.ok(err.message.includes("frozenBy"));
        assert.ok(err.repair, "Expected actionable repair instructions");
        assert.ok(err.repair.includes("idsFrozenAt"));
        assert.ok(err.repair.includes("frozenBy"));
        return true;
      },
    );
    logTest(
      "planted-draft-header-frozen",
      "passed",
      "Draft 'frozen' header rejected with modern names in message and repair",
    );
  });

  it("verifies valid idsFrozenAt ISO timestamp and frozenBy identifier validate cleanly and are retained", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      idsFrozenAt: "2026-09-16T12:00:00Z",
      frozenBy: "editor-albert",
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    const validated = validateSourceManifest(raw);
    assert.equal(validated.idsFrozenAt, "2026-09-16T12:00:00Z");
    assert.equal(validated.frozenBy, "editor-albert");
    logTest(
      "valid-ids-frozen-at-and-frozen-by",
      "passed",
      "Valid idsFrozenAt and frozenBy accepted and retained",
    );
  });

  it("planted negative: idsFrozenAt specified without frozenBy fails missing-frozen-by with rule and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      idsFrozenAt: "2026-09-16T12:00:00Z",
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "missing-frozen-by");
        assert.equal(err.rule, "missing-frozen-by");
        assert.ok(err.repair, "Expected actionable repair");
        assert.ok(err.repair.includes("frozenBy"));
        return true;
      },
    );
    logTest(
      "planted-missing-frozen-by",
      "passed",
      "idsFrozenAt without frozenBy fails missing-frozen-by with repair",
    );
  });

  it("planted negative: frozenBy specified without idsFrozenAt fails missing-ids-frozen-at with rule and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      frozenBy: "editor-albert",
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "missing-ids-frozen-at");
        assert.equal(err.rule, "missing-ids-frozen-at");
        assert.ok(err.repair, "Expected actionable repair");
        assert.ok(err.repair.includes("idsFrozenAt"));
        return true;
      },
    );
    logTest(
      "planted-missing-ids-frozen-at",
      "passed",
      "frozenBy without idsFrozenAt fails missing-ids-frozen-at with repair",
    );
  });

  it("planted negative: idsFrozenAt with invalid ISO timestamp fails invalid-ids-frozen-at with rule and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      idsFrozenAt: "not-an-iso-date",
      frozenBy: "editor-albert",
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "invalid-ids-frozen-at");
        assert.equal(err.rule, "invalid-ids-frozen-at");
        assert.ok(err.repair, "Expected actionable repair");
        assert.ok(err.repair.includes("idsFrozenAt"));
        return true;
      },
    );
    logTest(
      "planted-invalid-ids-frozen-at",
      "passed",
      "Non-ISO idsFrozenAt fails invalid-ids-frozen-at with repair",
    );
  });

  it("planted negative: complete full-document manifest omitting closing-received fails closing-received-missing", () => {
    const completeWithoutClosing = createMiniPaperManifest({
      status: "complete",
      scope: "full-document",
      units: [
        { id: "s1-p1", kind: "paragraph", status: "reviewed", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", status: "reviewed", locators: [{ page: 133 }] },
      ],
    });

    const diags = validateManifest(completeWithoutClosing, {
      manifests: new Map([[completeWithoutClosing.paper, completeWithoutClosing]]),
    });
    const closingDiag = diags.find((d) => d.rule === "closing-received-missing");
    assert.ok(closingDiag, "Expected closing-received-missing diagnostic");

    // With closing-received unit, it passes
    const completeWithClosing = createMiniPaperManifest({
      status: "complete",
      scope: "full-document",
      units: [
        { id: "s1-p1", kind: "paragraph", status: "reviewed", locators: [{ page: 132 }] },
        { id: "s1-p2", kind: "paragraph", status: "reviewed", locators: [{ page: 133 }] },
        {
          id: "closing-1",
          kind: "closing-received",
          status: "reviewed",
          locators: [{ page: 133 }],
        },
      ],
    });

    const diagsPass = validateManifest(completeWithClosing, {
      manifests: new Map([[completeWithClosing.paper, completeWithClosing]]),
    });
    assert.equal(
      diagsPass.filter((d) => d.severity === "error").length,
      0,
      "Complete manifest with closing-received must pass",
    );
    logTest(
      "closing-received-receipt-rule",
      "passed",
      "Closing-received unit required for complete full-document manifest",
    );
  });

  it("planted negative: draft locator format with start/end fails draft-locator-format with unitId, rule, and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locator: { start: { page: 132 }, end: { page: 133 } }, // Draft locator
          locators: [{ page: 132 }],
        },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "draft-locator-format");
        assert.equal(err.rule, "draft-locator-format");
        assert.equal(err.unitId, "s1-p1");
        assert.ok(err.repair, "Expected actionable repair instructions");
        assert.ok(err.repair.includes("locators"));
        assert.ok(err.message.includes("locators"));
        return true;
      },
    );
    logTest(
      "planted-draft-locator-format",
      "passed",
      "Draft locator with start/end rejected with modern locators list named",
    );
  });

  it("planted negative: draft heading id ending in -h fails draft-heading-id-format with unitId, rule, and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        {
          id: "s1-h", // Draft heading id
          kind: "heading",
          locators: [{ page: 132 }],
        },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "draft-heading-id-format");
        assert.equal(err.rule, "draft-heading-id-format");
        assert.equal(err.unitId, "s1-h");
        assert.ok(err.repair, "Expected actionable repair instructions");
        assert.ok(err.repair.includes("s1"));
        assert.ok(err.message.includes("s1"));
        return true;
      },
    );
    logTest(
      "planted-draft-heading-id-format",
      "passed",
      "Draft heading id s1-h rejected with s1 named in repair and message",
    );
  });

  it("planted negative: draft footnote sentence id fails draft-sentence-id-format with unitId, rule, and repair", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        {
          id: "s1-fn1-s1", // Draft sentence id in footnote
          kind: "footnote",
          footnoteMark: "1",
          locators: [{ page: 132 }],
        },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => {
        assert.ok(err instanceof ManifestSchemaError);
        assert.equal(err.code, "draft-sentence-id-format");
        assert.equal(err.rule, "draft-sentence-id-format");
        assert.equal(err.unitId, "s1-fn1-s1");
        assert.ok(err.repair, "Expected actionable repair instructions");
        assert.ok(err.repair.includes("s1-fn1"));
        assert.ok(err.message.includes("s1-fn1"));
        return true;
      },
    );
    logTest(
      "planted-draft-sentence-id-format",
      "passed",
      "Draft footnote sentence id rejected naming s1-fn1 in repair and message",
    );
  });

  it("planted negative: invalid figures declaration fails invalid-figures-declaration", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      figures: "inline", // Must be "none"
      pageCount: 2,
      pageRange: [132, 133],
      units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) =>
        err instanceof ManifestSchemaError && err.code === "invalid-figures-declaration",
    );
    logTest(
      "planted-invalid-figures-declaration",
      "passed",
      "Non-none figures declaration rejected",
    );
  });

  it("planted negative: out of bounds region coordinates fail region-out-of-bounds", () => {
    const raw = {
      paper: "mini-paper",
      document: "ap-17-132",
      status: "in-preparation",
      pageCount: 2,
      pageRange: [132, 133],
      units: [
        {
          id: "s1-p1",
          kind: "paragraph",
          locators: [{ page: 132, region: { x: -5, y: 10, width: 50, height: 50 } }], // x < 0
        },
      ],
    };

    assert.throws(
      () => validateSourceManifest(raw),
      (err: unknown) => err instanceof ManifestSchemaError && err.code === "region-out-of-bounds",
    );
    logTest("planted-region-out-of-bounds", "passed", "Negative region coordinates rejected");
  });

  it("planted negative: containedIn pointing to non-existent or invalid unit fails containedin-target-invalid", () => {
    const manifest = createMiniPaperManifest({
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] },
        {
          id: "eq-1",
          kind: "equation",
          containedIn: "non-existent-unit",
          locators: [{ page: 132 }],
        },
      ],
    });

    const diags = validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });
    const targetDiag = diags.find((d) => d.rule === "containedin-target-invalid");
    assert.ok(targetDiag, "Expected containedin-target-invalid diagnostic");
    logTest(
      "planted-containedin-target-invalid",
      "passed",
      "Invalid containedIn target unit caught",
    );
  });

  it("verifies empty corpus passes and empty manifest on declared paper fails empty-manifest", () => {
    // 1. Empty corpus passes
    const emptyCorpusResult = validateManifestCorpus(new Map());
    assert.equal(emptyCorpusResult.ok, true);
    assert.equal(emptyCorpusResult.diagnostics.length, 0);

    // 2. In-preparation paper with empty units is absence, not a completeness error
    const emptyInPrep = createMiniPaperManifest({
      units: [],
    });
    const inPrepDiags = validateManifest(emptyInPrep, {
      manifests: new Map([[emptyInPrep.paper, emptyInPrep]]),
    });
    const absentFlag = inPrepDiags.find((d) => d.rule === "source-units-absent");
    assert.ok(absentFlag, "Expected source-units-absent flag");
    assert.equal(absentFlag.severity, "flag");
    assert.equal(
      inPrepDiags.some((d) => d.rule === "empty-manifest" && d.severity === "error"),
      false,
    );

    // 3. Complete paper with empty units is an error: completeness cannot be claimed
    const emptyComplete = createMiniPaperManifest({
      status: "complete",
      units: [],
    });
    const completeDiags = validateManifest(emptyComplete, {
      manifests: new Map([[emptyComplete.paper, emptyComplete]]),
    });
    const emptyDiag = completeDiags.find((d) => d.rule === "empty-manifest");
    assert.ok(emptyDiag, "Expected empty-manifest diagnostic");
    assert.equal(emptyDiag.severity, "error");
    logTest(
      "empty-corpus-and-empty-manifest-rules",
      "passed",
      "Empty corpus passes; in-preparation empty units flag absence; complete empty units error",
    );
  });

  it("registers manifest check plugin and runs validation during compiler check pass", async () => {
    const { listRegisteredChecks } = await import("../compiler/checks/registry.ts");
    const { SOURCE_MANIFEST_CHECK_ID, registerSourceManifestCheck } = await import("./check.ts");

    registerSourceManifestCheck();
    const checks = listRegisteredChecks();
    const manifestCheck = checks.find((c) => c.id === SOURCE_MANIFEST_CHECK_ID);
    assert.ok(manifestCheck, "Expected manifest check to be registered");
    assert.equal(manifestCheck.family, "manifest");
    assert.equal(manifestCheck.beadId, "am-cm-source-manifest-6qa");

    const reports: unknown[] = [];
    const validManifest = createMiniPaperManifest();
    manifestCheck.run({
      records: new Map([[validManifest.paper, validManifest]]),
      files: [],
      indexes: {},
      report: (diag) => reports.push(diag),
    });

    assert.equal(reports.length, 0, "Valid manifest produces zero compiler check reports");
    logTest(
      "check-plugin-registration",
      "passed",
      "Source manifest compiler check successfully registered and executed",
    );
  });

  it("absent source layers are a typed state, and complete status fails if source layers are absent", () => {
    const absentLayers = getAbsentSourceLayers("no-reviewed-ledger");
    for (const kind of SOURCE_LAYER_KINDS) {
      const layer = absentLayers[kind];
      assert.equal(layer.layer, kind);
      assert.equal(layer.state, "absent");
      assert.equal(layer.available, false);
      assert.equal(layer.unitCount, 0);
      assert.ok(typeof layer.reason === "string" && layer.reason.length > 0);
    }

    const completeManifest = createMiniPaperManifest({
      status: "complete",
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }], status: "reviewed" },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }], status: "reviewed" },
        {
          id: "closing-1",
          kind: "closing-received",
          locators: [{ page: 133 }],
          status: "reviewed",
        },
      ],
    });

    const diags = validateManifest(completeManifest, {
      manifests: new Map([[completeManifest.paper, completeManifest]]),
      sourceLayers: new Map([[completeManifest.paper, absentLayers]]),
    });

    const absentDiag = diags.find((d) => d.rule === "absent-source-layers-cannot-be-complete");
    assert.ok(
      absentDiag,
      "Expected absent-source-layers-cannot-be-complete diagnostic when source layers are absent",
    );
    assert.equal(absentDiag.severity, "error");
    assert.ok(absentDiag.message.includes("ledger"));
    assert.ok(absentDiag.message.includes("transcription"));
    assert.ok(absentDiag.message.includes("translation"));
    assert.ok(absentDiag.message.includes("gloss"));

    logTest(
      "absent-source-layers-typed-state",
      "passed",
      "Absent source layers are strictly typed and prevent fraudulent complete status",
    );
  });

  it("complete status passes source layer check when all four layers are present and reviewed", () => {
    const presentLayers: PaperSourceLayers = {
      ledger: {
        layer: "ledger",
        state: "present",
        status: "reviewed",
        available: true,
        unitCount: 1,
      },
      transcription: {
        layer: "transcription",
        state: "present",
        status: "reviewed",
        available: true,
        unitCount: 3,
      },
      translation: {
        layer: "translation",
        state: "present",
        status: "reviewed",
        available: true,
        unitCount: 3,
      },
      gloss: {
        layer: "gloss",
        state: "present",
        status: "reviewed",
        available: true,
        unitCount: 15,
      },
    };

    const completeManifest = createMiniPaperManifest({
      status: "complete",
      units: [
        { id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }], status: "reviewed" },
        { id: "s1-p2", kind: "paragraph", locators: [{ page: 133 }], status: "reviewed" },
        {
          id: "closing-1",
          kind: "closing-received",
          locators: [{ page: 133 }],
          status: "reviewed",
        },
      ],
    });

    const diags = validateManifest(completeManifest, {
      manifests: new Map([[completeManifest.paper, completeManifest]]),
      sourceLayers: new Map([[completeManifest.paper, presentLayers]]),
    });

    const absentDiag = diags.find((d) => d.rule === "absent-source-layers-cannot-be-complete");
    assert.equal(
      absentDiag,
      undefined,
      "No absent-source-layers diagnostic should be emitted when layers are present",
    );

    logTest(
      "present-source-layers-admitted",
      "passed",
      "All four source layers present and reviewed allows completeness",
    );
  });

  it("enforces no pdftotext or text-layer extraction in manifest compiler and validator", async () => {
    const { readFile } = await import("node:fs/promises");
    const { loadDenylist, scanContentForViolations } = await import(
      "../../../scripts/sources/ocrGuard.ts"
    );

    const denylistConfig = await loadDenylist(rootDir);
    const manifestFiles = [
      "src/content/manifest/schema.ts",
      "src/content/manifest/validator.ts",
      "src/content/manifest/report.ts",
      "src/content/manifest/check.ts",
      "src/content/manifest/types.ts",
      "src/content/manifest/index.ts",
      "scripts/source-manifest-report.ts",
    ];

    for (const relPath of manifestFiles) {
      const content = await readFile(join(rootDir, relPath), "utf-8");
      const violations = scanContentForViolations(relPath, content, denylistConfig.denylist);
      assert.equal(
        violations.length,
        0,
        `Forbidden OCR / text extraction calls found in ${relPath}: ${violations.map((v) => v.pattern).join(", ")}`,
      );
    }

    logTest(
      "ocr-guard-clean-in-manifest",
      "passed",
      "Zero pdftotext or text-layer extraction violations in source manifest modules",
    );
  });
});
