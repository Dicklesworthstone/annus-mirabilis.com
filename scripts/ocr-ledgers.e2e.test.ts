import assert from "node:assert";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FixtureAdapter } from "./ocr-adapters/fixture-adapter.ts";
import { runOcrOrchestrator, syntheticPageRenderer } from "./ocr-ledgers.ts";

const SYNTHETIC_RENDER = { customRenderer: syntheticPageRenderer };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("OCR Orchestrator: End-to-End Pipeline Test", () => {
  it("runs full 31-page pipeline with concurrency 2, deliberate failure at chunk 5, resume, summarize, and coverage verification", async () => {
    const planPath = "scripts/sources/ocr-plans/fixture-31p.yaml";
    const toolRunId = `e2e-run-${Date.now()}`;
    let process1LogRunId = "";
    let process2LogRunId = "";

    try {
      // Step 1: Process 1 dispatches through fixture adapter, failing at chunk 5 with ADAPTER_UNAVAILABLE
      const adapter1 = new FixtureAdapter({
        failAtChunkIndex: 5,
        failWithCode: "ADAPTER_UNAVAILABLE",
      });

      const res1 = await runOcrOrchestrator({
        planPath,
        toolRunId,
        adapter: adapter1,
        renderOptions: SYNTHETIC_RENDER,
      });

      process1LogRunId = res1.logRunId;
      assert.equal(res1.ok, false, "Process 1 should fail/pause at chunk 5");
      assert.equal(res1.paused, true);
      assert.equal(res1.toolRunId, toolRunId);

      // Verify chunks 0..4 (pages 1..10) are completed on disk
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-31p", toolRunId);
      for (let p = 1; p <= 10; p++) {
        assert.ok(
          existsSync(resolve(runDir, `pages/page-${p}.md`)),
          `Page ${p} should exist after process 1`,
        );
      }
      assert.ok(!existsSync(resolve(runDir, "pages/page-11.md")), "Page 11 should not exist yet");

      // Step 2: Process 2 resumes into the same toolRunId with concurrency 2
      const adapter2 = new FixtureAdapter();
      const res2 = await runOcrOrchestrator({
        planPath,
        resumeToolRunId: toolRunId,
        adapter: adapter2,
        renderOptions: SYNTHETIC_RENDER,
      });

      process2LogRunId = res2.logRunId;
      assert.equal(res2.ok, true, "Process 2 resume should complete successfully");
      assert.equal(res2.toolRunId, toolRunId, "Tool run ID must remain identical across processes");
      assert.notEqual(res2.logRunId, process1LogRunId, "Process 2 must have a unique logRunId");

      // Assert submission counts:
      // Chunks 0..4 were completed in process 1, so process 2 must submit them 0 times
      for (let c = 0; c < 5; c++) {
        assert.equal(
          adapter1.getSubmissionCount(c),
          1,
          `Chunk ${c} should be submitted once in process 1`,
        );
        assert.equal(
          adapter2.getSubmissionCount(c),
          0,
          `Chunk ${c} should NOT be resubmitted in process 2`,
        );
      }
      // Chunks 5..15 are submitted in process 2
      for (let c = 5; c < 16; c++) {
        assert.equal(
          adapter2.getSubmissionCount(c),
          1,
          `Chunk ${c} should be submitted once in process 2`,
        );
      }

      // Assert all 31 pages are written
      const pagesDir = resolve(runDir, "pages");
      const files = await readdir(pagesDir);
      const mdFiles = files.filter(
        (f) => f.startsWith("page-") && f.endsWith(".md") && !f.includes(".tmp."),
      );
      assert.equal(mdFiles.length, 31, "Expected exactly 31 completed page files");

      // Assert Summary Fields
      assert.ok(res2.summary, "Summary must be present");
      assert.equal(res2.summary.toolRunId, toolRunId);
      assert.equal(res2.summary.key, "fixture-31p");
      assert.equal(res2.summary.instructionsVersion, "v1");
      assert.equal(res2.summary.workerIdentity, "gpt-5.6-luna");
      assert.equal(Object.keys(res2.summary.imageSha256s).length, 31);
      assert.equal(Object.keys(res2.summary.textSha256s).length, 31);

      // Assert Coverage Fields
      assert.ok(res2.coverage, "Coverage must be present");
      assert.equal(res2.coverage.totalPages, 31);
      assert.equal(res2.coverage.draftedPages, 31);
      assert.equal(res2.coverage.missingPages, 0);

      // Assert Receipt Block
      assert.ok(res2.receiptBlock?.includes(toolRunId));
      assert.ok(res2.receiptBlock?.includes("research evidence only"));
      assert.ok(existsSync(resolve(runDir, "RESEARCH_EVIDENCE_ONLY")));
      const page1 = await readFile(resolve(runDir, "pages/page-1.md"), "utf-8");
      assert.ok(page1.includes("SYNTHETIC OCR FIXTURE"));
      assert.ok(!page1.includes("Einstein"));
      assert.ok(!page1.includes("Annalen der Physik"));

      // Assert Ordered run.jsonl statuses
      const runLogPath = resolve(runDir, "run.jsonl");
      const logContent = await readFile(runLogPath, "utf-8");
      const logEntries = logContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const statuses = logEntries.map((e) => e.status);
      assert.ok(statuses.includes("planned"), "Log must contain planned status");
      assert.ok(statuses.includes("rendered"), "Log must contain rendered status");
      assert.ok(statuses.includes("submitted"), "Log must contain submitted status");
      assert.ok(statuses.includes("completed"), "Log must contain completed status");
      assert.ok(statuses.includes("paused"), "Log must contain paused status from process 1");
      assert.ok(
        statuses.includes("skipped-checkpoint"),
        "Log must contain skipped-checkpoint status from process 2",
      );

      // Verify no credentials exist anywhere in run.jsonl or summary.json
      assert.ok(!logContent.includes("bearer "), "Log must not contain raw bearer credentials");
      assert.ok(!JSON.stringify(res2.summary).includes("bearer "));

      // Verify no artifact contains a field named 'runId'
      for (const entry of logEntries) {
        assert.equal(
          entry.runId,
          undefined,
          "Artifacts must not contain 'runId' (only toolRunId and logRunId)",
        );
      }
      assert.equal("runId" in res2.summary, false);
      assert.equal("runId" in res2.coverage, false);
    } catch (testError) {
      // Retain run directory and logs under artifacts/test-logs/ocr-ledgers/<log-run-id>/evidence/
      const evidenceDir = resolve(
        ROOT,
        "artifacts/test-logs/ocr-ledgers",
        process2LogRunId || process1LogRunId || "unknown-run",
        "evidence",
      );
      await mkdir(evidenceDir, { recursive: true });
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-31p", toolRunId);
      if (existsSync(runDir)) {
        await cp(runDir, evidenceDir, { recursive: true });
      }
      throw testError;
    }
  });
});
