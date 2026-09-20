import assert from "node:assert";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  FixtureAdapter,
  SYNTHETIC_FIXTURE_BANNER,
  syntheticFixtureDraft,
} from "./ocr-adapters/fixture-adapter.ts";
import { loadAdapter } from "./ocr-adapters/loader.ts";
import { OcrRefusalError } from "./ocr-adapters/types.ts";
import {
  loadPlan,
  planChunks,
  probePdftoppm,
  redact,
  renderPages,
  resumeRun,
  runOcrOrchestrator,
  syntheticPageRenderer,
  validatePlan,
} from "./ocr-ledgers.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SYNTHETIC_RENDER = { customRenderer: syntheticPageRenderer };

describe("OCR Orchestrator: Unit and Integration Tests", () => {
  describe("Chunk Planning", () => {
    it("computes exact ceiling chunk counts and contiguous non-overlapping ranges for 3, 12, 17, and 31 pages with chunk sizes 1 to 4", () => {
      // 3 pages [1, 3] with size 2 -> 2 chunks: [1,2], [3]
      const c3_2 = planChunks([1, 3], 2);
      assert.equal(c3_2.length, 2);
      assert.deepEqual(c3_2[0]?.pdfPages, [1, 2]);
      assert.deepEqual(c3_2[1]?.pdfPages, [3]);

      // 12 pages [1, 12] with size 3 -> 4 chunks: [1,2,3], [4,5,6], [7,8,9], [10,11,12]
      const c12_3 = planChunks([1, 12], 3);
      assert.equal(c12_3.length, 4);
      assert.deepEqual(c12_3[0]?.pdfPages, [1, 2, 3]);
      assert.deepEqual(c12_3[3]?.pdfPages, [10, 11, 12]);

      // 17 pages [1, 17] with size 4 -> 5 chunks
      const c17_4 = planChunks([1, 17], 4);
      assert.equal(c17_4.length, 5);
      assert.deepEqual(c17_4[0]?.pdfPages, [1, 2, 3, 4]);
      assert.deepEqual(c17_4[4]?.pdfPages, [17]);

      // 31 pages [1, 31] with size 2 -> 16 chunks, last holding 1 page
      const c31_2 = planChunks([1, 31], 2);
      assert.equal(c31_2.length, 16);
      assert.deepEqual(c31_2[0]?.pdfPages, [1, 2]);
      assert.deepEqual(c31_2[14]?.pdfPages, [29, 30]);
      assert.deepEqual(c31_2[15]?.pdfPages, [31]);

      // Verify all pages are contiguous and none overlap
      for (const chunks of [c3_2, c12_3, c17_4, c31_2]) {
        let lastPage = 0;
        for (const chunk of chunks) {
          assert.ok(chunk.pdfPages.length > 0);
          for (const p of chunk.pdfPages) {
            assert.equal(p, lastPage + 1, "Pages must be contiguous without gaps or overlaps");
            lastPage = p;
          }
        }
      }
    });
  });

  describe("Refusals and Validations", () => {
    const basePlan = {
      planVersion: 1,
      key: "fixture-3p",
      facsimilePath: "src/testing/fixtures/ocr/fixture-3p.pdf",
      facsimileSha256: "11a902fa8ec62604854f9c8e045da0d5eadc52b6f1f2592e00e762645319354f",
      pdfPageRange: [1, 3],
      chunkSize: 2,
      maxConcurrency: 1,
      cloudProcessing: "permitted",
      cloudProcessingBasisRef: "Section 2.1",
      render: { dpi: 300, format: "png" },
      instructionsVersion: "v1",
      expectedWorkerIdentity: "gpt-5.6-luna",
    };

    it("refuses chunk size > 4 with CHUNK_TOO_LARGE", () => {
      const res = validatePlan({ ...basePlan, chunkSize: 5 });
      assert.equal(res.valid, false);
      assert.equal(res.refusalCode, "CHUNK_TOO_LARGE");
    });

    it("refuses concurrency > 2 with CONCURRENCY_TOO_HIGH", () => {
      const res = validatePlan({ ...basePlan, maxConcurrency: 3 });
      assert.equal(res.valid, false);
      assert.equal(res.refusalCode, "CONCURRENCY_TOO_HIGH");
    });

    it("refuses facsimile digest differing in one hex character with FACSIMILE_DIGEST_MISMATCH", () => {
      const corruptedSha = "21a902fa8ec62604854f9c8e045da0d5eadc52b6f1f2592e00e762645319354f";
      const res = validatePlan(
        { ...basePlan, facsimileSha256: corruptedSha },
        { pinnedDigest: basePlan.facsimileSha256 },
      );
      assert.equal(res.valid, false);
      assert.equal(res.refusalCode, "FACSIMILE_DIGEST_MISMATCH");
    });

    it("refuses page ranges [0, 2] and [30, 32] on a 31-page fixture with PAGE_RANGE_OUT_OF_BOUNDS", () => {
      const res0_2 = validatePlan({ ...basePlan, pdfPageRange: [0, 2] }, { totalPdfPages: 31 });
      assert.equal(res0_2.valid, false);
      assert.equal(res0_2.refusalCode, "PAGE_RANGE_OUT_OF_BOUNDS");

      const res30_32 = validatePlan({ ...basePlan, pdfPageRange: [30, 32] }, { totalPdfPages: 31 });
      assert.equal(res30_32.valid, false);
      assert.equal(res30_32.refusalCode, "PAGE_RANGE_OUT_OF_BOUNDS");
    });

    it("refuses a plan naming two keys with MULTI_SOURCE_PLAN", () => {
      const res = validatePlan({ ...basePlan, keys: ["fixture-3p", "fixture-31p"] });
      assert.equal(res.valid, false);
      assert.equal(res.refusalCode, "MULTI_SOURCE_PLAN");
    });

    it("refuses cloudProcessing 'unknown' and 'forbidden' with CLOUD_PROCESSING_NOT_PERMITTED", () => {
      const resUnknown = validatePlan({ ...basePlan, cloudProcessing: "unknown" });
      assert.equal(resUnknown.valid, false);
      assert.equal(resUnknown.refusalCode, "CLOUD_PROCESSING_NOT_PERMITTED");

      const resForbidden = validatePlan({ ...basePlan, cloudProcessing: "forbidden" });
      assert.equal(resForbidden.valid, false);
      assert.equal(resForbidden.refusalCode, "CLOUD_PROCESSING_NOT_PERMITTED");
    });

    it("refuses when no adapter is configured with NO_ADAPTER", () => {
      assert.throws(
        () => loadAdapter(undefined),
        (err: any) => err instanceof OcrRefusalError && err.refusalCode === "NO_ADAPTER",
      );
    });

    it("refuses adapter name 'local-tesseract' with FORBIDDEN_ADAPTER_NAME", () => {
      assert.throws(
        () => loadAdapter("local-tesseract"),
        (err: any) =>
          err instanceof OcrRefusalError && err.refusalCode === "FORBIDDEN_ADAPTER_NAME",
      );
    });

    it("refuses any local OCR engine adapter name with typed FORBIDDEN_ADAPTER_NAME", () => {
      const forbiddenNames = [
        "local",
        "local-ocr",
        "tesseract",
        "local-tesseract",
        "ocrmypdf",
        "focr",
        "easyocr",
        "paddleocr",
        "pix2tex",
        "latex-ocr",
        "surya",
        "kraken",
        "doctr",
        "rapidocr",
        "ollama",
        "llava",
        "llama.cpp",
      ];
      for (const name of forbiddenNames) {
        assert.throws(
          () => loadAdapter(name),
          (err: any) =>
            err instanceof OcrRefusalError &&
            err.refusalCode === "FORBIDDEN_ADAPTER_NAME" &&
            err.message.includes("matches a forbidden local recognition tool"),
          `Expected FORBIDDEN_ADAPTER_NAME refusal for "${name}"`,
        );
      }
    });

    it("refuses fixture adapter when NODE_ENV=production with FIXTURE_ADAPTER_OUTSIDE_TEST", () => {
      assert.throws(
        () => loadAdapter("fixture", { nodeEnv: "production" }),
        (err: any) =>
          err instanceof OcrRefusalError && err.refusalCode === "FIXTURE_ADAPTER_OUTSIDE_TEST",
      );
    });

    it("refuses fixture adapter when NODE_ENV is development or unset", () => {
      assert.throws(
        () => loadAdapter("fixture", { nodeEnv: "development" }),
        (err: any) =>
          err instanceof OcrRefusalError && err.refusalCode === "FIXTURE_ADAPTER_OUTSIDE_TEST",
      );
      assert.throws(
        () => loadAdapter({ adapterName: "fixture", nodeEnv: "" }),
        (err: any) =>
          err instanceof OcrRefusalError && err.refusalCode === "FIXTURE_ADAPTER_OUTSIDE_TEST",
      );
    });

    it("loads the fixture adapter only when NODE_ENV=test", () => {
      const adapter = loadAdapter("fixture", { nodeEnv: "test" });
      assert.equal(adapter.name, "fixture");
    });

    it("refuses worker identity that differs from the plan with WORKER_IDENTITY_MISMATCH", async () => {
      const adapter = new FixtureAdapter({ workerIdentity: "unauthorized-worker-identity" });
      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";

      await assert.rejects(
        async () => {
          await runOcrOrchestrator({
            planPath,
            adapter,
            renderOptions: SYNTHETIC_RENDER,
          });
        },
        (err: any) =>
          err instanceof OcrRefusalError && err.refusalCode === "WORKER_IDENTITY_MISMATCH",
      );
    });
  });

  describe("Rendering", () => {
    it("refuses with RENDERER_UNAVAILABLE when pdftoppm is not on PATH", async () => {
      const outputDir = resolve(ROOT, "artifacts/test-runs/render-missing-binary");
      await assert.rejects(
        () =>
          renderPages("src/testing/fixtures/ocr/fixture-3p.pdf", [1, 2, 3], outputDir, {
            dpi: 300,
            pdftoppmCommand: "pdftoppm-not-on-path-for-test",
          }),
        (err: unknown) =>
          err instanceof OcrRefusalError &&
          err.refusalCode === "RENDERER_UNAVAILABLE" &&
          err.message.includes("renderer step refused") &&
          !err.message.includes("ENOENT"),
      );
    });

    it("renders the 3-page fixture with pdftoppm when present, or names the refusal when absent", async () => {
      const outputDir = resolve(ROOT, "artifacts/test-runs/render-test");
      const probe = await probePdftoppm();
      if (!probe.available) {
        await assert.rejects(
          () =>
            renderPages("src/testing/fixtures/ocr/fixture-3p.pdf", [1, 2, 3], outputDir, {
              dpi: 300,
            }),
          (err: unknown) =>
            err instanceof OcrRefusalError && err.refusalCode === "RENDERER_UNAVAILABLE",
        );
        return;
      }

      const rendered = await renderPages(
        "src/testing/fixtures/ocr/fixture-3p.pdf",
        [1, 2, 3],
        outputDir,
        { dpi: 300 },
      );

      assert.equal(rendered.length, 3);
      for (let i = 0; i < 3; i++) {
        const item = rendered[i];
        assert.ok(item);
        assert.equal(item.pdfPage, i + 1);
        assert.equal(item.dpi, 300);
        assert.equal(item.width, 2550);
        assert.equal(item.height, 3300);
        assert.ok(item.imageSha256.length === 64);
        assert.equal(item.renderer, "pdftoppm");
        assert.ok(item.rendererVersion.length > 0);
        assert.ok(existsSync(item.imagePath));
      }
    });
  });

  describe("Outage Handling and Checkpoint Preservation", () => {
    it("preserves chunks 0 and 1 on disk, returns paused state, and formats pause bead comment when adapter reports ADAPTER_UNAVAILABLE at chunk 2", async () => {
      const toolRunId = `test-outage-${Date.now()}`;
      const adapter = new FixtureAdapter({
        failAtChunkIndex: 2,
        failWithCode: "ADAPTER_UNAVAILABLE",
      });

      const planPath = "scripts/sources/ocr-plans/fixture-31p.yaml";
      const result = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(result.ok, false);
      assert.equal(result.paused, true);
      assert.ok(result.pauseComment?.includes("RUST_LOG=error br comments add"));
      assert.ok(result.pauseComment?.includes("PAUSED: OCR cloud adapter unavailable at chunk 2"));

      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-31p", toolRunId);
      // Chunks 0 and 1 have pages 1, 2 and 3, 4
      assert.ok(existsSync(resolve(runDir, "pages/page-1.md")));
      assert.ok(existsSync(resolve(runDir, "pages/page-2.md")));
      assert.ok(existsSync(resolve(runDir, "pages/page-3.md")));
      assert.ok(existsSync(resolve(runDir, "pages/page-4.md")));
      assert.ok(!existsSync(resolve(runDir, "pages/page-5.md")));
    });
  });

  describe("Checkpoint and Resume", () => {
    it("resumes an interrupted run at chunk 2 into same toolRunId with a new logRunId, without resubmitting chunks 0 and 1", async () => {
      const toolRunId = `test-resume-${Date.now()}`;
      const adapter1 = new FixtureAdapter({
        failAtChunkIndex: 2,
        failWithCode: "ADAPTER_UNAVAILABLE",
      });

      const planPath = "scripts/sources/ocr-plans/fixture-31p.yaml";
      // First attempt (fails at chunk 2)
      const res1 = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter: adapter1,
        renderOptions: SYNTHETIC_RENDER,
      });
      assert.equal(res1.ok, false);
      assert.equal(adapter1.getSubmissionCount(0), 1);
      assert.equal(adapter1.getSubmissionCount(1), 1);

      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-31p", toolRunId);
      const page1Path = resolve(runDir, "pages/page-1.md");
      const page1AfterFirst = await readFile(page1Path, "utf-8");

      // Second attempt: resume with working adapter
      const adapter2 = new FixtureAdapter();
      const res2 = await runOcrOrchestrator({
        planPath,
        resumeToolRunId: toolRunId,
        adapter: adapter2,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(res2.ok, true);
      assert.equal(res2.toolRunId, toolRunId);
      assert.notEqual(res2.logRunId, res1.logRunId);
      // Chunks 0 and 1 should NOT be submitted to adapter2
      assert.equal(adapter2.getSubmissionCount(0), 0);
      assert.equal(adapter2.getSubmissionCount(1), 0);
      // Chunk 2 and subsequent should be submitted
      assert.equal(adapter2.getSubmissionCount(2), 1);

      const page1AfterResume = await readFile(page1Path, "utf-8");
      assert.equal(
        page1AfterResume,
        page1AfterFirst,
        "Resume must not rewrite a page it already wrote",
      );
      assert.ok(existsSync(resolve(runDir, "RESEARCH_EVIDENCE_ONLY")));
    });

    it("a 400-page run interrupted after page 300 resumes at page 301 and does not mark 301 complete", async () => {
      const digest = "ab".repeat(32);
      const plan = {
        planVersion: 1 as const,
        key: "fixture-400",
        facsimilePath: "src/testing/fixtures/ocr/fixture-3p.pdf",
        facsimileSha256: digest,
        pdfPageRange: [1, 400] as [number, number],
        chunkSize: 1,
        maxConcurrency: 1,
        cloudProcessing: "permitted" as const,
        cloudProcessingBasisRef: "test",
        render: { dpi: 300, format: "png" as const },
        instructionsVersion: "v1",
        expectedWorkerIdentity: "gpt-5.6-luna",
      };
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-400", `resume-301-${Date.now()}`);
      const pagesDir = resolve(runDir, "pages");
      await mkdir(pagesDir, { recursive: true });

      for (let page = 1; page <= 300; page++) {
        const body = syntheticFixtureDraft(page, plan.key);
        const textSha256 = createHash("sha256").update(body).digest("hex");
        const content =
          [
            "---",
            `key: ${plan.key}`,
            `pdfPage: ${page}`,
            `facsimileSha256: ${digest}`,
            `toolRunId: resume-301`,
            `logRunId: process-1`,
            `chunkIndex: ${page - 1}`,
            `jobId: fixture-job-${page}`,
            `adapter: fixture`,
            `workerIdentity: gpt-5.6-luna`,
            `model: gpt-5.6-luna-2026-03-01`,
            `instructionsVersion: v1`,
            `imageSha256: ${"cd".repeat(32)}`,
            `textSha256: ${textSha256}`,
            `receivedAt: 2026-09-17T00:00:00.000Z`,
            "---",
            "",
          ].join("\n") + body;
        await writeFile(resolve(pagesDir, `page-${page}.md`), content);
      }

      const resumeState = await resumeRun(runDir, plan, { adapterName: "fixture" });
      assert.equal(resumeState.completedChunkIndices.size, 300);
      assert.ok(resumeState.completedChunkIndices.has(299), "chunk for page 300 is complete");
      assert.ok(!resumeState.completedChunkIndices.has(300), "chunk for page 301 is not complete");
      assert.ok(!resumeState.existingPages.has(301));
    });

    it("resubmits an incomplete chunk if a page body no longer matches textSha256", async () => {
      const toolRunId = `test-tamper-${Date.now()}`;
      const adapter = new FixtureAdapter();
      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";

      // Initial run
      const res1 = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });
      assert.equal(res1.ok, true);

      // Tamper with page-1.md body
      const page1Path = resolve(
        ROOT,
        "artifacts/ocr-runs/fixture-3p",
        toolRunId,
        "pages/page-1.md",
      );
      const content = await readFile(page1Path, "utf-8");
      await writeFile(page1Path, `${content}\n[TAMPERED CONTENT]`);

      // Resume check
      const plan = await loadPlan(planPath);
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-3p", toolRunId);
      const resumeState = await resumeRun(runDir, plan);

      // Chunk 0 (holding page 1 and 2) must be incomplete
      assert.ok(
        !resumeState.completedChunkIndices.has(0),
        "Chunk 0 should be marked incomplete due to digest mismatch",
      );
      // Chunk 1 (holding page 3) must remain complete
      assert.ok(resumeState.completedChunkIndices.has(1), "Chunk 1 should remain complete");
    });
  });

  describe("Retries", () => {
    it("records two retries when two timeouts occur before success", async () => {
      const toolRunId = `test-retry-timeout-${Date.now()}`;
      const adapter = new FixtureAdapter({
        failAtChunkIndex: 0,
        timeoutsBeforeSuccess: 2,
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(res.ok, true);
      assert.ok(res.summary);
      assert.equal(res.summary.retries, 2, "Expected 2 retries logged in summary");
    });

    it("records zero retries on authentication failure", async () => {
      const toolRunId = `test-retry-auth-${Date.now()}`;
      const adapter = new FixtureAdapter({
        failAtChunkIndex: 0,
        failWithCode: "ADAPTER_AUTH",
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(res.ok, false);
      assert.equal(res.paused, true);
      // Adapter auth fails immediately without retrying
      assert.equal(adapter.getSubmissionCount(0), 1);
    });
  });

  describe("Summary and Coverage", () => {
    it("generates summary, coverage, and flags expectedCounts mismatches in coverage.json", async () => {
      const toolRunId = `test-summary-${Date.now()}`;
      // Custom page text with NO math region to trigger mismatch against expectedCounts (displayEquations: 1)
      const adapter = new FixtureAdapter({
        customPageText: {
          1: "[[RUNNING-HEAD Test]]\n[[PAGE-NUMBER 1]]\nText without math region.",
        },
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(res.ok, true);
      assert.ok(res.summary);
      assert.ok(res.coverage);
      assert.ok(res.receiptBlock);

      assert.equal(res.summary.toolRunId, toolRunId);
      assert.equal(res.summary.key, "fixture-3p");
      assert.ok(res.summary.jobIds.length > 0);
      assert.deepEqual(res.summary.pageRanges, [1, 3]);

      // Coverage should flag page 1 as mismatch
      const page1Coverage = res.coverage.pages.find((p) => p.pdfPage === 1);
      assert.ok(page1Coverage);
      assert.equal(page1Coverage.mismatch, true);
      assert.ok(res.coverage.mismatches.length > 0);
      const mathMismatch = res.coverage.mismatches.find(
        (m) => m.pdfPage === 1 && m.field === "displayEquations",
      );
      assert.ok(mathMismatch);
      assert.equal(mathMismatch.actual, 0);
      assert.equal(mathMismatch.expected, 1);
    });
  });

  describe("Redaction and Secrets Safety", () => {
    it("redacts environment variable secrets and authorization headers from error messages and logs", () => {
      const secretToken = "super-secret-token-xyz-12345";
      const mockEnv = {
        LUNA_API_KEY: secretToken,
        SOME_OTHER_VAR: "regular-value",
      };

      const rawMessage = `Error contacting Luna service with API key ${secretToken} and header Authorization: Bearer ${secretToken}`;
      const redacted = redact(rawMessage, mockEnv);

      assert.ok(!redacted.includes(secretToken), "Redacted text must not contain raw secret token");
      assert.ok(redacted.includes("[REDACTED]"));
    });
  });

  describe("Synthetic fixtures are not source text", () => {
    it("fixture drafts carry a synthetic banner and do not quote Einstein or the Annalen", () => {
      const draft = syntheticFixtureDraft(12, "fixture-31p");
      assert.ok(draft.includes(SYNTHETIC_FIXTURE_BANNER));
      assert.ok(draft.includes("[[SYNTHETIC-FIXTURE"));
      assert.ok(!draft.includes("Einstein"));
      assert.ok(!draft.includes("Annalen"));
      assert.ok(!draft.includes("molekularkinetischen"));
      assert.ok(!draft.includes("Elektrodynamik"));
    });
  });

  describe("Versioned Instructions and Ledger Markup Compliance", () => {
    function validateInstructionMarkup(content: string): { valid: boolean; missing: string[] } {
      const requiredMarkers = [
        "[[SPERR]]",
        "[[/SPERR]]",
        "[[FN-MARK",
        "[[FN ",
        "[[RUNNING-HEAD",
        "[[PAGE-NUMBER",
        "[[MATH-REGION",
        "[[ILLEGIBLE]]",
      ];
      const missing = requiredMarkers.filter((marker) => !content.includes(marker));
      return { valid: missing.length === 0, missing };
    }

    it("verifies scripts/sources/ocr-instructions/v1.md exists, is versioned, and specifies all mandatory ledger markup tags", async () => {
      const v1Path = resolve(ROOT, "scripts/sources/ocr-instructions/v1.md");
      assert.ok(existsSync(v1Path), "v1.md instruction file must exist");
      const content = await readFile(v1Path, "utf-8");

      assert.ok(content.length > 200, "Instruction text must be substantive");
      assert.ok(content.includes("Annus Mirabilis OCR Instructions (v1)"));

      const validation = validateInstructionMarkup(content);
      assert.equal(
        validation.valid,
        true,
        `Missing required markup tags in v1.md: ${validation.missing.join(", ")}`,
      );
      assert.equal(validation.missing.length, 0);

      // Diplomatic German orthography preservation
      assert.ok(content.includes("daß"), "Must mention preserving archaic spelling like 'daß'");
      assert.ok(content.includes("giebt"), "Must mention preserving archaic spelling like 'giebt'");
      assert.ok(content.includes("Do NOT modernize spelling"), "Must forbid modernizing spelling");
      assert.ok(
        content.includes(
          "Do NOT translate, summarize, normalize, paraphrase, or complete missing words",
        ),
        "Must forbid semantic mutation",
      );
    });

    it("planted negative: markup validator rejects instruction text missing mandatory tags (fails in BOTH directions)", () => {
      const incompleteInstructions = `
# Incomplete instructions
Transcribe text. Mark emphasis with *bold*.
Use [[MATH-REGION page=1]] for equations.
`;
      const result = validateInstructionMarkup(incompleteInstructions);
      assert.equal(result.valid, false);
      assert.ok(result.missing.includes("[[SPERR]]"));
      assert.ok(result.missing.includes("[[FN-MARK"));
      assert.ok(result.missing.includes("[[ILLEGIBLE]]"));

      const wellFormedInstructions = `
Mark with [[SPERR]] and [[/SPERR]].
Use [[FN-MARK 1]] and [[FN 1]] note.
Include [[RUNNING-HEAD title]] and [[PAGE-NUMBER 42]].
Use [[MATH-REGION page=1]] and [[ILLEGIBLE]] when damaged.
`;
      const resultGood = validateInstructionMarkup(wellFormedInstructions);
      assert.equal(resultGood.valid, true);
      assert.equal(resultGood.missing.length, 0);
    });
  });

  describe("Artifact Identification: toolRunId and logRunId only, never runId", () => {
    it("guarantees no artifact (frontmatter, run.jsonl, summary.json, coverage.json, receipt-block.md) contains a 'runId' key", async () => {
      const toolRunId = `test-no-runid-${Date.now()}`;
      const adapter = new FixtureAdapter();
      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";

      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter,
        renderOptions: SYNTHETIC_RENDER,
      });

      assert.equal(res.ok, true);
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-3p", toolRunId);

      // 1. Check run.jsonl entries
      const runLogPath = resolve(runDir, "run.jsonl");
      assert.ok(existsSync(runLogPath));
      const logLines = (await readFile(runLogPath, "utf-8")).trim().split("\n");
      for (const line of logLines) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        assert.equal("runId" in entry, false, "Log entry must not have runId property");
        assert.equal(typeof entry.toolRunId, "string");
        assert.equal(typeof entry.logRunId, "string");
      }

      // 2. Check summary.json
      const summaryPath = resolve(runDir, "summary.json");
      assert.ok(existsSync(summaryPath));
      const summaryObj = JSON.parse(await readFile(summaryPath, "utf-8"));
      assert.equal("runId" in summaryObj, false, "summary.json must not have runId property");
      assert.equal(typeof summaryObj.toolRunId, "string");

      // 3. Check coverage.json
      const coveragePath = resolve(runDir, "coverage.json");
      assert.ok(existsSync(coveragePath));
      const coverageObj = JSON.parse(await readFile(coveragePath, "utf-8"));
      assert.equal("runId" in coverageObj, false, "coverage.json must not have runId property");
      assert.equal(typeof coverageObj.toolRunId, "string");

      // 4. Check page markdown frontmatter
      for (let p = 1; p <= 3; p++) {
        const pagePath = resolve(runDir, `pages/page-${p}.md`);
        assert.ok(existsSync(pagePath));
        const content = await readFile(pagePath, "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        assert.ok(fmMatch);
        const fm = fmMatch[1] ?? "";
        assert.ok(fm.includes("toolRunId:"));
        assert.ok(fm.includes("logRunId:"));
        assert.ok(!fm.includes("runId:"));
      }

      // 5. Check receipt-block.md
      const receiptPath = resolve(runDir, "receipt-block.md");
      assert.ok(existsSync(receiptPath));
      const receiptText = await readFile(receiptPath, "utf-8");
      assert.ok(receiptText.includes("toolRunId:"));
      assert.ok(!receiptText.includes("runId:"));
    });

    it("planted negative: runId detector flags objects with runId and passes on clean objects (fails in BOTH directions)", () => {
      function checkForForbiddenRunId(obj: Record<string, unknown>): boolean {
        return "runId" in obj && obj.runId !== undefined;
      }

      const badObj = { toolRunId: "tool-123", logRunId: "log-456", runId: "forbidden-run-id" };
      assert.equal(
        checkForForbiddenRunId(badObj),
        true,
        "Detector must catch forbidden runId property",
      );

      const cleanObj = { toolRunId: "tool-123", logRunId: "log-456" };
      assert.equal(
        checkForForbiddenRunId(cleanObj),
        false,
        "Detector must pass clean object with only toolRunId and logRunId",
      );
    });
  });

  describe("Denylist Reason Integrity (AC 3)", () => {
    function validateDenylistReasons(
      entries: Array<{ pattern?: string; category?: string; reason?: string }>,
    ): { valid: boolean; failures: string[] } {
      const failures: string[] = [];
      for (const e of entries) {
        if (!e.pattern || e.pattern.trim().length === 0) {
          failures.push("Missing pattern");
        } else if (!e.category || e.category.trim().length === 0) {
          failures.push(`Missing category for ${e.pattern}`);
        } else if (!e.reason || e.reason.trim().length < 20) {
          failures.push(`Insufficient reason for ${e.pattern}`);
        }
      }
      return { valid: failures.length === 0, failures };
    }

    it("verifies every entry in scripts/ocr-guard-denylist.json has a valid pattern, category, and substantive reason", async () => {
      const denylistPath = resolve(ROOT, "scripts/ocr-guard-denylist.json");
      assert.ok(existsSync(denylistPath), "scripts/ocr-guard-denylist.json must exist");
      const config = JSON.parse(await readFile(denylistPath, "utf-8"));
      assert.equal(config.version, 1);
      assert.ok(Array.isArray(config.denylist));
      assert.ok(config.denylist.length >= 15);

      const result = validateDenylistReasons(config.denylist);
      assert.equal(result.valid, true, `Denylist validation failed: ${result.failures.join(", ")}`);
      assert.equal(result.failures.length, 0);
    });

    it("planted negative: denylist reason validator flags entries with missing or inadequate reasons (fails in BOTH directions)", () => {
      const invalidEntries = [
        { pattern: "tesseract", category: "binary", reason: "forbidden" }, // reason < 20 chars
        { pattern: "focr", category: "binary" }, // missing reason
        { category: "binary", reason: "A sufficiently long reason for missing pattern" }, // missing pattern
      ];
      const badResult = validateDenylistReasons(invalidEntries);
      assert.equal(badResult.valid, false);
      assert.equal(badResult.failures.length, 3);

      const validEntries = [
        {
          pattern: "tesseract",
          category: "binary",
          reason: "Tesseract CLI is a local OCR engine forbidden by policy.",
        },
        {
          pattern: "focr",
          category: "binary",
          reason: "focr is a local OCR binary forbidden by repository resource policy.",
        },
      ];
      const goodResult = validateDenylistReasons(validEntries);
      assert.equal(goodResult.valid, true);
      assert.equal(goodResult.failures.length, 0);
    });
  });

  describe("Hard Resource Policy Documentation (AC 8)", () => {
    function validatePolicyDocumentation(content: string): {
      valid: boolean;
      missingClauses: string[];
    } {
      const normalized = content
        .replace(/\s*\*\s*/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase();
      const requiredClauses = [
        "hard resource policy",
        "never run ocr on this machine",
        "delegate every ocr or machine-transcription job to a cloud gpt-5.6 luna worker",
        "do not install, invoke, benchmark, resume, or monitor a local ocr engine",
        "do not use local cpu, gpu, npu, or memory for ocr",
        "if a luna worker or the cloud execution path is unavailable, pause the ocr",
        "do not fall back to local ocr",
        "bounded, checkpointed page ranges",
        "cloud ocr output is research evidence only",
      ];
      const missingClauses = requiredClauses.filter((clause) => !normalized.includes(clause));
      return { valid: missingClauses.length === 0, missingClauses };
    }

    it("verifies documentation at top of scripts/ocr-ledgers.ts restates hard resource policy", async () => {
      const scriptPath = resolve(ROOT, "scripts/ocr-ledgers.ts");
      const content = await readFile(scriptPath, "utf-8");

      // Verify the top comment block
      const topCommentMatch = content.match(/^#!\/usr\/bin\/env bun\s*\n\/\*\*([\s\S]*?)\*\//);
      assert.ok(topCommentMatch, "Top docblock comment must exist at line 3");
      const topComment = topCommentMatch[1] ?? "";

      const validation = validatePolicyDocumentation(topComment);
      assert.equal(
        validation.valid,
        true,
        `Missing hard resource policy clauses in top docblock: ${validation.missingClauses.join(", ")}`,
      );
      assert.equal(validation.missingClauses.length, 0);
    });

    it("planted negative: policy doc validator flags missing clauses and passes on complete text (fails in BOTH directions)", () => {
      const incompleteComment = `
        Annus Mirabilis: Cloud OCR Orchestrator
        Run cloud jobs here.
      `;
      const badResult = validatePolicyDocumentation(incompleteComment);
      assert.equal(badResult.valid, false);
      assert.ok(badResult.missingClauses.includes("never run ocr on this machine"));
      assert.ok(badResult.missingClauses.includes("do not fall back to local ocr"));
      assert.ok(badResult.missingClauses.includes("cloud ocr output is research evidence only"));

      const completeComment = `
        HARD RESOURCE POLICY (AGENTS.md)
        NEVER RUN OCR ON THIS MACHINE
        Delegate every OCR or machine-transcription job to a cloud GPT-5.6 Luna worker
        Do not install, invoke, benchmark, resume, or monitor a local OCR engine
        Do not use local CPU, GPU, NPU, or memory for OCR
        If a Luna worker or the cloud execution path is unavailable, pause the OCR
        Do not fall back to local OCR
        Bounded, checkpointed page ranges
        Cloud OCR output is research evidence only
      `;
      const goodResult = validatePolicyDocumentation(completeComment);
      assert.equal(goodResult.valid, true);
      assert.equal(goodResult.missingClauses.length, 0);
    });
  });
});
