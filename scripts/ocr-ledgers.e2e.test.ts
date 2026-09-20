import assert from "node:assert";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FixtureAdapter } from "./ocr-adapters/fixture-adapter.ts";
import { runOcrOrchestrator, syntheticPageRenderer } from "./ocr-ledgers.ts";

const SYNTHETIC_RENDER = { customRenderer: syntheticPageRenderer };

/** The credential planted in the environment for the end-to-end run. */
const E2E_SECRET_VALUE = "luna-e2e-credential-2f4a8c1d-not-a-real-key";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Criterion 7, "credentials never appear in any written file", with a credential that is
 * actually on a write path (am-src-ocr-orchestrator-u1e0).
 *
 * The sweep in the pipeline test above checks every file the run wrote, but the happy
 * path never handles a credential, so with redaction switched off nothing leaked and the
 * sweep passed anyway: a plant that cannot reach the planted state. Verified, not assumed -
 * disabling the env-value branch of `redact` left that test green.
 *
 * The leak vector a real adapter has is an error that quotes the failing request. This
 * drives it: the fixture adapter's auth failure echoes the Authorization header, and the
 * orchestrator must redact it before the message reaches run.jsonl.
 */
describe("OCR Orchestrator: a credential on a write path is redacted", () => {
  for (const form of ["header", "bare"] as const) {
    it(`writes [REDACTED] and never the key, when the adapter error carries it (${form})`, async () => {
      const previousKey = process.env.LUNA_API_KEY;
      process.env.LUNA_API_KEY = E2E_SECRET_VALUE;
      const toolRunId = `redaction-run-${Date.now()}`;
      const runDir = resolve(ROOT, "artifacts/ocr-runs/fixture-3p", toolRunId);

      try {
        const result = await runOcrOrchestrator({
          planPath: "scripts/sources/ocr-plans/fixture-3p.yaml",
          toolRunId,
          adapter: new FixtureAdapter({
            failAtChunkIndex: 0,
            failWithCode: "ADAPTER_AUTH",
            echoCredentialInAuthError: form,
          }),
          renderOptions: SYNTHETIC_RENDER,
        });
        assert.equal(result.ok, false, "An auth failure must not report success");

        const logText = await readFile(resolve(runDir, "run.jsonl"), "utf-8");
        // The message reached the log, so the write path really was exercised...
        assert.ok(
          logText.includes("authentication failed"),
          "The adapter's auth error must be recorded",
        );
        // ...and the credential inside it did not survive the trip.
        assert.ok(
          !logText.includes(E2E_SECRET_VALUE),
          "run.jsonl contains the raw credential from the adapter error",
        );
        assert.ok(logText.includes("[REDACTED]"), "The credential must be recorded as redacted");
      } finally {
        if (previousKey === undefined) delete process.env.LUNA_API_KEY;
        else process.env.LUNA_API_KEY = previousKey;
      }
    });
  }
});

describe("OCR Orchestrator: End-to-End Pipeline Test", () => {
  it("runs full 31-page pipeline with concurrency 2, deliberate failure at chunk 5, resume, summarize, and coverage verification", async () => {
    // A credential present for the whole run, so the sweep below has something to find if
    // any write path skips redaction. The name matches redact()'s sensitive list; the
    // value is distinctive enough that a substring hit is never a coincidence.
    const previousKey = process.env.LUNA_API_KEY;
    process.env.LUNA_API_KEY = E2E_SECRET_VALUE;

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

      // Verify no credentials exist anywhere in run.jsonl or summary.json.
      //
      // The two lines below search for one lowercase literal, "bearer ". They pass on a run
      // that never had a credential to leak, which is every run of the fixture adapter, so
      // on their own they are a check that cannot fail for the right reason. They are kept
      // because a literal "bearer " in an artifact would still be wrong, and the sweep that
      // follows is the one that does the work.
      assert.ok(!logContent.includes("bearer "), "Log must not contain raw bearer credentials");
      assert.ok(!JSON.stringify(res2.summary).includes("bearer "));

      // The real check: a distinctive secret is put in the environment for the whole run
      // above, and no file this run wrote may contain it - not the log, not the summary,
      // not the coverage report, not a checkpoint, not a page draft, not the receipt block.
      // `redact` keys off the NAME of the variable, so the value is only safe if every
      // write path passes through it; a single unredacted path fails this.
      const written: string[] = [];
      async function collect(dir: string): Promise<void> {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const full = resolve(dir, entry.name);
          if (entry.isDirectory()) await collect(full);
          else written.push(full);
        }
      }
      await collect(runDir);
      assert.ok(written.length > 0, "The run directory must contain files to sweep");

      const leaked: string[] = [];
      for (const file of written) {
        if ((await readFile(file, "utf-8")).includes(E2E_SECRET_VALUE)) leaked.push(file);
      }
      assert.deepEqual(
        leaked,
        [],
        `These artifacts contain the run's credential: ${leaked.join(", ")}`,
      );
      // And the same value must not reach the returned records either.
      assert.ok(!JSON.stringify(res2.summary).includes(E2E_SECRET_VALUE));
      assert.ok(!JSON.stringify(res2.coverage).includes(E2E_SECRET_VALUE));

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
    } finally {
      // The environment is shared with every other test in this process, so the planted
      // credential is put back exactly as it was, present or absent.
      if (previousKey === undefined) delete process.env.LUNA_API_KEY;
      else process.env.LUNA_API_KEY = previousKey;
    }
  });
});
