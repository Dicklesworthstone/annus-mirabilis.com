#!/usr/bin/env bun
/**
 * ============================================================================
 * Annus Mirabilis: Cloud OCR Orchestrator (scripts/ocr-ledgers.ts)
 * ============================================================================
 *
 * HARD RESOURCE POLICY (AGENTS.md - "Cloud OCR Only: Hard Resource Policy"):
 * 
 * NEVER RUN OCR ON THIS MACHINE.
 * Local OCR has already caused severe performance degradation, slowed an entire
 * multi-agent campaign, and wasted substantial time in the donor project. This
 * prohibition is permanent and has no convenience, deadline, fallback, or
 * "small batch" exception.
 *
 * - Delegate every OCR or machine-transcription job to a cloud GPT-5.6 Luna worker.
 *   This includes focr, Tesseract, OCRmyPDF, vision transcription loops, and any
 *   other process whose purpose is to recognize text from page pixels.
 * - Do not install, invoke, benchmark, resume, or monitor a local OCR engine or
 *   daemon in this repository or elsewhere on this host. Do not use local CPU,
 *   GPU, NPU, or memory for OCR.
 * - If a Luna worker or the cloud execution path is unavailable, pause the OCR
 *   portion and report the blocker. Do not fall back to local OCR.
 * - Give cloud workers bounded, checkpointed page ranges. Preserve partial
 *   results after every chunk; never create one monolithic all-papers batch.
 * - Cloud OCR output is research evidence only. Mathematics is retyped by human
 *   editors and compared directly with page images; parsed text is never
 *   accepted into the edition without line-by-line review.
 * ============================================================================
 */

import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type OcrPlan,
  loadPlan,
  validatePlan,
  type ValidatePlanOptions
} from "./sources/ocrPlanSchema.ts";
import {
  type CloudOcrAdapter,
  type OcrRefusalCode,
  OcrRefusalError,
  OcrAdapterError,
  AdapterUnavailableError,
  AdapterAuthError,
  AdapterQuotaError,
  AdapterTimeoutError,
  AdapterBadResponseError
} from "./ocr-adapters/types.ts";
import { loadAdapter, type LoadAdapterOptions } from "./ocr-adapters/loader.ts";
import {
  type ChunkPlan,
  type RenderedPage,
  type RenderOptions,
  type ChunkResult,
  type CheckpointContext,
  type ResumeState,
  type ResumeOptions,
  type RunSummaryResult,
  type CoverageResult,
  planChunks,
  renderPages,
  runChunk,
  writeCheckpoint,
  resumeRun,
  summarizeRun,
  buildCoverage,
  redact,
  generateToolRunId,
  generateLogRunId,
  appendStructuredLog
} from "./sources/ocrRunner.ts";

export {
  loadPlan,
  validatePlan,
  planChunks,
  renderPages,
  loadAdapter,
  runChunk,
  writeCheckpoint,
  resumeRun,
  summarizeRun,
  buildCoverage,
  redact,
  generateToolRunId,
  generateLogRunId
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface RunOrchestratorOptions {
  planPath: string;
  dryRun?: boolean | undefined;
  resumeToolRunId?: string | undefined;
  summarizeOnly?: boolean | undefined;
  resubmitChunkIndex?: number | undefined;
  resubmitReason?: string | undefined;
  adapterName?: string | undefined;
  adapter?: CloudOcrAdapter | undefined;
  logRunId?: string | undefined;
  toolRunId?: string | undefined;
  renderOptions?: RenderOptions | undefined;
  instructionsPath?: string | undefined;
}

export interface OrchestratorResult {
  ok: boolean;
  toolRunId: string;
  logRunId: string;
  runDir: string;
  summary?: RunSummaryResult | undefined;
  coverage?: CoverageResult | undefined;
  receiptBlock?: string | undefined;
  paused?: boolean | undefined;
  pauseReason?: string | undefined;
  pauseComment?: string | undefined;
  error?: Error | undefined;
}

export async function runOcrOrchestrator(
  options: RunOrchestratorOptions
): Promise<OrchestratorResult> {
  const logRunId = options.logRunId ?? generateLogRunId();
  const plan = await loadPlan(options.planPath, { checkFacsimile: true });

  const toolRunId = options.resumeToolRunId ?? options.toolRunId ?? generateToolRunId();
  const runDir = resolve(ROOT, "artifacts/ocr-runs", plan.key, toolRunId);
  await mkdir(runDir, { recursive: true });

  // If summarize-only
  if (options.summarizeOnly) {
    const res = await summarizeRun(runDir, plan);
    return {
      ok: true,
      toolRunId,
      logRunId,
      runDir,
      summary: res.summary,
      coverage: res.coverage,
      receiptBlock: res.receiptBlock
    };
  }

  // Load instructions
  const instructionsFile = options.instructionsPath ?? resolve(ROOT, "scripts/sources/ocr-instructions", `${plan.instructionsVersion}.md`);
  const instructionText = await readFile(instructionsFile, "utf-8");

  // Plan chunks
  const chunks = planChunks(plan.pdfPageRange, plan.chunkSize);

  // Render pages
  const imagesDir = resolve(runDir, "images");
  const allPdfPages = chunks.flatMap(c => c.pdfPages);
  const renderedList = await renderPages(plan.facsimilePath, allPdfPages, imagesDir, options.renderOptions);
  const renderedPagesMap = new Map<number, RenderedPage>();
  for (const r of renderedList) {
    renderedPagesMap.set(r.pdfPage, r);
  }

  // Log planned & rendered
  await appendStructuredLog(runDir, logRunId, {
    timestamp: new Date().toISOString(),
    suite: "ocr-ledgers",
    logRunId,
    toolRunId,
    beadId: "am-src-ocr-orchestrator-u1e0",
    key: plan.key,
    planPath: options.planPath,
    facsimileSha256: plan.facsimileSha256,
    instructionsVersion: plan.instructionsVersion,
    status: "planned"
  });

  for (const r of renderedList) {
    await appendStructuredLog(runDir, logRunId, {
      timestamp: new Date().toISOString(),
      suite: "ocr-ledgers",
      logRunId,
      toolRunId,
      beadId: "am-src-ocr-orchestrator-u1e0",
      key: plan.key,
      facsimileSha256: plan.facsimileSha256,
      pdfPages: [r.pdfPage],
      imageSha256: r.imageSha256,
      renderer: r.renderer,
      rendererVersion: r.rendererVersion,
      dpi: r.dpi,
      status: "rendered"
    });
  }

  if (options.dryRun) {
    return {
      ok: true,
      toolRunId,
      logRunId,
      runDir
    };
  }

  // Load adapter
  const adapter = options.adapter ?? loadAdapter(options.adapterName);

  // Resume state check
  const resumeState = await resumeRun(runDir, plan, {
    resubmitChunkIndex: options.resubmitChunkIndex,
    resubmitReason: options.resubmitReason
  });

  const checkpointContext: CheckpointContext = {
    key: plan.key,
    toolRunId,
    logRunId,
    adapter: adapter.name,
    instructionsVersion: plan.instructionsVersion,
    renderedPages: renderedPagesMap
  };

  // Process chunks with concurrency up to plan.maxConcurrency (1 or 2)
  const concurrency = plan.maxConcurrency;
  let hasOutage = false;
  let outageError: Error | null = null;
  let pausedChunkIndex: number | null = null;

  for (let i = 0; i < chunks.length; i += concurrency) {
    const chunkBatch = chunks.slice(i, i + concurrency);
    
    // Filter out already completed chunks
    const toProcess = chunkBatch.filter(c => {
      if (resumeState.completedChunkIndices.has(c.chunkIndex)) {
        appendStructuredLog(runDir, logRunId, {
          timestamp: new Date().toISOString(),
          suite: "ocr-ledgers",
          logRunId,
          toolRunId,
          beadId: "am-src-ocr-orchestrator-u1e0",
          key: plan.key,
          facsimileSha256: plan.facsimileSha256,
          chunkIndex: c.chunkIndex,
          pdfPages: c.pdfPages,
          status: "skipped-checkpoint"
        });
        return false;
      }
      return true;
    });

    if (toProcess.length === 0) continue;

    // Process chunk batch, writing checkpoints individually as each finishes
    const settledResults = await Promise.allSettled(
      toProcess.map(async (c) => {
        const res = await runChunk(
          c,
          renderedPagesMap,
          adapter,
          plan,
          instructionText,
          toolRunId,
          logRunId,
          runDir
        );
        await writeCheckpoint(runDir, c, res, checkpointContext);
        resumeState.completedChunkIndices.add(c.chunkIndex);
        return { chunk: c, res };
      })
    );

    let batchError: any = null;
    for (let j = 0; j < settledResults.length; j++) {
      const settled = settledResults[j]!;
      if (settled.status === "rejected") {
        batchError = settled.reason;
        if (!pausedChunkIndex) {
          pausedChunkIndex = toProcess[j]?.chunkIndex ?? i;
        }
      }
    }

    if (batchError) {
      const err = batchError;
      const isOutage =
        err instanceof AdapterUnavailableError ||
        err instanceof AdapterAuthError ||
        err instanceof AdapterQuotaError ||
        err?.code === "ADAPTER_UNAVAILABLE" ||
        err?.code === "ADAPTER_AUTH" ||
        err?.code === "ADAPTER_QUOTA";

      if (isOutage) {
        hasOutage = true;
        outageError = err;
        await appendStructuredLog(runDir, logRunId, {
          timestamp: new Date().toISOString(),
          suite: "ocr-ledgers",
          logRunId,
          toolRunId,
          beadId: "am-src-ocr-orchestrator-u1e0",
          key: plan.key,
          facsimileSha256: plan.facsimileSha256,
          chunkIndex: pausedChunkIndex ?? i,
          status: "paused",
          errorCode: err?.code ?? "OUTAGE",
          message: err.message
        });
        break;
      } else {
        await appendStructuredLog(runDir, logRunId, {
          timestamp: new Date().toISOString(),
          suite: "ocr-ledgers",
          logRunId,
          toolRunId,
          beadId: "am-src-ocr-orchestrator-u1e0",
          key: plan.key,
          facsimileSha256: plan.facsimileSha256,
          chunkIndex: pausedChunkIndex ?? i,
          status: "failed",
          errorCode: err?.code ?? "ERROR",
          message: err.message
        });
        throw err;
      }
    }
  }

  if (hasOutage && outageError) {
    const pauseCode = (outageError as any).code ?? "ADAPTER_UNAVAILABLE";
    const pauseComment = `RUST_LOG=error br comments add am-src-ocr-${plan.key} "PAUSED: OCR cloud adapter unavailable at chunk ${pausedChunkIndex} (code: ${pauseCode}). Checkpoints preserved in artifacts/ocr-runs/${plan.key}/${toolRunId}/."`;

    return {
      ok: false,
      toolRunId,
      logRunId,
      runDir,
      paused: true,
      pauseReason: outageError.message,
      pauseComment,
      error: outageError
    };
  }

  const { summary, coverage, receiptBlock } = await summarizeRun(runDir, plan);

  return {
    ok: true,
    toolRunId,
    logRunId,
    runDir,
    summary,
    coverage,
    receiptBlock
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let planPath = "";
  let dryRun = false;
  let resumeToolRunId: string | undefined;
  let summarizeToolRunId: string | undefined;
  let resubmitChunkIndex: number | undefined;
  let resubmitReason: string | undefined;
  let adapterName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--plan" && i + 1 < args.length) {
      planPath = args[++i]!;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--resume" && i + 1 < args.length) {
      resumeToolRunId = args[++i]!;
    } else if (arg === "--summarize" && i + 1 < args.length) {
      summarizeToolRunId = args[++i]!;
    } else if (arg === "--resubmit-chunk" && i + 1 < args.length) {
      resubmitChunkIndex = parseInt(args[++i]!, 10);
    } else if (arg === "--reason" && i + 1 < args.length) {
      resubmitReason = args[++i]!;
    } else if (arg === "--adapter" && i + 1 < args.length) {
      adapterName = args[++i]!;
    }
  }

  if (!planPath && !summarizeToolRunId) {
    console.error("Usage: bun scripts/ocr-ledgers.ts --plan <path> [--dry-run] [--resume <tool-run-id>] [--summarize <tool-run-id>] [--resubmit-chunk <i> --reason \"<text>\"] [--adapter <name>]");
    process.exit(1);
  }

  runOcrOrchestrator({
    planPath,
    dryRun,
    resumeToolRunId: resumeToolRunId || summarizeToolRunId,
    summarizeOnly: !!summarizeToolRunId,
    resubmitChunkIndex,
    resubmitReason,
    adapterName
  })
    .then(result => {
      if (result.paused) {
        console.error(`\n[PAUSED] OCR Run Paused: ${result.pauseReason}`);
        console.error(`Post this comment:\n${result.pauseComment}\n`);
        process.exit(2);
      }
      if (!result.ok) {
        console.error(`\n[FAILED] OCR Run Failed: ${result.error?.message}`);
        process.exit(1);
      }
      console.log(`\n[SUCCESS] Tool Run ${result.toolRunId} completed successfully.`);
      if (result.receiptBlock) {
        console.log(`\n${result.receiptBlock}`);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error(`\n[REFUSAL/ERROR] ${err.message}`);
      process.exit(err.exitCode ?? 1);
    });
}
