import test, { describe, it } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  planChunks,
  validatePlan,
  loadPlan,
  renderPages,
  redact,
  generateToolRunId,
  generateLogRunId,
  resumeRun,
  summarizeRun,
  runOcrOrchestrator
} from "./ocr-ledgers.ts";
import { loadAdapter } from "./ocr-adapters/loader.ts";
import { FixtureAdapter } from "./ocr-adapters/fixture-adapter.ts";
import {
  OcrRefusalError,
  AdapterUnavailableError,
  AdapterAuthError,
  AdapterTimeoutError
} from "./ocr-adapters/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
      expectedWorkerIdentity: "gpt-5.6-luna"
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
        { pinnedDigest: basePlan.facsimileSha256 }
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
        (err: any) => err instanceof OcrRefusalError && err.refusalCode === "NO_ADAPTER"
      );
    });

    it("refuses adapter name 'local-tesseract' with FORBIDDEN_ADAPTER_NAME", () => {
      assert.throws(
        () => loadAdapter("local-tesseract"),
        (err: any) => err instanceof OcrRefusalError && err.refusalCode === "FORBIDDEN_ADAPTER_NAME"
      );
    });

    it("refuses fixture adapter when NODE_ENV=production with FIXTURE_ADAPTER_OUTSIDE_TEST", () => {
      assert.throws(
        () => loadAdapter("fixture", { nodeEnv: "production" }),
        (err: any) => err instanceof OcrRefusalError && err.refusalCode === "FIXTURE_ADAPTER_OUTSIDE_TEST"
      );
    });

    it("refuses worker identity that differs from the plan with WORKER_IDENTITY_MISMATCH", async () => {
      const adapter = new FixtureAdapter({ workerIdentity: "unauthorized-worker-identity" });
      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      
      await assert.rejects(
        async () => {
          await runOcrOrchestrator({
            planPath,
            adapter
          });
        },
        (err: any) => err instanceof OcrRefusalError && err.refusalCode === "WORKER_IDENTITY_MISMATCH"
      );
    });
  });

  describe("Rendering", () => {
    it("renders committed 3-page fixture PDF to three PNGs whose dimensions equal page boxes at 300 dpi (2550 x 3300) with renderer recorded", async () => {
      const outputDir = resolve(ROOT, "artifacts/test-runs/render-test");
      const rendered = await renderPages("src/testing/fixtures/ocr/fixture-3p.pdf", [1, 2, 3], outputDir, { dpi: 300 });

      assert.equal(rendered.length, 3);
      for (let i = 0; i < 3; i++) {
        const item = rendered[i]!;
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
        failWithCode: "ADAPTER_UNAVAILABLE"
      });

      const planPath = "scripts/sources/ocr-plans/fixture-31p.yaml";
      const result = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter
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
        failWithCode: "ADAPTER_UNAVAILABLE"
      });

      const planPath = "scripts/sources/ocr-plans/fixture-31p.yaml";
      // First attempt (fails at chunk 2)
      const res1 = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter: adapter1
      });
      assert.equal(res1.ok, false);
      assert.equal(adapter1.getSubmissionCount(0), 1);
      assert.equal(adapter1.getSubmissionCount(1), 1);

      // Second attempt: resume with working adapter
      const adapter2 = new FixtureAdapter();
      const res2 = await runOcrOrchestrator({
        planPath,
        resumeToolRunId: toolRunId,
        adapter: adapter2
      });

      assert.equal(res2.ok, true);
      assert.equal(res2.toolRunId, toolRunId);
      assert.notEqual(res2.logRunId, res1.logRunId);
      // Chunks 0 and 1 should NOT be submitted to adapter2
      assert.equal(adapter2.getSubmissionCount(0), 0);
      assert.equal(adapter2.getSubmissionCount(1), 0);
      // Chunk 2 and subsequent should be submitted
      assert.equal(adapter2.getSubmissionCount(2), 1);
    });

    it("resubmits an incomplete chunk if a page body no longer matches textSha256", async () => {
      const toolRunId = `test-tamper-${Date.now()}`;
      const adapter = new FixtureAdapter();
      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";

      // Initial run
      const res1 = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter
      });
      assert.equal(res1.ok, true);

      // Tamper with page-1.md body
      const page1Path = resolve(ROOT, "artifacts/ocr-runs/fixture-3p", toolRunId, "pages/page-1.md");
      const content = await readFile(page1Path, "utf-8");
      await writeFile(page1Path, content + "\n[TAMPERED CONTENT]");

      // Resume check
      const plan = await loadPlan(planPath);
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-3p", toolRunId);
      const resumeState = await resumeRun(runDir, plan);

      // Chunk 0 (holding page 1 and 2) must be incomplete
      assert.ok(!resumeState.completedChunkIndices.has(0), "Chunk 0 should be marked incomplete due to digest mismatch");
      // Chunk 1 (holding page 3) must remain complete
      assert.ok(resumeState.completedChunkIndices.has(1), "Chunk 1 should remain complete");
    });
  });

  describe("Retries", () => {
    it("records two retries when two timeouts occur before success", async () => {
      const toolRunId = `test-retry-timeout-${Date.now()}`;
      const adapter = new FixtureAdapter({
        failAtChunkIndex: 0,
        timeoutsBeforeSuccess: 2
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter
      });

      assert.equal(res.ok, true);
      assert.ok(res.summary);
      assert.equal(res.summary.retries, 2, "Expected 2 retries logged in summary");
    });

    it("records zero retries on authentication failure", async () => {
      const toolRunId = `test-retry-auth-${Date.now()}`;
      const adapter = new FixtureAdapter({
        failAtChunkIndex: 0,
        failWithCode: "ADAPTER_AUTH"
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter
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
          1: "[[RUNNING-HEAD Test]]\n[[PAGE-NUMBER 1]]\nText without math region."
        }
      });

      const planPath = "scripts/sources/ocr-plans/fixture-3p.yaml";
      const res = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter
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
      const page1Coverage = res.coverage.pages.find(p => p.pdfPage === 1);
      assert.ok(page1Coverage);
      assert.equal(page1Coverage.mismatch, true);
      assert.ok(res.coverage.mismatches.length > 0);
      const mathMismatch = res.coverage.mismatches.find(m => m.pdfPage === 1 && m.field === "displayEquations");
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
        SOME_OTHER_VAR: "regular-value"
      };

      const rawMessage = `Error contacting Luna service with API key ${secretToken} and header Authorization: Bearer ${secretToken}`;
      const redacted = redact(rawMessage, mockEnv);

      assert.ok(!redacted.includes(secretToken), "Redacted text must not contain raw secret token");
      assert.ok(redacted.includes("[REDACTED]"));
    });
  });
});
