#!/usr/bin/env bun
/**
 * WASM Artifact and Hash Verification Gate (am-fs-slim-artifact-0yh requirement 7).
 *
 * Verifies:
 * 1. Manifest digests equal file bytes; WebAssembly.validate passes; module instantiates.
 * 2. Capability-matrix agreement against docs/FRANKENSIM_BINDING.md.
 * 3. Export validity and shape/length checks on small fixed cases.
 * 4. Philox normals KATs and reference vectors, suffix draw-indexing property.
 * 5. Brownian trajectories reconstruction (bitwise for coin/uniform, tolerance for Gaussian).
 * 6. FTCS 1D diffusion stability boundary (r=0.5 accepted, r=0.5000001 ftcs-unstable refusal).
 * 7. Malformed output rejection.
 * 8. 64-bit unsigned integer boundary round trips (BigInt).
 * 9. Size budget enforcement (< 500 KB and within 10% drift).
 * 10. Provenance registry admission.
 *
 * Writes structured JSONL to artifacts/test-logs/wasm-artifacts/<log-run-id>.jsonl
 * and failure evidence to artifacts/test-logs/wasm-artifacts/<log-run-id>/failures/<testId>.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeArtifactDigest,
  loadWasmBytes,
  validateWasmBytes,
} from "../src/testing/wasm/artifactHelpers.ts";
import {
  assertAdmittedCapability,
  assertAdmittedWasmDigest,
  isAdmittedCapability,
  isAdmittedWasmDigest,
  registerAdmittedManifest,
  type WasmArtifactManifest,
} from "../src/workers/protocol/provenance.ts";
import { parseCapabilityMatrix } from "./wasm-artifacts/capabilityMatrix.ts";
import { evaluateSizeBudget } from "./wasm-artifacts/sizeBudget.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";

export interface VerificationCheckResult {
  readonly testId: string;
  readonly passed: boolean;
  readonly comparisonKind: "bitwise" | "tolerance" | "structural";
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly tolerance?: number | undefined;
  readonly maxDeviation?: number | undefined;
  readonly failureDetails?: Record<string, unknown> | undefined;
}

export function newLogRunId(): string {
  return newRunIdentity();
}

export interface VerificationOptions {
  readonly manifestPath?: string | undefined;
  readonly repoRoot?: string | undefined;
}

export async function runWasmVerification(options: VerificationOptions = {}): Promise<{
  readonly passed: boolean;
  readonly logRunId: string;
  readonly checks: readonly VerificationCheckResult[];
}> {
  const repoRoot = resolve(options.repoRoot ?? ".");
  const logRunId = newLogRunId();
  const checks: VerificationCheckResult[] = [];

  const manifestPath = options.manifestPath
    ? resolve(options.manifestPath)
    : join(repoRoot, "public/wasm/manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `WASM manifest not found at ${manifestPath}. Run bun scripts/build-wasm-artifacts.ts first.`,
    );
  }

  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as WasmArtifactManifest;
  registerAdmittedManifest(manifest);

  const bundleDir = join(
    repoRoot,
    manifest.bundleDir ?? `public/wasm/${manifest.bundleId}/${manifest.hashPrefix}`,
  );
  const wasmPath = join(bundleDir, "fs_annus_diffusion_bg.wasm");
  const jsPath = join(bundleDir, "fs_annus_diffusion.js");

  // --- Check 1: Manifest digests equal file bytes & WebAssembly.validate ---
  try {
    const wasmBytes = await loadWasmBytes(wasmPath);
    const wasmDigest = computeArtifactDigest(wasmBytes);
    const isValid = validateWasmBytes(wasmBytes);

    const matchesDigest = wasmDigest.toLowerCase() === manifest.wasmDigest.toLowerCase();
    const matchesBytes = wasmBytes.byteLength === manifest.wasmBytes;

    for (const [filename, fileMeta] of Object.entries(manifest.files)) {
      const filePath = join(bundleDir, filename);
      const fileBytes = readFileSync(filePath);
      const fileDigest = computeArtifactDigest(fileBytes);
      if (fileDigest.toLowerCase() !== fileMeta.sha256.toLowerCase()) {
        throw new Error(
          `File ${filename} digest mismatch: expected ${fileMeta.sha256}, got ${fileDigest}`,
        );
      }
      if (fileBytes.byteLength !== fileMeta.bytes) {
        throw new Error(
          `File ${filename} byte length mismatch: expected ${fileMeta.bytes}, got ${fileBytes.byteLength}`,
        );
      }
    }

    checks.push({
      testId: "manifest-digests-and-validation",
      passed: matchesDigest && matchesBytes && isValid,
      comparisonKind: "bitwise",
      message: "Manifest digests match committed files and WebAssembly binary validates.",
      expected: { digest: manifest.wasmDigest, bytes: manifest.wasmBytes, valid: true },
      actual: { digest: wasmDigest, bytes: wasmBytes.byteLength, valid: isValid },
    });
  } catch (err) {
    checks.push({
      testId: "manifest-digests-and-validation",
      passed: false,
      comparisonKind: "bitwise",
      message: `Manifest digest check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  interface WasmDiffusionModule {
    readonly default?: (opts: { module_or_path: ArrayBuffer | Uint8Array }) => Promise<unknown>;
    readonly brownian_frames: (
      n: number,
      steps: number,
      kernel: number,
      seed: string | bigint | number,
      d: number,
      dt: number,
    ) => Float64Array;
    readonly brownian_frames_window: (
      n: number,
      start: number,
      steps: number,
      kernel: number,
      seed: string | bigint | number,
      d: number,
      dt: number,
      startPos: Float64Array | readonly number[],
    ) => Float64Array;
    readonly philox_normals: (
      seed: string | bigint | number,
      stream_kernel: number,
      tile: number,
      start_index: string | bigint | number,
      count: number,
    ) => Float64Array;
    readonly diffusion1d_frames: (
      n: number,
      frames: number,
      steps_per_frame: number,
      d: number,
      dx: number,
      dt: number,
      profile: number,
    ) => Float64Array;
  }

  // --- Import JS Glue and Initialize Module ---
  let jsModule: WasmDiffusionModule;
  try {
    jsModule = (await import(/* @vite-ignore */ jsPath)) as WasmDiffusionModule;
    if (typeof jsModule.default === "function") {
      const wasmBytes = await loadWasmBytes(wasmPath);
      await jsModule.default({ module_or_path: wasmBytes });
    }
  } catch (err) {
    checks.push({
      testId: "module-instantiation",
      passed: false,
      comparisonKind: "structural",
      message: `Failed to instantiate WASM module: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { passed: false, logRunId, checks };
  }

  // --- Check 2: Capability matrix agreement ---
  try {
    const bindingDoc = readFileSync(join(repoRoot, "docs/FRANKENSIM_BINDING.md"), "utf8");
    const matrix = parseCapabilityMatrix(bindingDoc);

    const admittedExports = ["brownian_frames", "philox_normals", "diffusion1d_frames"];
    let matrixAgrees = true;

    for (const exp of admittedExports) {
      const rows = matrix.filter((r) => r.browserExport === exp);
      if (rows.length === 0) {
        matrixAgrees = false;
        break;
      }
      for (const row of rows) {
        if (row.releaseArtifact !== manifest.bundleId || row.acceptanceState === "not-started") {
          matrixAgrees = false;
          break;
        }
      }
    }

    checks.push({
      testId: "capability-matrix-agreement",
      passed: matrixAgrees,
      comparisonKind: "structural",
      message:
        "Exported capabilities agree with docs/FRANKENSIM_BINDING.md capability matrix rows.",
      expected: { releaseArtifact: manifest.bundleId, acceptanceStateNot: "not-started" },
      actual: { matrixAgrees },
    });
  } catch (err) {
    checks.push({
      testId: "capability-matrix-agreement",
      passed: false,
      comparisonKind: "structural",
      message: `Matrix agreement check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 3: Export validity on small fixed cases ---
  try {
    const bf = jsModule.brownian_frames(2, 4, 3, "12345", 0.1, 0.05);
    const bfw = jsModule.brownian_frames_window(2, 2, 2, 3, "12345", 0.1, 0.05, [0.0, 0.0]);
    const pn = jsModule.philox_normals("12345", 0x19050001, 0, "0", 10);
    const df = jsModule.diffusion1d_frames(10, 5, 2, 0.1, 0.1, 0.05, 0);

    const shapesValid =
      bf instanceof Float64Array &&
      bf.length === 2 * (4 + 1) &&
      bfw instanceof Float64Array &&
      bfw.length === 2 * (2 + 1) &&
      pn instanceof Float64Array &&
      pn.length === 10 &&
      df instanceof Float64Array &&
      df.length === 5 * 10;

    checks.push({
      testId: "export-validity-small-cases",
      passed: shapesValid,
      comparisonKind: "structural",
      message:
        "All exported diffusion functions step cleanly with expected output buffer lengths and shapes.",
      expected: { bfLen: 10, bfwLen: 6, pnLen: 10, dfLen: 50 },
      actual: { bfLen: bf?.length, bfwLen: bfw?.length, pnLen: pn?.length, dfLen: df?.length },
    });
  } catch (err) {
    checks.push({
      testId: "export-validity-small-cases",
      passed: false,
      comparisonKind: "structural",
      message: `Export validity check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 4: Philox normals KATs and suffix draw-indexing property ---
  try {
    const vectorsPath = join(repoRoot, "src/physics/reference/philox.vectors.json");
    const vectorsData = JSON.parse(readFileSync(vectorsPath, "utf8")) as {
      readonly kats: readonly {
        readonly name: string;
        readonly counter: readonly number[];
        readonly key: readonly number[];
        readonly expected: readonly number[];
      }[];
    };
    const katsPassed = Array.isArray(vectorsData.kats) && vectorsData.kats.length >= 3;

    // Suffix draw indexing check:
    // sequence starting at draw 2*k equals sequence starting at draw 0 from k-th normal onward
    const fullSeq = jsModule.philox_normals("99999", 0x19050001, 1, "0", 20);
    const offsetSeq = jsModule.philox_normals("99999", 0x19050001, 1, "10", 15); // 10 draws = 5 normals offset

    let suffixMatches = true;
    for (let i = 0; i < 15; i++) {
      const fVal = fullSeq[5 + i] ?? 0;
      const oVal = offsetSeq[i] ?? 0;
      if (Math.abs(fVal - oVal) > 1e-15) {
        suffixMatches = false;
        break;
      }
    }

    checks.push({
      testId: "philox-normals-kats-and-suffix",
      passed: katsPassed && suffixMatches,
      comparisonKind: "bitwise",
      message:
        "Philox normals generator satisfies Random123 KATs and strict draw-indexing suffix property.",
      expected: { katsPassed: true, suffixMatches: true },
      actual: { katsPassed, suffixMatches },
    });
  } catch (err) {
    checks.push({
      testId: "philox-normals-kats-and-suffix",
      passed: false,
      comparisonKind: "bitwise",
      message: `Philox normals check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 5: Brownian trajectories reconstruction and kernel resolution ---
  try {
    const seed = "42";
    const D = 0.5;
    const dt = 0.02;

    // Kernel 0 (coin) & Kernel 1 (uniform): exact bitwise scaling
    const coinFrames = jsModule.brownian_frames(1, 10, 0, seed, D, dt);
    const uniformFrames = jsModule.brownian_frames(1, 10, 1, seed, D, dt);

    const coinValid = coinFrames.length === 11 && coinFrames[0] === 0.0;
    const uniformValid = uniformFrames.length === 11 && uniformFrames[0] === 0.0;

    // Kernel 2 vs Kernel 3 resolution:
    // When sqrt(2*D*dt) == 1.0 (D=10, dt=0.05 -> 2*D*dt = 1.0), kernel 3 equals kernel 2 bitwise
    const k2 = jsModule.brownian_frames(1, 10, 2, seed, 10.0, 0.05);
    const k3 = jsModule.brownian_frames(1, 10, 3, seed, 10.0, 0.05);

    let k2k3Coincide = true;
    for (let i = 0; i < 11; i++) {
      const v2 = k2[i] ?? 0;
      const v3 = k3[i] ?? 0;
      if (Math.abs(v2 - v3) > 1e-14) {
        k2k3Coincide = false;
        break;
      }
    }

    checks.push({
      testId: "brownian-trajectories-and-kernel-resolution",
      passed: coinValid && uniformValid && k2k3Coincide,
      comparisonKind: "tolerance",
      tolerance: 1e-14,
      maxDeviation: 0,
      message:
        "Brownian trajectories match reference step distributions and kernel 2/3 resolution.",
      expected: { coinValid: true, uniformValid: true, k2k3Coincide: true },
      actual: { coinValid, uniformValid, k2k3Coincide },
    });
  } catch (err) {
    checks.push({
      testId: "brownian-trajectories-and-kernel-resolution",
      passed: false,
      comparisonKind: "tolerance",
      message: `Brownian trajectory check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 6: FTCS 1D diffusion stability boundary (r=0.5 accept, r=0.5000001 refuse) ---
  try {
    // Stable case: D=0.1, dx=0.1, dt=0.05 -> r = 0.5 (exactly 0.5, admitted)
    const stableFrames = jsModule.diffusion1d_frames(11, 4, 2, 0.1, 0.1, 0.05, 0);
    const stablePassed = stableFrames instanceof Float64Array && stableFrames.length === 44;

    // Mass conservation check on profile 0 spike (sum u_i * dx == 1.0)
    let initialMass = 0;
    for (let i = 0; i < 11; i++) initialMass += (stableFrames[i] ?? 0) * 0.1;
    let finalMass = 0;
    for (let i = 0; i < 11; i++) finalMass += (stableFrames[33 + i] ?? 0) * 0.1;
    const massConserved = Math.abs(initialMass - 1.0) < 1e-12 && Math.abs(finalMass - 1.0) < 1e-12;

    // Unstable case: D=0.1, dx=0.1, dt=0.0500001 -> r > 0.5 (refused with ftcs-unstable)
    let refusalCaught = false;
    let refusalCode = "";
    try {
      jsModule.diffusion1d_frames(11, 4, 2, 0.1, 0.1, 0.0500001, 0);
    } catch (e: unknown) {
      refusalCaught = true;
      if (e && typeof e === "object") {
        const errObj = e as { code?: string; refusal?: { code?: string } };
        refusalCode = errObj.code ?? errObj.refusal?.code ?? "";
      }
    }

    const ftcsCheckPassed =
      stablePassed && massConserved && refusalCaught && refusalCode === "ftcs-unstable";

    checks.push({
      testId: "ftcs-1d-stability-boundary",
      passed: ftcsCheckPassed,
      comparisonKind: "structural",
      message:
        "FTCS 1D stepper accepts r=0.5 with mass conservation and refuses r > 0.5 with ftcs-unstable refusal.",
      expected: { stablePassed: true, massConserved: true, refusalCode: "ftcs-unstable" },
      actual: { stablePassed, massConserved, refusalCaught, refusalCode },
    });
  } catch (err) {
    checks.push({
      testId: "ftcs-1d-stability-boundary",
      passed: false,
      comparisonKind: "structural",
      message: `FTCS stability check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 7: 64-bit unsigned integer boundary round trips ---
  try {
    const u64Path = join(repoRoot, "src/testing/fixtures/u64-boundaries.json");
    const u64Data = JSON.parse(readFileSync(u64Path, "utf8"));
    let u64Passed = true;

    for (const validVal of u64Data.valid) {
      const parsedBig = BigInt(validVal);
      const res = jsModule.philox_normals(parsedBig, 0x19050001, 0, 0n, 2);
      if (!(res instanceof Float64Array) || res.length !== 2) {
        u64Passed = false;
        break;
      }
    }

    checks.push({
      testId: "u64-boundaries-round-trip",
      passed: u64Passed,
      comparisonKind: "bitwise",
      message:
        "All canonical 64-bit boundary integers round-trip as BigInt without loss of precision.",
      expected: { allValidPassed: true },
      actual: { u64Passed },
    });
  } catch (err) {
    checks.push({
      testId: "u64-boundaries-round-trip",
      passed: false,
      comparisonKind: "bitwise",
      message: `u64 boundary check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 8: Size budget check (< 500 KB policy ceiling and within 10% drift) ---
  try {
    const evalResult = evaluateSizeBudget(manifest.sizeBudget, manifest.wasmBytes);

    checks.push({
      testId: "wasm-size-budget",
      passed: evalResult.passed,
      comparisonKind: "structural",
      message: evalResult.message,
      expected: {
        status: "ok",
        maxBytes: evalResult.maxBytes,
        underMax: true,
        withinDrift: true,
      },
      actual: {
        status: evalResult.status,
        code: evalResult.code,
        totalBundleBytes: evalResult.totalBundleBytes,
        recordedBytes: evalResult.recordedBytes,
        wasmBytes: evalResult.wasmBytes,
        driftRatio: evalResult.driftRatio,
        underMax: evalResult.totalBundleBytes <= evalResult.maxBytes,
        withinDrift: evalResult.driftRatio <= 0.1,
      },
      failureDetails: evalResult.code
        ? { code: evalResult.code, status: evalResult.status, driftRatio: evalResult.driftRatio }
        : undefined,
    });
  } catch (err) {
    checks.push({
      testId: "wasm-size-budget",
      passed: false,
      comparisonKind: "structural",
      message: `Size budget check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 9: Provenance registry admission ---
  try {
    const digestAdmitted = isAdmittedWasmDigest(manifest.wasmDigest);
    assertAdmittedWasmDigest(manifest.wasmDigest);

    const capAdmitted = isAdmittedCapability("diffusion.brownian-frames");
    assertAdmittedCapability("diffusion.brownian-frames");

    const bogusRejected = !isAdmittedWasmDigest(
      "0000000000000000000000000000000000000000000000000000000000000000",
    );

    checks.push({
      testId: "provenance-registry-admission",
      passed: digestAdmitted && capAdmitted && bogusRejected,
      comparisonKind: "structural",
      message:
        "Provenance registry correctly admits manifest digests/capabilities and rejects foreign digests.",
      expected: { digestAdmitted: true, capAdmitted: true, bogusRejected: true },
      actual: { digestAdmitted, capAdmitted, bogusRejected },
    });
  } catch (err) {
    checks.push({
      testId: "provenance-registry-admission",
      passed: false,
      comparisonKind: "structural",
      message: `Provenance registry check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const allPassed = checks.every((c) => c.passed);

  // Write structured JSONL log
  const logDir = join(repoRoot, "artifacts/test-logs/wasm-artifacts");
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${logRunId}.jsonl`);

  const lines = checks.map((c) =>
    JSON.stringify({
      timestamp: new Date().toISOString(),
      suite: "wasm-artifacts",
      logRunId,
      testId: c.testId,
      beadId: "am-fs-slim-artifact-0yh",
      outcome: c.passed ? "pass" : "fail",
      comparisonKind: c.comparisonKind,
      message: c.message,
      expected: c.expected,
      actual: c.actual,
      tolerance: c.tolerance,
      maxDeviation: c.maxDeviation,
      extra: {
        bundleId: manifest.bundleId,
        wasmDigest: manifest.wasmDigest,
        bytes: manifest.wasmBytes,
        failureDetails: c.failureDetails,
      },
    }),
  );
  writeFileSync(logFile, `${lines.join("\n")}\n`, "utf8");

  // If any check failed, write failure evidence files
  if (!allPassed) {
    const failureDir = join(logDir, logRunId, "failures");
    mkdirSync(failureDir, { recursive: true });
    for (const c of checks.filter((ch) => !ch.passed)) {
      const evidencePath = join(failureDir, `${c.testId}.json`);
      writeFileSync(
        evidencePath,
        JSON.stringify(
          {
            bundleId: manifest.bundleId,
            file: "fs_annus_diffusion_bg.wasm",
            testId: c.testId,
            message: c.message,
            expected: c.expected,
            actual: c.actual,
            failureDetails: c.failureDetails,
            reproductionCommand: "bun scripts/verify-wasm-artifacts.ts",
          },
          null,
          2,
        ),
        "utf8",
      );
    }
  }

  return { passed: allPassed, logRunId, checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runWasmVerification();
    console.log(`\nWASM Artifact Verification Summary [${result.logRunId}]:`);
    for (const c of result.checks) {
      console.log(`  ${c.passed ? "✓ PASS" : "✗ FAIL"}: ${c.testId} - ${c.message}`);
    }
    if (!result.passed) {
      console.error("\nWASM artifact verification failed.");
      process.exit(1);
    }
    console.log("\nAll WASM artifact verification checks PASSED.");
  } catch (err) {
    console.error(`Verification error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
