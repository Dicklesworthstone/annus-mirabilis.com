/**
 * End-to-end integration tests for structural compiler rejections via CLI.
 *
 * Spawns `bun scripts/build-content.ts --corpus <dir>` for:
 * 1. The valid base corpus -> asserts exit code 0.
 * 2. Every structural mutation -> asserts non-zero exit code (1) and expected rule ID.
 *
 * Spec: am-cm-checks-structural-lq0
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { TestLogger } from "../../../testing/log/logger.ts";
import { spanTextDigest } from "../../schemas/spans.ts";
import { type ContentFile, createBaseCorpus, mutateCorpus } from "./testFixtures.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const TEMP_BASE = "/Volumes/USBNVME16TB/temp_agent_space";
const logger = new TestLogger("content-structural-tests");

after(async () => {
  await logger.flush();
});

function writeCorpusToDisk(files: ContentFile[], targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    const rel = file.path.replace(/^content\//, "");
    const fullPath = join(targetDir, rel);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.text, "utf8");
  }
}

interface RunCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  diagnostics: any[];
}

function runBuildContentCli(corpusDir: string): RunCliResult {
  try {
    const stdout = execFileSync("bun", ["scripts/build-content.ts", "--corpus", corpusDir], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const diagnostics = stdout
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return { exitCode: 0, stdout, stderr: "", diagnostics };
  } catch (error: any) {
    const stdout = error.stdout?.toString() || "";
    const stderr = error.stderr?.toString() || "";
    const combined = `${stdout}\n${stderr}`;
    const diagnostics = combined
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return {
      exitCode: error.status ?? 1,
      stdout,
      stderr,
      diagnostics,
    };
  }
}

describe("Structural Compiler E2E CLI (`bun scripts/build-content.ts --corpus <dir>`)", () => {
  it("passes the valid base corpus with exit code 0", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-base-"));
    try {
      const base = createBaseCorpus();
      writeCorpusToDisk(base, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      logger.log({
        testId: "e2e-base-corpus-valid",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 0 ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "none",
          expectedRule: "none",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 0 ? "passed" : "failed",
        },
      });

      assert.equal(res.exitCode, 0);
      assert.ok(res.stdout.includes('"event":"content-compiled"'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. duplicate-id
  it("rejects duplicate-id with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-dup-id-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/source-blocks/test-paper/s1-p1.json",
          text: JSON.stringify({
            kind: "source-block",
            id: "s1-p1",
            paper: "test-paper",
            order: 2,
            locators: [{ pdfPageIndex: 1, printedPage: 891 }],
            revision: 1,
            status: {
              transcription: "reviewed",
              mathTranscription: "not-applicable",
              translation: "reviewed",
              review: "reviewed",
            },
            inlines: [{ kind: "text", text: "Dies ist der erste Satz. Dies ist der zweite Satz." }],
            sentenceSpans: [
              {
                id: "s1-p1-s1",
                span: { start: 0, end: 24, blockRevision: 1, textDigest: "dummy" },
              },
              {
                id: "s1-p1-s1",
                span: { start: 25, end: 50, blockRevision: 1, textDigest: "dummy" },
              },
            ],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "duplicate-id" || d.rule === "duplicate-id",
      );
      logger.log({
        testId: "e2e-duplicate-id",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "duplicate-sentence-id",
          expectedRule: "duplicate-id",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 2. missing-source-block
  it("rejects missing-source-block with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-missing-src-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/translation-units/test-paper/s9-p1.json",
          text: JSON.stringify({
            kind: "translation-unit",
            id: "s9-p1",
            paper: "test-paper",
            sourceRefs: [{ paper: "test-paper", id: "s9-p1" }],
            inlines: [{ kind: "text", text: "Missing source ref" }],
            translator: { name: "A. Translator", role: "translator" },
            lang: "en",
            revision: 1,
            reviewState: "reviewed",
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "missing-source-block" || d.rule === "missing-source-block",
      );
      logger.log({
        testId: "e2e-missing-source-block",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "translation-unit-to-missing-source-block",
          expectedRule: "missing-source-block",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 3. broken-alignment
  it("rejects broken-alignment with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-alignment-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/alignments/test-paper.json",
          text: JSON.stringify({
            kind: "alignment",
            id: "test-paper",
            paper: "test-paper",
            edges: [
              {
                source: {
                  paper: "test-paper",
                  blockId: "s1-p1",
                  sentenceId: "s1-p1-s1",
                  range: { start: 0, end: 999 },
                },
                target: { translationUnitId: "s1-p1-s1" },
              },
            ],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "broken-alignment" || d.rule === "broken-alignment",
      );
      logger.log({
        testId: "e2e-broken-alignment",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "alignment-range-overflow",
          expectedRule: "broken-alignment",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 4. dangling-citation
  it("rejects dangling-citation with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-citation-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/editorial-notes/test-paper/note-01.json",
          text: JSON.stringify({
            schemaVersion: 1,
            kind: "editorial-note",
            id: "note-01",
            paper: "test-paper",
            blockId: "s1",
            author: { name: "Historian", role: "author" },
            sourceSupport: [{ citationId: "pais-1982", role: "secondary" }],
            affectedIds: ["s1-p1"],
            reviewState: "reviewed",
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "dangling-citation" || d.rule === "dangling-citation",
      );
      logger.log({
        testId: "e2e-dangling-citation",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "undefined-citation-ref",
          expectedRule: "dangling-citation",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 5. impossible-date-order
  it("rejects impossible-date-order with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-dates-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/papers/test-paper.json",
          text: JSON.stringify({
            schemaVersion: 1,
            kind: "paper",
            id: "test-paper",
            slug: "test-paper",
            title: "Test Paper",
            citation: "cite-test-1905",
            status: "in-preparation",
            dates: [
              {
                type: "date-line",
                earliest: "1905-03-17",
                latest: "1905-03-17",
                precision: "day",
                source: "Bern",
                verifiedAt: "2026-01-01",
              },
              {
                type: "received",
                earliest: "1905-03-16",
                latest: "1905-03-16",
                precision: "day",
                source: "Annalen",
                verifiedAt: "2026-01-01",
              },
            ],
            orderedBlockIds: [
              "s1",
              "s1-p1",
              "s1-eq1",
              "s1-fn1",
              "closing-dateline",
              "closing-received",
            ],
            sections: [{ id: "s1", title: "Section 1", arguments: ["arg-tp-01"] }],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "impossible-date-order" || d.rule === "impossible-date-order",
      );
      logger.log({
        testId: "e2e-impossible-date-order",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "received-before-dateline",
          expectedRule: "impossible-date-order",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 6. equation-not-identical
  it("rejects equation-not-identical with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-eq-diff-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/translation-units/test-paper/s1-eq1.json",
          text: JSON.stringify({
            kind: "translation-unit",
            id: "s1-eq1",
            paper: "test-paper",
            sourceRefs: [{ paper: "test-paper", id: "s1-eq1" }],
            inlines: [{ kind: "math", latex: "E = m c^2 " }],
            latex: "E = m c^2 ",
            translator: { name: "A. Translator", role: "translator" },
            lang: "en",
            revision: 1,
            reviewState: "reviewed",
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "equation-not-identical" || d.rule === "equation-not-identical",
      );
      logger.log({
        testId: "e2e-equation-not-identical",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "english-equation-extra-space",
          expectedRule: "equation-not-identical",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 7. complete-while-missing
  it("rejects complete-while-missing with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-complete-missing-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/papers/test-paper.json",
          text: JSON.stringify({
            schemaVersion: 1,
            kind: "paper",
            id: "test-paper",
            slug: "test-paper",
            title: "Test Paper",
            citation: "cite-test-1905",
            status: "complete",
            dates: [
              {
                type: "date-line",
                earliest: "1905-05-01",
                latest: "1905-05-31",
                precision: "month",
                source: "Bern",
                verifiedAt: "2026-01-01",
              },
              {
                type: "received",
                earliest: "1905-05-11",
                latest: "1905-05-11",
                precision: "day",
                source: "Annalen",
                verifiedAt: "2026-01-01",
              },
            ],
            orderedBlockIds: [
              "s1",
              "s1-p1",
              "s1-eq1",
              "s1-fn1",
              "closing-dateline",
              "closing-received",
            ],
            sections: [{ id: "s1", title: "Section 1", arguments: ["arg-tp-01"] }],
          }),
        },
        {
          path: "content/translation-units/test-paper/s1-p1-s1.json",
          text: JSON.stringify({
            kind: "translation-unit",
            id: "s1-p1-s1",
            paper: "test-paper",
            sourceRefs: [{ paper: "test-paper", id: "s1-p1-s1" }],
            inlines: [{ kind: "text", text: "Draft text." }],
            translator: { name: "A. Translator", role: "translator" },
            lang: "en",
            revision: 1,
            reviewState: "machine-draft",
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "complete-while-missing" || d.rule === "complete-while-missing",
      );
      logger.log({
        testId: "e2e-complete-while-missing",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "complete-paper-with-machine-draft",
          expectedRule: "complete-while-missing",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 8. hero-quote-unresolved
  it("rejects hero-quote-unresolved with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-hero-quote-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/arguments/test-paper/arg-tp-01.json",
          text: JSON.stringify({
            schemaVersion: 1,
            kind: "argument",
            id: "arg-tp-01",
            paper: "test-paper",
            section: "s1",
            title: "Test Argument",
            thesis: "First premise of test paper",
            claim: "First premise claim",
            citations: ["cite-test-1905"],
            prerequisites: [],
            help: {},
            readings: {
              overview: [],
              full: [],
              steps: [],
              margin: [],
            },
            heroQuote: {
              anchor: "s1-p1-s1",
              lang: "de",
              quote: "Dies ist der falsche Satz.",
            },
            experiments: [],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "hero-quote-unresolved" || d.rule === "hero-quote-unresolved",
      );
      logger.log({
        testId: "e2e-hero-quote-unresolved",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "altered-hero-quote",
          expectedRule: "hero-quote-unresolved",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 9. ledger-marker-in-edition
  it("rejects ledger-marker-in-edition with exit code 1", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-ledger-marker-"));
    try {
      const base = createBaseCorpus();
      const mutated = mutateCorpus(base, [
        {
          path: "content/source-blocks/test-paper/s1.json",
          text: JSON.stringify({
            kind: "source-block",
            id: "s1",
            paper: "test-paper",
            order: 1,
            locators: [{ pdfPageIndex: 1, printedPage: 891 }],
            revision: 1,
            status: {
              transcription: "reviewed",
              mathTranscription: "not-applicable",
              translation: "reviewed",
              review: "reviewed",
            },
            inlines: [
              {
                kind: "text",
                text: "1. Kinematischer Teil --- REVIEWED TRANSCRIPTION PAGE 1 OF 10 ---",
              },
            ],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const res = runBuildContentCli(tempDir);
      const durationMs = performance.now() - start;

      const hasRule = res.diagnostics.some(
        (d) => d.code === "ledger-marker-in-edition" || d.rule === "ledger-marker-in-edition",
      );
      logger.log({
        testId: "e2e-ledger-marker-in-edition",
        beadId: "am-cm-checks-structural-lq0",
        outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "leaked-ledger-marker",
          expectedRule: "ledger-marker-in-edition",
          actualRules: res.diagnostics.map((d) => d.code ?? d.rule),
          outcome: res.exitCode === 1 && hasRule ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });

      assert.equal(res.exitCode, 1);
      assert.equal(hasRule, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 10. span-digest-mismatch
  it("rejects span-digest-mismatch with exit code 1, and passes once repaired", () => {
    const start = performance.now();
    const tempDir = mkdtempSync(join(TEMP_BASE, "am-e2e-digest-mismatch-"));
    try {
      const base = createBaseCorpus();
      const oldText = "Dies ist der erste deutsche Satz. Dies ist der zweite deutsche Satz.";
      const oldDigest = spanTextDigest(oldText);
      const editedText =
        "Dies ist der geänderte erste deutsche Satz. Dies ist der zweite deutsche Satz.";
      const s1Text = "Dies ist der geänderte erste deutsche Satz.";

      const mutated = mutateCorpus(base, [
        {
          path: "content/source-blocks/test-paper/s1-p1.json",
          text: JSON.stringify({
            kind: "source-block",
            id: "s1-p1",
            paper: "test-paper",
            order: 2,
            locators: [{ pdfPageIndex: 1, printedPage: 891 }],
            revision: 1,
            status: {
              transcription: "reviewed",
              mathTranscription: "not-applicable",
              translation: "reviewed",
              review: "reviewed",
            },
            inlines: [{ kind: "text", text: editedText }],
            sentenceSpans: [
              {
                id: "s1-p1-s1",
                span: { start: 0, end: s1Text.length, blockRevision: 1, textDigest: oldDigest },
              },
              {
                id: "s1-p1-s2",
                span: {
                  start: s1Text.length + 1,
                  end: editedText.length,
                  blockRevision: 1,
                  textDigest: oldDigest,
                },
              },
            ],
          }),
        },
      ]);
      writeCorpusToDisk(mutated, tempDir);

      const resFail = runBuildContentCli(tempDir);
      const hasRule = resFail.diagnostics.some(
        (d) => d.code === "span-digest-mismatch" || d.rule === "span-digest-mismatch",
      );
      assert.equal(resFail.exitCode, 1);
      assert.equal(hasRule, true);

      // Now repair: re-measure spans with true digest and bump blockRevision
      const trueDigest = spanTextDigest(editedText);
      const repaired = mutateCorpus(mutated, [
        {
          path: "content/source-blocks/test-paper/s1-p1.json",
          text: JSON.stringify({
            kind: "source-block",
            id: "s1-p1",
            paper: "test-paper",
            order: 2,
            locators: [{ pdfPageIndex: 1, printedPage: 891 }],
            revision: 2,
            status: {
              transcription: "reviewed",
              mathTranscription: "not-applicable",
              translation: "reviewed",
              review: "reviewed",
            },
            inlines: [{ kind: "text", text: editedText }],
            sentenceSpans: [
              {
                id: "s1-p1-s1",
                span: { start: 0, end: s1Text.length, blockRevision: 2, textDigest: trueDigest },
              },
              {
                id: "s1-p1-s2",
                span: {
                  start: s1Text.length + 1,
                  end: editedText.length,
                  blockRevision: 2,
                  textDigest: trueDigest,
                },
              },
            ],
          }),
        },
      ]);
      writeCorpusToDisk(repaired, tempDir);

      const resPass = runBuildContentCli(tempDir);
      assert.equal(resPass.exitCode, 0);

      const durationMs = performance.now() - start;
      logger.log({
        testId: "e2e-span-digest-mismatch",
        beadId: "am-cm-checks-structural-lq0",
        outcome: resFail.exitCode === 1 && resPass.exitCode === 0 ? "passed" : "failed",
        durationMs,
        extra: {
          mutation: "stale-text-digest",
          expectedRule: "span-digest-mismatch",
          actualRules: resFail.diagnostics.map((d) => d.code ?? d.rule),
          outcome: resFail.exitCode === 1 && resPass.exitCode === 0 ? "passed" : "failed",
          mutatedFixturePath: tempDir,
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
