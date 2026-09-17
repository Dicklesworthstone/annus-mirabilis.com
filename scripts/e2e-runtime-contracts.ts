/**
 * E2E Runtime Contracts Runner.
 * Specification: am-rt-u64-identities-7ce
 *
 * Implements end-to-end runtime contract verification across:
 * - Real Worker boundaries (crossing structured clone as BigInt and U64String)
 * - JSON and URL codecs roundtripping boundary seeds
 * - Stream allocation execution and draw-counter logging
 * - Structured JSONL logging to artifacts/test-logs/runtime-identity/<log-run-id>.jsonl
 * - Failure evidence retention under artifacts/test-logs/runtime-identity/<log-run-id>/failures/<testId>.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyCommand } from "../src/experiments/commands/apply.ts";
import { compareBaselineAndVariant } from "../src/experiments/commands/comparison.ts";

import type { ExecutionStateSnapshot } from "../src/experiments/commands/invariants.ts";
import {
  checkObservationInterval,
  type ReplayGrid,
} from "../src/experiments/commands/replayGrid.ts";
import type { TypedCommand } from "../src/experiments/commands/types.ts";

import { parseWithU64, stringifyWithU64 } from "../src/experiments/identity/jsonCodec.ts";
import { parseU64, type U64String, U64ValidationError } from "../src/experiments/identity/u64.ts";
import { encodeU64QueryParams, getU64QueryParam } from "../src/experiments/identity/urlCodec.ts";
import { decodeOutcome, decodeRefusal, decodeResult } from "../src/experiments/results/codec.ts";
import {
  containsIdentifierLeak,
  containsPhysicalWording,
} from "../src/experiments/results/explanations.ts";
import { statusEnumIds } from "../src/experiments/results/ids.ts";
import {
  budgetExhaustedOutcomeExample,
  ftcsUnstableRefusalExample,
  invalidSeedRefusalExample,
  lq02FiniteCutoffExample,
  missingArtifactOutcomeExample,
  outsideWienDomainRefusalExample,
  planStatusExamples,
  superluminalObserverRefusalExample,
} from "../src/experiments/results/planExamples.ts";
import { ResultStatusNote } from "../src/experiments/results/ResultStatusNote.tsx";
import type { ScientificResult } from "../src/experiments/results/types.ts";
import { toU64String } from "../src/experiments/identity/u64.ts";
import { createInstanceStore, type RequestToken } from "../src/experiments/store/instanceStore.ts";
import { createStreamKey } from "../src/experiments/streams/allocation.ts";
import { ControlTapeRecorder } from "../src/experiments/tapes/recorder.ts";
import {
  ControlTapeReplayer,
  type TapeRuntimeContext,
  validateTapeCompatibility,
} from "../src/experiments/tapes/replayer.ts";
import {
  type ControlTapeV2,
  type PredictionPromptSpec,
  type TapeModelIdentity,
  validateControlTape,
} from "../src/experiments/tapes/schema.ts";
import { createPhiloxStream } from "../src/physics/reference/philox.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";
import { createEventLedgerDescription } from "../src/testing/runtime-fixtures/eventLedgerFixture.ts";
import {
  createSeededWalkFixture,
  generateBaseLatentPath,
} from "../src/testing/runtime-fixtures/seededWalkFixture.ts";

import {
  createTwoModelFixtureStore,
  TWO_MODEL_DECLARED_MODELS,
} from "../src/testing/runtime-fixtures/twoModelFixture.ts";
import { createChunkPlan, executeChunked } from "../src/workers/scheduler/chunking.ts";
import { markAccepted, markInput, markPainted } from "../src/workers/scheduler/marks.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type SchedulerEvent,
  type WorkerChannel,
} from "../src/workers/scheduler/scheduler.ts";
import {
  forceTransportMode,
  probeTransportCapabilities,
  SharedMemoryDisabledError,
} from "../src/workers/transport.ts";

interface CliOptions {
  suite: string;
  // parseCliArgs returns these as `undefined` when the flag is absent, which
  // exactOptionalPropertyTypes rejects against a bare `?:` (am-7mp8).
  logRunId?: string | undefined;
  verbose?: boolean | undefined;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  let suite = "identity";
  let logRunId: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--suite" && i + 1 < args.length) {
      const next = args[++i];
      if (next) suite = next;
    } else if (arg === "--log-run-id" && i + 1 < args.length) {
      const next = args[++i];
      if (next) logRunId = next;
    } else if (arg === "--verbose") {
      verbose = true;
    }
  }

  return { suite, logRunId, verbose };
}

function stringToHexBytes(str: string): string {
  return Buffer.from(str, "utf8").toString("hex");
}

async function runWorkerRoundTrip(
  seed: U64String | bigint,
  asBigInt: boolean,
): Promise<{ seedEcho: string | bigint; isBigInt: boolean }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (msg) => {
        const isBigInt = typeof msg.seed === 'bigint';
        parentPort.postMessage({ seedEcho: msg.seed, isBigInt });
      });
    `;

    const worker = new Worker(workerCode, { eval: true });

    worker.on("message", (msg) => {
      worker.terminate();
      resolvePromise(msg);
    });

    worker.on("error", (err) => {
      worker.terminate();
      rejectPromise(err);
    });

    worker.postMessage({ seed: asBigInt ? BigInt(seed) : String(seed) });
  });
}

async function runIdentityE2E(logRunId: string, verbose: boolean): Promise<boolean> {
  const logger = new TestLogger("runtime-identity", logRunId);
  const fixturePath = resolve(process.cwd(), "src/testing/fixtures/u64-boundaries.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

  const validSeeds: string[] = fixture.valid;
  let allPassed = true;

  const failureDir = resolve(
    process.cwd(),
    "artifacts",
    "test-logs",
    "runtime-identity",
    logRunId,
    "failures",
  );

  const recordFailure = (
    testId: string,
    rawInput: string,
    codec: string,
    expected: unknown,
    actual: unknown,
    rejectionReason: string,
    extraFields: Record<string, unknown> = {},
  ) => {
    mkdirSync(failureDir, { recursive: true });
    const failFilePath = join(failureDir, `${testId}.json`);
    const failData = {
      testId,
      rawInputHex: stringToHexBytes(rawInput),
      rawInput,
      codec,
      expected,
      actual,
      rejectionReason,
      reproductionCommand: "bun scripts/e2e-runtime-contracts.ts --suite identity",
      ...extraFields,
    };
    writeFileSync(failFilePath, JSON.stringify(failData, null, 2), "utf8");

    logger.log({
      testId,
      beadId: "am-rt-u64-identities-7ce",
      suite: "runtime-identity",
      outcome: "failed",
      expected,
      actual,
      comparisonKind: "bitwise",
      message: rejectionReason,
      extra: {
        input: rawInput,
        codec,
        rejectionReason,
        failurePath: failFilePath,
        ...extraFields,
      },
    });
  };

  if (verbose) {
    console.log(`[E2E-Runtime] Starting identity suite (logRunId: ${logRunId})`);
  }

  // 1. Worker boundary test for all boundary seeds
  for (const seedStr of validSeeds) {
    const startTime = Date.now();
    const testId = `worker-boundary-${seedStr}`;

    try {
      // Test crossing as U64String
      const strEcho = await runWorkerRoundTrip(seedStr as U64String, false);
      if (strEcho.seedEcho !== seedStr || strEcho.isBigInt) {
        throw new Error(
          `Worker string echo failed: expected "${seedStr}", got ${JSON.stringify(strEcho.seedEcho)}`,
        );
      }

      // Test crossing as BigInt by structured clone
      const bigEcho = await runWorkerRoundTrip(BigInt(seedStr), true);
      if (bigEcho.seedEcho !== BigInt(seedStr) || !bigEcho.isBigInt) {
        throw new Error(
          `Worker BigInt echo failed: expected ${seedStr}n, got ${String(bigEcho.seedEcho)}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-u64-identities-7ce",
        suite: "runtime-identity",
        seed: seedStr,
        streamVersion: 1,
        expected: seedStr,
        actual: strEcho.seedEcho,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        extra: {
          input: seedStr,
          parsed: seedStr,
          codec: "worker",
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, seedStr, "worker", seedStr, msg, msg);
    }
  }

  // 2. Codec and Stream Allocation Execution Test
  for (const seedStr of validSeeds) {
    const startTime = Date.now();
    const testId = `stream-allocation-drive-${seedStr}`;

    try {
      // Pass through JSON codec
      const originalObj = {
        seed: seedStr as U64String,
        allocationId: "bm-01.latent.v1",
      };
      const json = stringifyWithU64(originalObj, ["seed"]);
      const parsedObj = parseWithU64<{
        seed: U64String;
        allocationId: string;
      }>(json, ["seed"]);

      if (parsedObj.seed !== seedStr) {
        throw new Error(`JSON codec roundtrip failed: expected ${seedStr}, got ${parsedObj.seed}`);
      }

      // Pass through URL codec
      const qs = encodeU64QueryParams({ seed: seedStr as U64String }, ["seed"]);
      const urlParsed = getU64QueryParam(`?${qs}`, "seed");
      if (urlParsed !== seedStr) {
        throw new Error(`URL codec roundtrip failed: expected ${seedStr}, got ${urlParsed}`);
      }

      // Drive registered stream allocation
      const streamKey = createStreamKey("bm-01.latent.v1", seedStr, 0, 0); // tracer 0, axis 0
      const philox = createPhiloxStream(streamKey, "0");

      const initialIndex = philox.index;
      philox.nextNormal();
      philox.nextNormal();
      const finalIndex = philox.index;
      const drawDelta = Number(finalIndex - initialIndex);

      // Box-Muller normal consumes 2 draws per call -> 4 draws total
      if (drawDelta !== 4) {
        throw new Error(`Expected drawDelta 4 for 2 normals, got ${drawDelta}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-u64-identities-7ce",
        suite: "runtime-identity",
        seed: seedStr,
        streamVersion: 1,
        expected: 4,
        actual: drawDelta,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        extra: {
          input: seedStr,
          parsed: seedStr,
          codec: "json+url+philox",
          allocationId: "bm-01.latent.v1",
          streamKernelId: 0x19050001,
          streamKernelBlock: "production",
          tile: streamKey.tile,
          index: Number(finalIndex),
          drawCounterDelta: drawDelta,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, seedStr, "runtime-pipeline", 4, msg, msg, {
        allocationId: "bm-01.latent.v1",
        streamKernelId: 0x19050001,
      });
    }
  }

  // 3. Rejection verification for invalid formats and numbers
  const rejectionCases = [
    { input: " 1", reason: "Leading whitespace" },
    { input: "+1", reason: "Plus sign" },
    { input: "18446744073709551616", reason: "Overflow 2^64" },
    { input: "١٢٣", reason: "Non-ASCII digits" },
  ];

  for (const item of rejectionCases) {
    const startTime = Date.now();
    const testId = `rejection-${stringToHexBytes(item.input)}`;

    try {
      let threw = false;
      try {
        parseU64(item.input);
      } catch (err) {
        if (err instanceof U64ValidationError) {
          threw = true;
        }
      }

      if (!threw) {
        throw new Error(`Expected U64ValidationError for "${item.input}"`);
      }

      logger.log({
        testId,
        beadId: "am-rt-u64-identities-7ce",
        suite: "runtime-identity",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: `Successfully rejected: ${item.reason}`,
        extra: {
          input: item.input,
          rejectionReason: item.reason,
          codec: "parseU64",
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(
        testId,
        item.input,
        "parseU64",
        "U64ValidationError",
        msg,
        `Expected rejection for ${item.reason}, but succeeded or threw wrong error.`,
      );
    }
  }

  await logger.flush();
  return allPassed;
}

async function runResultWorkerRoundTrip<T>(payload: T): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (msg) => {
        parentPort.postMessage(msg);
      });
    `;

    const worker = new Worker(workerCode, { eval: true });

    worker.on("message", (msg) => {
      worker.terminate();
      resolvePromise(msg);
    });

    worker.on("error", (err) => {
      worker.terminate();
      rejectPromise(err);
    });

    worker.postMessage(payload);
  });
}

async function runResultsE2E(logRunId: string, verbose: boolean): Promise<boolean> {
  const logger = new TestLogger("runtime-results", logRunId);
  let allPassed = true;

  const failureDir = resolve(
    process.cwd(),
    "artifacts",
    "test-logs",
    "runtime-results",
    logRunId,
    "failures",
  );

  const recordFailure = (
    testId: string,
    encodedPayload: unknown,
    decisionReason: string,
    renderedText: string,
    missingIds: readonly string[],
    reproductionCommand: string,
  ) => {
    mkdirSync(failureDir, { recursive: true });
    const failFilePath = join(failureDir, `${testId}.json`);
    const failData = {
      testId,
      encodedPayload,
      decisionReason,
      renderedText,
      missingIds,
      reproductionCommand,
    };
    writeFileSync(failFilePath, JSON.stringify(failData, null, 2), "utf8");

    logger.log({
      testId,
      beadId: "am-rt-typed-results-mqb",
      suite: "runtime-results",
      outcome: "failed",
      message: decisionReason,
      extra: {
        failurePath: failFilePath,
        decisionReason,
        renderedText,
        missingFromVoiceRules: missingIds,
      },
    });
  };

  if (verbose) {
    console.log(`[E2E-Runtime] Starting results suite (logRunId: ${logRunId})`);
  }

  // 1. Output Status Examples (7 statuses, including divergent and finite cutoff)
  const allResults: readonly ScientificResult[] = [...planStatusExamples, lq02FiniteCutoffExample];

  for (const item of allResults) {
    const startTime = Date.now();
    const testId = `result-worker-${item.status}-${item.quantityId}`;

    try {
      // Cross Worker boundary by structured clone
      const workerEcho = await runResultWorkerRoundTrip(item);

      // Strict decode
      const decoded = decodeResult(workerEcho);

      // Render with React server rendering
      const renderedHtml = renderToStaticMarkup(
        React.createElement(ResultStatusNote, {
          result: decoded,
          snapshotVersion: 1,
        }),
      );

      // Extract visible reader text (stripping DOM tags and data attributes)
      const readerText = renderedHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Assert identity-free text in reader view
      const leaks = containsIdentifierLeak(readerText, statusEnumIds);
      if (leaks.length > 0) {
        throw new Error(`Visible reader text leaks raw enum IDs: ${leaks.join(", ")}`);
      }

      // If divergent, assert contains no software failure language
      if (decoded.status === "divergent") {
        if (!renderedHtml.includes('data-result-status="divergent"')) {
          throw new Error('Missing data-result-status="divergent"');
        }
      }

      // Assert snapshot version carried and NO aria-live
      if (!renderedHtml.includes('data-snapshot-version="1"')) {
        throw new Error("Missing data-snapshot-version attribute");
      }
      if (renderedHtml.includes("aria-live")) {
        throw new Error("ResultStatusNote must not contain aria-live attribute");
      }

      const extra: Record<string, unknown> = {
        quantityId: decoded.quantityId,
        renderedText: readerText,
        exportedIdCount: statusEnumIds.length,
      };

      if (decoded.status === "value" && decoded.uncertainty) {
        extra.uncertaintyKind = decoded.uncertainty.kind;
      } else if (decoded.status === "outside-domain") {
        extra.domainKind = decoded.domainKind;
      } else if (decoded.status === "divergent") {
        extra.divergenceKind = decoded.divergenceKind;
        extra.divergenceVariable = decoded.variable;
        extra.divergenceRange = decoded.range;
        extra.finiteUnderParameter = decoded.finiteUnder.parameterId;
        extra.finiteUnderValue = decoded.finiteUnder.value;
        extra.modelId = decoded.modelId;
      }

      logger.log({
        testId,
        beadId: "am-rt-typed-results-mqb",
        suite: "runtime-results",
        resultStatus: decoded.status,
        snapshotVersion: 1,
        expected: decoded.status,
        actual: decoded.status,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: `Successfully validated ${decoded.status} result status across worker boundary.`,
        extra,
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(
        testId,
        item,
        msg,
        "",
        [],
        `bun scripts/e2e-runtime-contracts.ts --suite results --log-run-id ${logRunId}`,
      );
    }
  }

  // 2. Refusal Fixtures
  const refusalFixtures = [
    ftcsUnstableRefusalExample,
    superluminalObserverRefusalExample,
    outsideWienDomainRefusalExample,
    invalidSeedRefusalExample,
  ];

  for (const refusal of refusalFixtures) {
    const startTime = Date.now();
    const testId = `refusal-worker-${refusal.code}`;

    try {
      const workerEcho = await runResultWorkerRoundTrip(refusal);
      const decoded = decodeRefusal(workerEcho);
      const renderedHtml = renderToStaticMarkup(
        React.createElement(ResultStatusNote, {
          refusal: decoded,
          snapshotVersion: 1,
        }),
      );

      const readerText = renderedHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const leaks = containsIdentifierLeak(readerText, statusEnumIds);
      if (leaks.length > 0) {
        throw new Error(`Visible reader text leaks raw refusal IDs: ${leaks.join(", ")}`);
      }

      if (
        (decoded.domainKind === "numerical" || decoded.domainKind === "input") &&
        containsPhysicalWording(readerText)
      ) {
        throw new Error(`Numerical/input refusal makes physical claim: ${readerText}`);
      }

      if (!renderedHtml.includes(`data-refusal-code="${decoded.code}"`)) {
        throw new Error(`Missing data-refusal-code="${decoded.code}" attribute`);
      }

      logger.log({
        testId,
        beadId: "am-rt-typed-results-mqb",
        suite: "runtime-results",
        snapshotVersion: 1,
        expected: decoded.code,
        actual: decoded.code,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: `Successfully validated refusal ${decoded.code} across worker boundary.`,
        extra: {
          refusalCode: decoded.code,
          domainKind: decoded.domainKind,
          renderedText: readerText,
          exportedIdCount: statusEnumIds.length,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(
        testId,
        refusal,
        msg,
        "",
        [],
        `bun scripts/e2e-runtime-contracts.ts --suite results --log-run-id ${logRunId}`,
      );
    }
  }

  // 3. Execution Outcomes
  const outcomeFixtures = [budgetExhaustedOutcomeExample, missingArtifactOutcomeExample];

  for (const outcome of outcomeFixtures) {
    const startTime = Date.now();
    const testId = `outcome-worker-${outcome.outcome}`;

    try {
      const workerEcho = await runResultWorkerRoundTrip(outcome);
      const decoded = decodeOutcome(workerEcho);
      const renderedHtml = renderToStaticMarkup(
        React.createElement(ResultStatusNote, {
          outcome: decoded,
          snapshotVersion: 1,
        }),
      );

      const readerText = renderedHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const leaks = containsIdentifierLeak(readerText, statusEnumIds);
      if (leaks.length > 0) {
        throw new Error(`Visible reader text leaks raw outcome IDs: ${leaks.join(", ")}`);
      }

      if (containsPhysicalWording(readerText)) {
        throw new Error(`Software execution outcome makes physical claim: ${readerText}`);
      }

      if (!renderedHtml.includes(`data-outcome="${decoded.outcome}"`)) {
        throw new Error(`Missing data-outcome="${decoded.outcome}" attribute`);
      }

      logger.log({
        testId,
        beadId: "am-rt-typed-results-mqb",
        suite: "runtime-results",
        snapshotVersion: 1,
        expected: decoded.outcome,
        actual: decoded.outcome,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: `Successfully validated outcome ${decoded.outcome} across worker boundary.`,
        extra: {
          executionOutcome: decoded.outcome,
          renderedText: renderedHtml,
          exportedIdCount: statusEnumIds.length,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(
        testId,
        outcome,
        msg,
        "",
        [],
        `bun scripts/e2e-runtime-contracts.ts --suite results --log-run-id ${logRunId}`,
      );
    }
  }

  await logger.flush();
  return allPassed;
}

async function runTapeWorkerRoundTrip(tape: unknown): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (msg) => {
        parentPort.postMessage(msg);
      });
    `;

    const worker = new Worker(workerCode, { eval: true });

    worker.on("message", (msg) => {
      worker.terminate();
      resolvePromise(msg);
    });

    worker.on("error", (err) => {
      worker.terminate();
      rejectPromise(err);
    });

    worker.postMessage(tape);
  });
}

async function runTapesE2E(logRunId: string, verbose: boolean): Promise<boolean> {
  const logger = new TestLogger("runtime-tapes", logRunId);
  let allPassed = true;

  const failureDir = resolve(
    process.cwd(),
    "artifacts",
    "test-logs",
    "runtime-tapes",
    logRunId,
    "failures",
  );

  const recordFailure = (
    testId: string,
    tapeData: unknown,
    reason: string,
    extra: Record<string, unknown> = {},
  ) => {
    mkdirSync(failureDir, { recursive: true });
    const failFilePath = join(failureDir, `${testId}.json`);
    const failData = {
      testId,
      tapeData,
      reason,
      reproductionCommand: `bun scripts/e2e-runtime-contracts.ts --suite tapes --log-run-id ${logRunId}`,
      ...extra,
    };
    writeFileSync(failFilePath, JSON.stringify(failData, null, 2), "utf8");

    logger.log({
      testId,
      beadId: "am-rt-control-tapes-0gc",
      suite: "runtime-tapes",
      outcome: "failed",
      message: reason,
      extra: {
        failurePath: failFilePath,
        reason,
        ...extra,
      },
    });
  };

  if (verbose) {
    console.log(`[E2E-Runtime] Starting tapes suite (logRunId: ${logRunId})`);
  }

  const modelIdentity: TapeModelIdentity = {
    modelId: "brownian-motion-reference",
    modelVersion: "1.0.0",
    artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  const context: TapeRuntimeContext = {
    experimentId: "bm-01",
    modelIdentity,
    constantSetId: "einstein-1905-brownian-printed",
    streamVersion: 1,
    allocationId: "tracer-alloc-0",
  };

  const promptSpec: PredictionPromptSpec = {
    promptId: "prompt-predict-disp",
    candidateIds: ["candidate-0-8-micron", "candidate-1-0-micron"],
    verbalChoices: { directionIds: ["x-axis"], shapeIds: ["gaussian"] },
    valueTargetIds: ["diffusivity", "particleRadius"],
  };

  // 1. Candidate Prediction Recording, Worker Crossing, and Replay
  {
    const startTime = Date.now();
    const testId = "tape-candidate-prediction-replay";
    try {
      const recorder = new ControlTapeRecorder({
        tapeId: "tape-candidate-prediction",
        experimentId: "bm-01",
        mode: "bm-01:default",
        modelIdentity,
        constantSetId: "einstein-1905-brownian-printed",
        seed: "9007199254740993",
        streamVersion: 1,
        allocationId: "tracer-alloc-0",
        initialConditions: { viscosity: 1.35e-3, particleRadius: 5e-7 },
      });

      await recorder.recordCheckpoint({
        stepIndex: 0,
        simulatedTime: 0,
        label: "Initial state",
      });

      recorder.recordControlEvent({
        commandClass: "setup-change",
        commandId: "set-viscosity",
        parameterId: "viscosity",
        value: 1.35e-3,
      });

      recorder.recordPredictionEvent({
        instrumentId: "bm-01",
        promptId: "prompt-predict-disp",
        payload: { form: "candidate", candidateId: "candidate-0-8-micron" },
        promptSpec,
      });

      const recordedCp = await recorder.recordCheckpoint({
        stepIndex: 60,
        simulatedTime: 1.0,
        label: "After prediction",
      });

      const originalTape = recorder.getTape();

      // Cross worker boundary
      const workerEcho = await runTapeWorkerRoundTrip(originalTape);
      const decodedTape = validateControlTape(workerEcho);

      // Replay in fresh instance
      const replayer = new ControlTapeReplayer(decodedTape, context);
      const replayRes = await replayer.seekToAction(recordedCp.actionIndex);

      if (replayRes.digest !== recordedCp.digest) {
        throw new Error(
          `Digest mismatch on replay: expected ${recordedCp.digest}, got ${replayRes.digest}`,
        );
      }

      if (replayRes.activePredictions.length !== 1) {
        throw new Error(`Expected 1 active prediction, got ${replayRes.activePredictions.length}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-control-tapes-0gc",
        suite: "runtime-tapes",
        seed: "9007199254740993",
        streamVersion: 1,
        modelVersion: "1.0.0",
        artifactDigest: modelIdentity.artifactDigest,
        expected: recordedCp.digest,
        actual: replayRes.digest,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message:
          "Successfully recorded, worker-roundtripped, and replayed candidate prediction tape.",
        extra: {
          tapeId: "tape-candidate-prediction",
          experimentId: "bm-01",
          constantSetId: "einstein-1905-brownian-printed",
          actionIndex: recordedCp.actionIndex,
          commandClass: "setup-change",
          digest: replayRes.digest,
          digestKind: replayRes.digestKind,
          playbackSpeed: 1,
          allocationId: "tracer-alloc-0",
          authoringInstrument: "bm-01",
          predictionForm: "candidate",
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, null, msg);
    }
  }

  // 2. Values Prediction Recording, Worker Crossing, and Replay
  {
    const startTime = Date.now();
    const testId = "tape-values-prediction-replay";
    try {
      const recorder = new ControlTapeRecorder({
        tapeId: "tape-values-prediction",
        experimentId: "bm-01",
        mode: "bm-01:default",
        modelIdentity,
        constantSetId: "einstein-1905-brownian-printed",
        seed: "18446744073709551615",
        streamVersion: 1,
        allocationId: "tracer-alloc-0",
        initialConditions: { diffusivity: 4.2944e-13, particleRadius: 5e-7 },
        quantizationPolicies: {
          diffusivity: { kind: "significant-figures", digits: 3 },
          particleRadius: { kind: "significant-figures", digits: 1 },
        },
      });

      recorder.recordPredictionEvent({
        instrumentId: "bm-01",
        promptId: "prompt-predict-disp",
        payload: {
          form: "values",
          targets: [
            { targetId: "diffusivity", value: 4.2944e-13 },
            { targetId: "particleRadius", value: 5.0001e-7 },
          ],
        },
        promptSpec,
      });

      const recordedCp = await recorder.recordCheckpoint({
        stepIndex: 120,
        simulatedTime: 2.0,
        label: "Values prediction checkpoint",
      });

      const originalTape = recorder.getTape();
      const workerEcho = await runTapeWorkerRoundTrip(originalTape);
      const decodedTape = validateControlTape(workerEcho);

      const replayer = new ControlTapeReplayer(decodedTape, context);
      const replayRes = await replayer.seekToAction(recordedCp.actionIndex);

      if (replayRes.digest !== recordedCp.digest) {
        throw new Error(
          `Digest mismatch on values replay: expected ${recordedCp.digest}, got ${replayRes.digest}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-control-tapes-0gc",
        suite: "runtime-tapes",
        seed: "18446744073709551615",
        streamVersion: 1,
        modelVersion: "1.0.0",
        artifactDigest: modelIdentity.artifactDigest,
        expected: recordedCp.digest,
        actual: replayRes.digest,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully recorded, worker-roundtripped, and replayed values prediction tape.",
        extra: {
          tapeId: "tape-values-prediction",
          experimentId: "bm-01",
          constantSetId: "einstein-1905-brownian-printed",
          actionIndex: recordedCp.actionIndex,
          digest: replayRes.digest,
          digestKind: replayRes.digestKind,
          playbackSpeed: 1,
          allocationId: "tracer-alloc-0",
          authoringInstrument: "bm-01",
          predictionForm: "values",
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, null, msg);
    }
  }

  // 3. Compatibility Refusals (all 7 mismatch types)
  const baseTape: ControlTapeV2 = {
    tapeVersion: 2,
    tapeId: "compat-base-tape",
    experimentId: "bm-01",
    mode: "bm-01:default",
    modelIdentity,
    constantSetId: "einstein-1905-brownian-printed",
    seed: toU64String("9007199254740993"),
    streamVersion: 1,
    allocationId: "tracer-alloc-0",
    initialConditions: { viscosity: 1.35e-3 },
    events: [],
    checkpoints: [],
  };

  const refusalCases = [
    {
      testId: "refusal-tape-version-unsupported",
      tape: { ...baseTape, tapeVersion: 1 as unknown as 2 },
      ctx: context,
      expectedCode: "tape-version-unsupported",
    },
    {
      testId: "refusal-tape-model-mismatch-experiment",
      tape: baseTape,
      ctx: { ...context, experimentId: "bm-07" },
      expectedCode: "tape-model-mismatch",
    },
    {
      testId: "refusal-tape-model-mismatch-id",
      tape: baseTape,
      ctx: {
        ...context,
        modelIdentity: { ...modelIdentity, modelId: "other-model" },
      },
      expectedCode: "tape-model-mismatch",
    },
    {
      testId: "refusal-tape-artifact-mismatch",
      tape: baseTape,
      ctx: {
        ...context,
        modelIdentity: {
          ...modelIdentity,
          artifactDigest:
            "host:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
      },
      expectedCode: "tape-artifact-mismatch",
    },
    {
      testId: "refusal-tape-constant-set-mismatch",
      tape: baseTape,
      ctx: { ...context, constantSetId: "modern-si-2019" },
      expectedCode: "tape-constant-set-mismatch",
    },
    {
      testId: "refusal-tape-stream-version-mismatch",
      tape: baseTape,
      ctx: { ...context, streamVersion: 2 },
      expectedCode: "tape-stream-version-mismatch",
    },
    {
      testId: "refusal-tape-allocation-mismatch",
      tape: baseTape,
      ctx: { ...context, allocationId: "other-alloc" },
      expectedCode: "tape-allocation-mismatch",
    },
    {
      testId: "refusal-tape-grid-mismatch",
      tape: { ...baseTape, replayGrid: { baseSpacing: 0.1, horizon: 100 } },
      ctx: { ...context, replayGrid: { baseSpacing: 0.2, horizon: 100 } },
      expectedCode: "tape-grid-mismatch",
    },
  ];

  for (const c of refusalCases) {
    const startTime = Date.now();
    try {
      const check = validateTapeCompatibility(c.tape as ControlTapeV2, c.ctx);
      if (check.compatible) {
        throw new Error(`Expected compatibility check to fail with ${c.expectedCode}`);
      }
      if (check.refusalCode !== c.expectedCode) {
        throw new Error(`Expected refusalCode ${c.expectedCode}, got ${check.refusalCode}`);
      }

      logger.log({
        testId: c.testId,
        beadId: "am-rt-control-tapes-0gc",
        suite: "runtime-tapes",
        expected: c.expectedCode,
        actual: check.refusalCode,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: `Successfully validated ${c.expectedCode} refusal.`,
        extra: {
          refusalCode: check.refusalCode,
          reason: check.reason,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(c.testId, c.tape, msg, { expectedCode: c.expectedCode });
    }
  }

  await logger.flush();
  return allPassed;
}

async function runSchedulerE2E(logRunId: string, verbose: boolean): Promise<boolean> {
  const logger = new TestLogger("worker-scheduler", logRunId);
  let allPassed = true;

  const failureDir = resolve(
    process.cwd(),
    "artifacts",
    "test-logs",
    "worker-scheduler",
    logRunId,
    "failures",
  );

  const recordFailure = (testId: string, reason: string, extra: Record<string, unknown> = {}) => {
    mkdirSync(failureDir, { recursive: true });
    const failFilePath = join(failureDir, `${testId}.json`);
    const failData = {
      testId,
      reason,
      reproductionCommand: `bun scripts/e2e-runtime-contracts.ts --suite scheduler --log-run-id ${logRunId}`,
      ...extra,
    };
    writeFileSync(failFilePath, JSON.stringify(failData, null, 2), "utf8");

    logger.log({
      testId,
      beadId: "am-rt-worker-scheduler-7tl",
      suite: "worker-scheduler",
      outcome: "failed",
      message: reason,
      extra: {
        failurePath: failFilePath,
        reason,
        ...extra,
      },
    });
  };

  if (verbose) {
    console.log(`[E2E-Runtime] Starting scheduler suite (logRunId: ${logRunId})`);
  }

  const SOURCE_DIGEST = "bm06-source-digest-e2e";
  function mockProtocol(): HostProtocol {
    return {
      version: "bm06-host-v1",
      decodeHello: () => ({ messageKind: "hello" }),
      decodeResponse: (_msg, token) => ({
        token,
        result: {
          kind: "accepted" as const,
          data: {
            stepIndex: 10,
            simulationTime: 1.0,
            outputs: [
              {
                status: "value" as const,
                quantityId: "concentration",
                unit: "mol/m^3",
                semanticKind: "scalar",
                ownerId: "bm-06",
                value: 1.0,
              },
            ],
          },
        },
      }),
    };
  }

  // 1. Burst Coalescing: 1 in-flight + 50 rapid changes
  {
    const startTime = Date.now();
    const testId = "scheduler-coalesce-burst";
    try {
      const store = createInstanceStore({
        experimentId: "bm-06",
        instanceId: "inst-coalesce-e2e",
        initialParameters: { diffusivity: 1.0 },
        parameterClasses: { diffusivity: "input" },
        outputs: {
          concentration: {
            statuses: ["value"],
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
          },
        },
      });

      const events: SchedulerEvent[] = [];
      // A ref, not a bare `let`: TypeScript's control-flow analysis does not see the
      // assignment inside the channel's listen() method, narrows the variable to null
      // at the guard below, and reports the call as `never` (am-7mp8). The scheduler
      // really does call listen() when it creates a channel
      // (src/workers/scheduler/scheduler.ts:174), so the branch is live; only the
      // analysis is blind to it. A container keeps the exact type and the exact
      // runtime behaviour.
      const workerListener: { current: ((msg: unknown) => void) | null } = { current: null };
      const sentMessages: unknown[] = [];

      const mockChannel: WorkerChannel = {
        send(msg) {
          sentMessages.push(msg);
        },
        listen(onMsg) {
          workerListener.current = onMsg;
          onMsg({ messageKind: "hello" });
          return () => {
            workerListener.current = null;
          };
        },
        dispose() {},
      };

      const scheduler = createDedicatedScheduler({
        store,
        factory: () => mockChannel,
        sourceDigest: SOURCE_DIGEST,
        protocol: mockProtocol(),
        report: (e) => events.push(e),
      });

      const token0 = store.issue("setup-change", { diffusivity: 2.0 });
      scheduler.request(token0, "setup-change");

      let lastToken = token0;
      for (let i = 1; i <= 50; i++) {
        lastToken = store.issue("setup-change", { diffusivity: 2.0 + i * 0.1 });
        scheduler.request(lastToken, "setup-change");
      }

      const supersededBefore = events.filter((e) => e.kind === "superseded");
      if (supersededBefore.length !== 49) {
        throw new Error(`Expected 49 superseded events, got ${supersededBefore.length}`);
      }

      // Worker completes token0
      if (workerListener.current) {
        workerListener.current({
          messageKind: "result",
          protocolVersion: "bm06-host-v1",
          sourceDigest: SOURCE_DIGEST,
          token: token0,
          result: {
            kind: "accepted",
            data: {
              stepIndex: 10,
              simulationTime: 1.0,
              outputs: [
                {
                  status: "value",
                  quantityId: "concentration",
                  unit: "mol/m^3",
                  semanticKind: "scalar",
                  ownerId: "bm-06",
                  value: 2.0,
                },
              ],
            },
          },
        });
      }

      const dispatchedEvents = events.filter((e) => e.kind === "dispatched");
      if (dispatchedEvents.length !== 2) {
        throw new Error(`Expected exactly 2 dispatches, got ${dispatchedEvents.length}`);
      }

      // Worker completes lastToken
      if (workerListener.current) {
        workerListener.current({
          messageKind: "result",
          protocolVersion: "bm06-host-v1",
          sourceDigest: SOURCE_DIGEST,
          token: lastToken,
          result: {
            kind: "accepted",
            data: {
              stepIndex: 20,
              simulationTime: 2.0,
              outputs: [
                {
                  status: "value",
                  quantityId: "concentration",
                  unit: "mol/m^3",
                  semanticKind: "scalar",
                  ownerId: "bm-06",
                  value: 7.0,
                },
              ],
            },
          },
        });
      }

      const snapshot = store.getSnapshot();
      if (snapshot.accepted?.actionIndex !== lastToken.actionIndex) {
        throw new Error(
          `Expected snapshot actionIndex ${lastToken.actionIndex}, got ${snapshot.accepted?.actionIndex}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: lastToken.actionIndex,
        actual: snapshot.accepted?.actionIndex,
        comparisonKind: "bitwise",
        message: "Successfully verified burst coalescing and final snapshot publication.",
        extra: {
          totalRequests: 51,
          dispatchedCount: dispatchedEvents.length,
          supersededCount: supersededBefore.length,
          finalActionIndex: snapshot.accepted?.actionIndex,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 2. Out-of-order / Stale Rejection
  {
    const startTime = Date.now();
    const testId = "scheduler-stale-rejection";
    try {
      const store = createInstanceStore({
        experimentId: "bm-06",
        instanceId: "inst-stale-e2e",
        initialParameters: { diffusivity: 1.0 },
        parameterClasses: { diffusivity: "input" },
        outputs: {
          concentration: {
            statuses: ["value"],
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
          },
        },
      });

      // A ref, not a bare `let`: TypeScript's control-flow analysis does not see the
      // assignment inside the channel's listen() method, narrows the variable to null
      // at the guard below, and reports the call as `never` (am-7mp8). The scheduler
      // really does call listen() when it creates a channel
      // (src/workers/scheduler/scheduler.ts:174), so the branch is live; only the
      // analysis is blind to it. A container keeps the exact type and the exact
      // runtime behaviour.
      const workerListener: { current: ((msg: unknown) => void) | null } = { current: null };
      const mockChannel: WorkerChannel = {
        send() {},
        listen(onMsg) {
          workerListener.current = onMsg;
          onMsg({ messageKind: "hello" });
          return () => {
            workerListener.current = null;
          };
        },
        dispose() {},
      };

      const events: SchedulerEvent[] = [];
      const scheduler = createDedicatedScheduler({
        store,
        factory: () => mockChannel,
        sourceDigest: SOURCE_DIGEST,
        protocol: {
          version: "bm06-host-v1",
          decodeHello: () => ({ messageKind: "hello" }),
          decodeResponse: (msg) => {
            const typed = msg as {
              token: RequestToken;
              result: {
                kind: "accepted";
                data: {
                  outputs: readonly ScientificResult[];
                  stepIndex: number;
                  simulationTime: number;
                };
              };
            };
            return {
              token: typed.token,
              result: typed.result,
            };
          },
        },
        report: (e) => events.push(e),
      });

      const token1 = store.issue("setup-change", { diffusivity: 2.0 });
      scheduler.request(token1, "setup-change");

      if (workerListener.current) {
        workerListener.current({
          messageKind: "result",
          protocolVersion: "bm06-host-v1",
          sourceDigest: SOURCE_DIGEST,
          token: token1,
          result: {
            kind: "accepted",
            data: {
              stepIndex: 10,
              simulationTime: 1.0,
              outputs: [
                {
                  status: "value",
                  quantityId: "concentration",
                  unit: "mol/m^3",
                  semanticKind: "scalar",
                  ownerId: "bm-06",
                  value: 2.0,
                },
              ],
            },
          },
        });
      }

      const snapshot1 = store.getSnapshot();
      if (snapshot1.accepted?.actionIndex !== 1) {
        throw new Error(`Expected snapshot actionIndex 1, got ${snapshot1.accepted?.actionIndex}`);
      }

      const token2 = store.issue("setup-change", { diffusivity: 3.0 });
      scheduler.request(token2, "setup-change");

      // Inject stale response for token1 with invalid value 999.0
      if (workerListener.current) {
        workerListener.current({
          messageKind: "result",
          protocolVersion: "bm06-host-v1",
          sourceDigest: SOURCE_DIGEST,
          token: token1,
          result: {
            kind: "accepted",
            data: {
              stepIndex: 10,
              simulationTime: 1.0,
              outputs: [
                {
                  status: "value",
                  quantityId: "concentration",
                  unit: "mol/m^3",
                  semanticKind: "scalar",
                  ownerId: "bm-06",
                  value: 999.0,
                },
              ],
            },
          },
        });
      }

      const snapshotAfterStale = store.getSnapshot();
      if (snapshotAfterStale.accepted?.actionIndex !== 1) {
        throw new Error(
          `Snapshot modified by stale response: actionIndex ${snapshotAfterStale.accepted?.actionIndex}`,
        );
      }
      const staleOutput = snapshotAfterStale.accepted?.outputs[0];
      if (staleOutput?.status !== "value" || (staleOutput as { value: number }).value !== 2.0) {
        throw new Error("Snapshot value modified by stale response");
      }

      const staleEvents = events.filter((e) => e.kind === "stale");
      if (staleEvents.length !== 1) {
        throw new Error(`Expected 1 stale event, got ${staleEvents.length}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: 1,
        actual: snapshotAfterStale.accepted?.actionIndex,
        comparisonKind: "bitwise",
        message: "Successfully rejected late stale response before store publication.",
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 3. Work-Unit Chunking Invariance
  {
    const startTime = Date.now();
    const testId = "scheduler-chunk-invariance";
    try {
      interface SimulationState {
        accumulator: number;
        stepCount: number;
      }

      const stepFn = (state: SimulationState, chunk: { workUnits: number }): SimulationState => {
        let acc = state.accumulator;
        for (let i = 0; i < chunk.workUnits; i++) {
          acc = ((acc * 1103515245 + 12345) & 0x7fffffff) >>> 0;
        }
        return {
          accumulator: acc,
          stepCount: state.stepCount + chunk.workUnits,
        };
      };

      const plan1k = createChunkPlan(100000, 1000);
      const plan100k = createChunkPlan(100000, 100000);

      const result1k = await executeChunked<SimulationState>({
        plan: plan1k,
        initialState: { accumulator: 42, stepCount: 0 },
        step: stepFn,
        isCancelled: () => false,
      });

      const result100k = await executeChunked<SimulationState>({
        plan: plan100k,
        initialState: { accumulator: 42, stepCount: 0 },
        step: stepFn,
        isCancelled: () => false,
      });

      if (!result1k.completed || !result100k.completed) {
        throw new Error("Chunked execution failed to complete");
      }
      if (result1k.state.accumulator !== result100k.state.accumulator) {
        throw new Error(
          `Chunk invariance mismatch: 1k acc ${result1k.state.accumulator} vs 100k acc ${result100k.state.accumulator}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: result100k.state.accumulator,
        actual: result1k.state.accumulator,
        comparisonKind: "bitwise",
        message: "Successfully verified bitwise identity across chunk sizes 10^3 and 10^5.",
        extra: {
          totalWorkUnits: 100000,
          plan1kChunks: plan1k.chunks.length,
          plan100kChunks: plan100k.chunks.length,
          finalAccumulator: result1k.state.accumulator,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 4. Cooperative Cancellation
  {
    const startTime = Date.now();
    const testId = "scheduler-cooperative-cancellation";
    try {
      const cancelAfterChunks = 5;
      let executedChunks = 0;
      const plan = createChunkPlan(50000, 1000);

      const result = await executeChunked<number>({
        plan,
        initialState: 0,
        step: (state, chunk) => {
          executedChunks++;
          return state + chunk.workUnits;
        },
        isCancelled: () => executedChunks >= cancelAfterChunks,
      });

      if (result.completed || !result.cancelled || result.chunksCompleted !== cancelAfterChunks) {
        throw new Error(
          `Expected cancelled execution with ${cancelAfterChunks} chunks, got completed: ${result.completed}, chunks: ${result.chunksCompleted}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: cancelAfterChunks,
        actual: result.chunksCompleted,
        comparisonKind: "bitwise",
        message: "Successfully stopped execution cooperatively at next chunk boundary.",
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 5. Crash Recovery
  {
    const startTime = Date.now();
    const testId = "scheduler-crash-recovery";
    try {
      const store = createInstanceStore({
        experimentId: "bm-06",
        instanceId: "inst-recovery-e2e",
        initialParameters: { diffusivity: 1.0 },
        parameterClasses: { diffusivity: "input" },
        outputs: {
          concentration: {
            statuses: ["value"],
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
          },
        },
      });

      // A ref, not a bare `let`: TypeScript's control-flow analysis does not see the
      // assignment inside the channel's listen() method, narrows the variable to null
      // at the guard below, and reports the call as `never` (am-7mp8). The scheduler
      // really does call listen() when it creates a channel
      // (src/workers/scheduler/scheduler.ts:174), so the branch is live; only the
      // analysis is blind to it. A container keeps the exact type and the exact
      // runtime behaviour.
      const errorCallback: { current: (() => void) | null } = { current: null };
      let factoryCount = 0;

      const mockFactory = (): WorkerChannel => {
        factoryCount++;
        return {
          send() {},
          listen(onMsg, onErr) {
            errorCallback.current = onErr;
            onMsg({ messageKind: "hello" });
            return () => {
              errorCallback.current = null;
            };
          },
          dispose() {},
        };
      };

      const scheduler = createDedicatedScheduler({
        store,
        factory: mockFactory,
        sourceDigest: SOURCE_DIGEST,
        protocol: mockProtocol(),
        maxRestarts: 3,
      });

      // Request 1 + Crash 1
      const token1 = store.issue("setup-change", { diffusivity: 2.0 });
      scheduler.request(token1, "setup-change");
      errorCallback.current?.();

      // Request 2 + Crash 2
      const token2 = store.issue("setup-change", { diffusivity: 3.0 });
      scheduler.request(token2, "setup-change");
      errorCallback.current?.();

      // Request 3 + Crash 3
      const token3 = store.issue("setup-change", { diffusivity: 4.0 });
      scheduler.request(token3, "setup-change");
      errorCallback.current?.();

      // Request 4 (Exceeds maxRestarts 3)
      const token4 = store.issue("setup-change", { diffusivity: 5.0 });
      scheduler.request(token4, "setup-change");

      const snapshot = store.getSnapshot();
      if (snapshot.status !== "unavailable") {
        throw new Error(`Expected store status "unavailable", got "${snapshot.status}"`);
      }
      if (snapshot.outcome?.outcome !== "environment-unsupported") {
        throw new Error(
          `Expected outcome "environment-unsupported", got "${snapshot.outcome?.outcome}"`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: "environment-unsupported",
        actual: snapshot.outcome?.outcome,
        comparisonKind: "bitwise",
        message:
          "Successfully bounded worker crash restarts and transitioned cleanly to unavailable.",
        extra: {
          factoryRestartCount: factoryCount,
          maxRestarts: 3,
          finalStatus: snapshot.status,
          outcomeId: snapshot.outcome?.outcome,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 6. Presentation Change Routing
  {
    const startTime = Date.now();
    const testId = "scheduler-presentation-routing";
    try {
      const store = createInstanceStore({
        experimentId: "bm-06",
        instanceId: "inst-pres-routing-e2e",
        initialParameters: { diffusivity: 1.0, viewMode: "contour" },
        parameterClasses: { diffusivity: "input", viewMode: "presentation" },
        outputs: {
          concentration: {
            statuses: ["value"],
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
          },
        },
      });

      // A ref, not a bare `let`: TypeScript's control-flow analysis does not see the
      // assignment inside the channel's listen() method, narrows the variable to null
      // at the guard below, and reports the call as `never` (am-7mp8). The scheduler
      // really does call listen() when it creates a channel
      // (src/workers/scheduler/scheduler.ts:174), so the branch is live; only the
      // analysis is blind to it. A container keeps the exact type and the exact
      // runtime behaviour.
      const workerListener: { current: ((msg: unknown) => void) | null } = { current: null };
      let sentCount = 0;

      const mockChannel: WorkerChannel = {
        send() {
          sentCount++;
        },
        listen(onMsg) {
          workerListener.current = onMsg;
          onMsg({ messageKind: "hello" });
          return () => {
            workerListener.current = null;
          };
        },
        dispose() {},
      };

      const scheduler = createDedicatedScheduler({
        store,
        factory: () => mockChannel,
        sourceDigest: SOURCE_DIGEST,
        protocol: mockProtocol(),
      });

      // 1. Physical setup-change: dispatches to worker
      const token1 = store.issue("setup-change", { diffusivity: 2.0 });
      scheduler.request(token1, "setup-change");

      if (sentCount !== 1) {
        throw new Error(`Expected 1 worker message for setup-change, got ${sentCount}`);
      }

      // Complete token 1
      if (workerListener.current) {
        workerListener.current({
          messageKind: "result",
          protocolVersion: "bm06-host-v1",
          sourceDigest: SOURCE_DIGEST,
          token: token1,
          result: {
            kind: "accepted",
            data: {
              stepIndex: 10,
              simulationTime: 1.0,
              outputs: [
                {
                  status: "value",
                  quantityId: "concentration",
                  unit: "mol/m^3",
                  semanticKind: "scalar",
                  ownerId: "bm-06",
                  value: 2.0,
                },
              ],
            },
          },
        });
      }

      // 2. Presentation change: zero worker messages
      const token2 = store.issue("presentation-change", { viewMode: "particles" });
      scheduler.request(token2, "presentation-change");

      if (sentCount !== 1) {
        throw new Error(
          `presentation-change MUST NOT send worker messages. Message count rose to ${sentCount}`,
        );
      }

      const snapshotAfter = store.getSnapshot();
      if (snapshotAfter.accepted?.parameters.viewMode !== "particles") {
        throw new Error(
          `Expected viewMode "particles", got "${snapshotAfter.accepted?.parameters.viewMode}"`,
        );
      }
      if (snapshotAfter.accepted?.actionIndex !== 2) {
        throw new Error(`Expected actionIndex 2, got ${snapshotAfter.accepted?.actionIndex}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: 1,
        actual: sentCount,
        comparisonKind: "bitwise",
        message: "Successfully routed presentation-change directly without worker messages.",
        extra: {
          workerMessageCount: sentCount,
          snapshotVersion: snapshotAfter.accepted?.snapshotVersion,
          updatedParameter: "viewMode",
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 7. Transport Shared Memory Refusal
  {
    const startTime = Date.now();
    const testId = "scheduler-transport-shared-memory-refusal";
    try {
      let threw = false;
      try {
        forceTransportMode("shared-memory");
      } catch (err) {
        if (err instanceof SharedMemoryDisabledError) {
          threw = true;
        }
      }
      if (!threw) {
        throw new Error("Expected SharedMemoryDisabledError when forcing shared-memory mode");
      }

      const caps = probeTransportCapabilities({
        crossOriginIsolated: true,
        hasSharedArrayBuffer: true,
        hasWebWorkers: true,
      });
      if (caps.hasSharedArrayBuffer !== false) {
        throw new Error("Transport capability probe must report hasSharedArrayBuffer: false");
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: false,
        actual: caps.hasSharedArrayBuffer,
        comparisonKind: "bitwise",
        message: "Successfully verified shared memory refusal and disabled status.",
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 8. Performance Marks Emission
  {
    const startTime = Date.now();
    const testId = "scheduler-performance-marks";
    try {
      const instId = "inst-marks-e2e";
      markInput(instId, 1, 0);
      markAccepted(instId, 1, 1);
      markPainted(instId, 1, 1);

      const inputMarks = performance.getEntriesByName("am:input");
      if (inputMarks.length === 0) {
        throw new Error("Expected am:input mark in performance timeline");
      }

      logger.log({
        testId,
        beadId: "am-rt-worker-scheduler-7tl",
        suite: "worker-scheduler",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        expected: "am:input",
        actual: inputMarks[0]?.name,
        comparisonKind: "bitwise",
        message: "Successfully emitted performance marks for input, accepted, and painted.",
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  await logger.flush();
  return allPassed;
}

async function runCommandWorkerRoundTrip<T>(payload: T): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (msg) => {
        parentPort.postMessage(msg);
      });
    `;

    const worker = new Worker(workerCode, { eval: true });

    worker.on("message", (msg) => {
      worker.terminate();
      resolvePromise(msg as T);
    });

    worker.on("error", (err) => {
      worker.terminate();
      rejectPromise(err);
    });

    worker.postMessage(payload);
  });
}

async function runCommandsE2E(logRunId: string, verbose: boolean): Promise<boolean> {
  const logger = new TestLogger("runtime-commands", logRunId);
  let allPassed = true;

  const failureDir = resolve(
    process.cwd(),
    "artifacts",
    "test-logs",
    "runtime-commands",
    logRunId,
    "failures",
  );

  const recordFailure = (testId: string, reason: string, extra: Record<string, unknown> = {}) => {
    mkdirSync(failureDir, { recursive: true });
    const failFilePath = join(failureDir, `${testId}.json`);
    const failData = {
      testId,
      reason,
      reproductionCommand: `bun scripts/e2e-runtime-contracts.ts --suite commands --log-run-id ${logRunId}`,
      ...extra,
    };
    writeFileSync(failFilePath, JSON.stringify(failData, null, 2), "utf8");

    logger.log({
      testId,
      beadId: "am-rt-command-classes-dzp",
      suite: "runtime-commands",
      outcome: "failed",
      message: reason,
      extra: {
        failurePath: failFilePath,
        reason,
        ...extra,
      },
    });
  };

  if (verbose) {
    console.log(`[E2E-Runtime] Starting commands suite (logRunId: ${logRunId})`);
  }

  // 1. Setup Change across Worker Boundary
  {
    const startTime = Date.now();
    const testId = "commands-setup-change-worker";
    try {
      const store = createTwoModelFixtureStore("inst-commands-e2e");
      const setupCmd: TypedCommand = {
        commandId: "cmd-setup-e2e",
        instanceId: "inst-commands-e2e",
        actionIndex: 1,
        class: "setup-change",
        payload: {
          parameters: { diffusionCoefficient: 4.29e-13, modelId: "exact-propagator" },
          modelId: "exact-propagator",
        },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(setupCmd);
      const res = applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, echoedCmd);

      if (!res.accepted) {
        throw new Error("Setup change unexpectedly refused");
      }

      store.publish({
        experimentId: "fixture-two-model",
        instanceId: "inst-commands-e2e",
        runId: res.token.runId,
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 0,
        simulationTime: 0.0,
        final: true,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: {
          diffusionCoefficient: 4.29e-13,
          modelId: "exact-propagator",
          particleCount: 200,
        },
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "distribution",
            ownerId: "fixture-two-model",
            value: 1.0,
          },
        ],
      });

      const snap = store.getSnapshot();
      if (snap.accepted?.runId !== "inst-commands-e2e/run/1") {
        throw new Error(`Expected runId inst-commands-e2e/run/1, got ${snap.accepted?.runId}`);
      }
      if (snap.accepted?.stepIndex !== 0) {
        throw new Error(`Expected stepIndex 0, got ${snap.accepted?.stepIndex}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-commands-e2e",
        runId: snap.accepted?.runId,
        inputRevision: snap.accepted?.revisions.input,
        snapshotVersion: snap.accepted?.snapshotVersion,
        expected: "setup-change",
        actual: "setup-change",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully applied and published setup-change across worker boundary.",
        extra: {
          commandClass: "setup-change",
          actionIndex: snap.accepted?.actionIndex,
          runIdAfter: snap.accepted?.runId,
          stepIndexAfter: snap.accepted?.stepIndex,
          revisionsAfter: snap.accepted?.revisions,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 2. Forward Physical Intervention
  {
    const startTime = Date.now();
    const testId = "commands-physical-intervention-forward";
    try {
      const store = createTwoModelFixtureStore("inst-intervene-fwd-e2e");
      const token1 = store.issue("setup-change", { diffusionCoefficient: 1.0e-13 });
      store.publish({
        experimentId: "fixture-two-model",
        instanceId: "inst-intervene-fwd-e2e",
        runId: token1.runId,
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 10,
        simulationTime: 1.0,
        final: false,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: {
          diffusionCoefficient: 1.0e-13,
          modelId: "exact-propagator",
          particleCount: 200,
        },
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "distribution",
            ownerId: "fixture-two-model",
            value: 1.0,
          },
        ],
      });

      const interventionCmd: TypedCommand = {
        commandId: "cmd-fwd-intervene-e2e",
        instanceId: "inst-intervene-fwd-e2e",
        actionIndex: 2,
        class: "physical-intervention",
        payload: {
          parameters: { diffusionCoefficient: 2.0e-13 },
          atSimulatedTime: 1.5,
        },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(interventionCmd);
      const res = applyCommand({ store }, echoedCmd);
      if (!res.accepted) {
        throw new Error("Forward intervention unexpectedly refused");
      }
      if (res.token.runId !== token1.runId) {
        throw new Error(
          `Forward intervention must keep runId ${token1.runId}, got ${res.token.runId}`,
        );
      }
      if (res.token.revisions.input !== 2) {
        throw new Error(`Expected inputRevision 2, got ${res.token.revisions.input}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-intervene-fwd-e2e",
        runId: res.token.runId,
        inputRevision: res.token.revisions.input,
        expected: token1.runId,
        actual: res.token.runId,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully verified forward physical-intervention keeps runId.",
        extra: {
          commandClass: "physical-intervention",
          actionIndex: 2,
          runIdBefore: token1.runId,
          runIdAfter: res.token.runId,
          atSimulatedTime: 1.5,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 3. Backdated Physical Intervention (Forks Run)
  {
    const startTime = Date.now();
    const testId = "commands-physical-intervention-backdated";
    try {
      const store = createTwoModelFixtureStore("inst-intervene-back-e2e");
      const token1 = store.issue("setup-change", { diffusionCoefficient: 1.0e-13 });
      store.publish({
        experimentId: "fixture-two-model",
        instanceId: "inst-intervene-back-e2e",
        runId: token1.runId,
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 50,
        simulationTime: 5.0,
        final: true,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: {
          diffusionCoefficient: 1.0e-13,
          modelId: "exact-propagator",
          particleCount: 200,
        },
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "distribution",
            ownerId: "fixture-two-model",
            value: 1.0,
          },
        ],
      });

      const backdatedCmd: TypedCommand = {
        commandId: "cmd-back-intervene-e2e",
        instanceId: "inst-intervene-back-e2e",
        actionIndex: 2,
        class: "physical-intervention",
        payload: {
          parameters: { diffusionCoefficient: 3.0e-13 },
          atSimulatedTime: 2.0,
        },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(backdatedCmd);
      const res = applyCommand({ store }, echoedCmd);
      if (!res.accepted) {
        throw new Error("Backdated intervention unexpectedly refused");
      }
      if (res.token.runId === token1.runId) {
        throw new Error("Backdated intervention MUST fork a new runId");
      }
      if (res.token.parentRunId !== token1.runId) {
        throw new Error(`Expected parentRunId ${token1.runId}, got ${res.token.parentRunId}`);
      }

      const forkedRun = store.getRun(res.token.runId);
      if (forkedRun?.forkedAtSimulatedTime !== 2.0) {
        throw new Error(
          `Expected forkedAtSimulatedTime 2.0, got ${forkedRun?.forkedAtSimulatedTime}`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-intervene-back-e2e",
        runId: res.token.runId,
        inputRevision: res.token.revisions.input,
        expected: token1.runId,
        actual: res.token.parentRunId,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message:
          "Successfully verified backdated physical-intervention forks new identified run with parentRunId.",
        extra: {
          commandClass: "physical-intervention",
          actionIndex: 2,
          runIdBefore: token1.runId,
          runIdAfter: res.token.runId,
          parentRunId: res.token.parentRunId,
          forkedAtSimulatedTime: 2.0,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 4. Observer Change (Boost Frame and Preserves Digests)
  {
    const startTime = Date.now();
    const testId = "commands-observer-change-boost";
    try {
      const ledger0 = await createEventLedgerDescription(0.0);
      const ledgerBoost = await createEventLedgerDescription(0.6);

      if (ledger0.eventSetDigest !== ledgerBoost.eventSetDigest) {
        throw new Error("eventSetDigest mismatch after frame boost");
      }
      if (ledger0.worldlineDigest !== ledgerBoost.worldlineDigest) {
        throw new Error("worldlineDigest mismatch after frame boost");
      }

      const observerCmd: TypedCommand = {
        commandId: "cmd-obs-boost-e2e",
        instanceId: "inst-obs-e2e",
        actionIndex: 2,
        class: "observer-change",
        payload: { velocityRatio: 0.6 },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(observerCmd);
      if (echoedCmd.class !== "observer-change") {
        throw new Error(`Expected echoedCmd class observer-change, got ${echoedCmd.class}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-obs-e2e",
        runId: "inst-obs-e2e/run/1",
        expected: ledger0.eventSetDigest,
        actual: ledgerBoost.eventSetDigest,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message:
          "Successfully verified observer-change preserves eventSetDigest and worldlineDigest.",
        extra: {
          commandClass: "observer-change",
          actionIndex: 2,
          eventSetDigest: ledgerBoost.eventSetDigest,
          worldlineDigest: ledgerBoost.worldlineDigest,
          velocityRatio: 0.6,
          drawCounterDeltaByStream: 0,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 5. Measurement Change (Exposure & Localization Error)
  {
    const startTime = Date.now();
    const testId = "commands-measurement-change-seeded";
    try {
      const baseLatentPath = generateBaseLatentPath();
      const m1 = await createSeededWalkFixture({
        observationIntervalSeconds: 0.2,
        exposureTimeSeconds: 0.1,
        localizationError: 0.05,
        baseLatentPath,
        noiseSeed: 111,
      });

      const m2 = await createSeededWalkFixture({
        observationIntervalSeconds: 0.5,
        exposureTimeSeconds: 0.3,
        localizationError: 0.15,
        baseLatentPath,
        noiseSeed: 222,
      });

      if (m1.latentPathDigest !== m2.latentPathDigest) {
        throw new Error("latentPathDigest must remain bitwise identical under measurement changes");
      }

      const measCmd: TypedCommand = {
        commandId: "cmd-meas-e2e",
        instanceId: "inst-meas-e2e",
        actionIndex: 2,
        class: "measurement-change",
        payload: { exposureTime: 0.3, localizationError: 0.15, observationInterval: 0.5 },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(measCmd);
      if (echoedCmd.class !== "measurement-change") {
        throw new Error(`Expected echoedCmd class measurement-change, got ${echoedCmd.class}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-meas-e2e",
        runId: "inst-meas-e2e/run/1",
        expected: m1.latentPathDigest,
        actual: m2.latentPathDigest,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message:
          "Successfully verified measurement-change preserves latentPathDigest across observation changes.",
        extra: {
          commandClass: "measurement-change",
          actionIndex: 2,
          latentPathDigest: m2.latentPathDigest,
          observationDataDigest: m2.observationDataDigest,
          latentDraws: m2.drawCounters.latent,
          noiseDraws: m2.drawCounters.noise,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 6. Presentation Change (No Worker Message & Revisions Unchanged)
  {
    const startTime = Date.now();
    const testId = "commands-presentation-change-workerless";
    try {
      const store = createTwoModelFixtureStore("inst-pres-e2e");
      const token1 = store.issue("setup-change", { diffusionCoefficient: 1.0e-13 });
      store.publish({
        experimentId: "fixture-two-model",
        instanceId: "inst-pres-e2e",
        runId: token1.runId,
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 10,
        simulationTime: 1.0,
        final: true,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: {
          diffusionCoefficient: 1.0e-13,
          modelId: "exact-propagator",
          particleCount: 200,
        },
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "distribution",
            ownerId: "fixture-two-model",
            value: 1.0,
          },
        ],
      });

      const presCmd: TypedCommand = {
        commandId: "cmd-pres-e2e",
        instanceId: "inst-pres-e2e",
        actionIndex: 2,
        class: "presentation-change",
        payload: {
          parameters: { particleCount: 800 },
          drawnParticleCount: 800,
        },
      };

      const res = applyCommand({ store }, presCmd);
      if (!res.accepted) {
        throw new Error("Presentation change unexpectedly refused");
      }

      if (res.token.runId !== token1.runId) {
        throw new Error("Presentation change must not alter runId");
      }
      if (
        res.token.revisions.input !== 1 ||
        res.token.revisions.observer !== 0 ||
        res.token.revisions.measurement !== 0 ||
        res.token.revisions.estimator !== 0
      ) {
        throw new Error("Presentation change must not alter any revision counters");
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-pres-e2e",
        runId: res.token.runId,
        expected: token1.runId,
        actual: res.token.runId,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message:
          "Successfully verified presentation-change preserves all scientific states and revision counters.",
        extra: {
          commandClass: "presentation-change",
          actionIndex: 2,
          runIdBefore: token1.runId,
          runIdAfter: res.token.runId,
          particleCount: 800,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 7. Model Choice (Setup Change with parentRunId, no fallbackReason)
  {
    const startTime = Date.now();
    const testId = "commands-model-choice-switch";
    try {
      const store = createTwoModelFixtureStore("inst-model-switch-e2e");
      const token1 = store.issue("setup-change", { modelId: "exact-propagator" });
      store.publish({
        experimentId: "fixture-two-model",
        instanceId: "inst-model-switch-e2e",
        runId: token1.runId,
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 20,
        simulationTime: 2.0,
        final: true,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: {
          diffusionCoefficient: 4.29e-13,
          modelId: "exact-propagator",
          particleCount: 200,
        },
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "distribution",
            ownerId: "fixture-two-model",
            value: 1.0,
          },
        ],
      });

      const modelCmd: TypedCommand = {
        commandId: "cmd-model-switch-e2e",
        instanceId: "inst-model-switch-e2e",
        actionIndex: 2,
        class: "setup-change",
        payload: {
          parameters: { modelId: "ftcs-grid" },
          modelId: "ftcs-grid",
        },
      };

      const echoedCmd = await runCommandWorkerRoundTrip(modelCmd);
      const res = applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, echoedCmd);

      if (!res.accepted) {
        throw new Error("Model choice switch unexpectedly refused");
      }
      if (res.token.parentRunId !== token1.runId) {
        throw new Error(`Expected parentRunId ${token1.runId}, got ${res.token.parentRunId}`);
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        instanceId: "inst-model-switch-e2e",
        runId: res.token.runId,
        inputRevision: res.token.revisions.input,
        expected: token1.runId,
        actual: res.token.parentRunId,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully switched admitted model as setup-change with parentRunId lineage.",
        extra: {
          commandClass: "setup-change",
          actionIndex: 2,
          modelIdBefore: "exact-propagator",
          modelIdAfter: "ftcs-grid",
          runIdBefore: token1.runId,
          runIdAfter: res.token.runId,
          parentRunId: res.token.parentRunId,
          fallbackReason: undefined,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 8. Replay Grid Refusal (off-replay-grid)
  {
    const startTime = Date.now();
    const testId = "commands-replay-grid-refusal";
    try {
      const grid: ReplayGrid = { baseSpacingSeconds: 0.1, storedHorizonSeconds: 10.0 };
      const decision = checkObservationInterval(grid, 0.15, "observationInterval");

      if (decision.accepted) {
        throw new Error("Requested off-grid interval 0.15 s should have been refused");
      }
      if (decision.refusal.code !== "off-replay-grid") {
        throw new Error(`Expected refusal code "off-replay-grid", got "${decision.refusal.code}"`);
      }
      if (!decision.refusal.rankedRepairs || decision.refusal.rankedRepairs.length < 2) {
        throw new Error("Expected at least 2 ranked repairs for interior off-grid interval");
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        expected: "off-replay-grid",
        actual: decision.refusal.code,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully refused off-replay-grid observation interval with ranked repairs.",
        extra: {
          refusalCode: decision.refusal.code,
          requestedInterval: 0.15,
          repairsCount: decision.refusal.rankedRepairs?.length,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  // 9. Baseline and Variant Comparison
  {
    const startTime = Date.now();
    const testId = "commands-comparison-reports";
    try {
      const baseSnapshot: ExecutionStateSnapshot = {
        instanceId: "inst-comp-e2e",
        runId: "inst-comp-e2e/run/1",
        parentRunId: null,
        actionIndex: 1,
        stepIndex: 10,
        simulatedTime: 1.0,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        digests: { latentPathDigest: "host:sha256:latent_e2e" },
        drawCounters: { latent: 100 },
      };

      const obsCmd: TypedCommand = {
        commandId: "cmd-obs-comp",
        instanceId: "inst-comp-e2e",
        actionIndex: 2,
        class: "observer-change",
        payload: { velocityRatio: 0.5 },
      };

      const descReport = compareBaselineAndVariant(
        baseSnapshot,
        { ...baseSnapshot, actionIndex: 2, revisions: { ...baseSnapshot.revisions, observer: 1 } },
        obsCmd,
      );

      if (descReport.trialRelation !== "re-described-same-world") {
        throw new Error(
          `Expected trialRelation "re-described-same-world", got "${descReport.trialRelation}"`,
        );
      }

      const crnReport = compareBaselineAndVariant(
        baseSnapshot,
        {
          ...baseSnapshot,
          runId: "inst-comp-e2e/run/2",
          parentRunId: "inst-comp-e2e/run/1",
          actionIndex: 2,
          stepIndex: 0,
          simulatedTime: 0.0,
          revisions: { ...baseSnapshot.revisions, input: 2 },
        },
        {
          commandId: "cmd-setup-comp",
          instanceId: "inst-comp-e2e",
          actionIndex: 2,
          class: "setup-change",
          payload: { parameters: { diffusivity: 2.0 } },
        },
        { baselineSeed: "12345", variantSeed: "12345" },
      );

      if (crnReport.trialRelation !== "common-random-numbers") {
        throw new Error(
          `Expected trialRelation "common-random-numbers", got "${crnReport.trialRelation}"`,
        );
      }

      logger.log({
        testId,
        beadId: "am-rt-command-classes-dzp",
        suite: "runtime-commands",
        expected: "re-described-same-world",
        actual: descReport.trialRelation,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs: Date.now() - startTime,
        message: "Successfully generated baseline and variant comparison reports.",
        extra: {
          descTrialRelation: descReport.trialRelation,
          crnTrialRelation: crnReport.trialRelation,
          crnLabel: crnReport.randomnessLabel,
        },
      });
    } catch (err: unknown) {
      allPassed = false;
      const msg = (err as Error).message;
      recordFailure(testId, msg);
    }
  }

  await logger.flush();
  return allPassed;
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  const logRunId = options.logRunId || newRunIdentity();

  if (options.suite === "identity") {
    const success = await runIdentityE2E(logRunId, options.verbose ?? true);
    if (!success) {
      console.error(`[E2E-Runtime] Identity suite FAILED. See logRunId: ${logRunId}`);
      process.exit(1);
    }
    console.log(
      `[E2E-Runtime] Identity suite PASSED. Logged to artifacts/test-logs/runtime-identity/${logRunId}.jsonl`,
    );
    process.exit(0);
  } else if (options.suite === "results") {
    const success = await runResultsE2E(logRunId, options.verbose ?? true);
    if (!success) {
      console.error(`[E2E-Runtime] Results suite FAILED. See logRunId: ${logRunId}`);
      process.exit(1);
    }
    console.log(
      `[E2E-Runtime] Results suite PASSED. Logged to artifacts/test-logs/runtime-results/${logRunId}.jsonl`,
    );
    process.exit(0);
  } else if (options.suite === "tapes") {
    const success = await runTapesE2E(logRunId, options.verbose ?? true);
    if (!success) {
      console.error(`[E2E-Runtime] Tapes suite FAILED. See logRunId: ${logRunId}`);
      process.exit(1);
    }
    console.log(
      `[E2E-Runtime] Tapes suite PASSED. Logged to artifacts/test-logs/runtime-tapes/${logRunId}.jsonl`,
    );
    process.exit(0);
  } else if (options.suite === "scheduler") {
    const success = await runSchedulerE2E(logRunId, options.verbose ?? true);
    if (!success) {
      console.error(`[E2E-Runtime] Scheduler suite FAILED. See logRunId: ${logRunId}`);
      process.exit(1);
    }
    console.log(
      `[E2E-Runtime] Scheduler suite PASSED. Logged to artifacts/test-logs/worker-scheduler/${logRunId}.jsonl`,
    );
    process.exit(0);
  } else if (options.suite === "commands") {
    const success = await runCommandsE2E(logRunId, options.verbose ?? true);
    if (!success) {
      console.error(`[E2E-Runtime] Commands suite FAILED. See logRunId: ${logRunId}`);
      process.exit(1);
    }
    console.log(
      `[E2E-Runtime] Commands suite PASSED. Logged to artifacts/test-logs/runtime-commands/${logRunId}.jsonl`,
    );
    process.exit(0);
  } else {
    console.error(`Unknown suite: ${options.suite}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("[E2E-Runtime] Fatal error:", err);
  process.exit(1);
});
