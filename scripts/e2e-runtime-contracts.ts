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
import { parseWithU64, stringifyWithU64 } from "../src/experiments/identity/jsonCodec.ts";
import { parseU64, type U64String, U64ValidationError } from "../src/experiments/identity/u64.ts";
import { encodeU64QueryParams, getU64QueryParam } from "../src/experiments/identity/urlCodec.ts";
import { createStreamKey } from "../src/experiments/streams/allocation.ts";
import { createPhiloxStream } from "../src/physics/reference/philox.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";

interface CliOptions {
  suite: string;
  logRunId?: string;
  verbose?: boolean;
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
  } else {
    console.error(`Unknown suite: ${options.suite}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("[E2E-Runtime] Fatal error:", err);
  process.exit(1);
});
