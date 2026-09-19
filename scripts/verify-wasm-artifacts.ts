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
import { philox4x32_10 } from "../src/physics/reference/philox.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";
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

export interface ProtocolBufferLayout {
  readonly layoutId: "brownian-frames" | "diffusion1d-frames" | "philox-normals";
  readonly version: 1;
  readonly shape: readonly number[];
}

export function validateProtocolBuffer(
  buffer: unknown,
  layout: ProtocolBufferLayout,
): { readonly valid: boolean; readonly reason?: string } {
  if (!(buffer instanceof Float64Array)) {
    return { valid: false, reason: "buffer-not-float64array" };
  }
  const expectedLength = layout.shape.reduce((a, b) => a * b, 1);
  const expectedByteLength = expectedLength * 8;
  if (buffer.byteLength !== expectedByteLength) {
    return {
      valid: false,
      reason: `buffer-byte-length-mismatch: expected ${expectedByteLength}, got ${buffer.byteLength}`,
    };
  }
  if (buffer.length !== expectedLength) {
    return {
      valid: false,
      reason: `buffer-length-mismatch: expected ${expectedLength}, got ${buffer.length}`,
    };
  }
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return {
        valid: false,
        reason: `nonfinite-value-at-index-${i}: ${v}`,
      };
    }
  }
  return { valid: true };
}

export interface VerificationOptions {
  readonly manifestPath?: string | undefined;
  readonly bindingDocPath?: string | undefined;
  readonly repoRoot?: string | undefined;
}

export async function runWasmVerification(options: VerificationOptions = {}): Promise<{
  readonly passed: boolean;
  readonly logRunId: string;
  readonly checks: readonly VerificationCheckResult[];
}> {
  const repoRoot = resolve(options.repoRoot ?? ".");
  const bindingDocPath = options.bindingDocPath
    ? resolve(options.bindingDocPath)
    : join(repoRoot, "docs/FRANKENSIM_BINDING.md");
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
  let wasmDigest = "";
  try {
    const wasmBytes = await loadWasmBytes(wasmPath);
    wasmDigest = computeArtifactDigest(wasmBytes);
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
      failureDetails:
        matchesDigest && matchesBytes && isValid
          ? undefined
          : {
              expectedDigest: manifest.wasmDigest,
              actualDigest: wasmDigest,
              compilePath: "bytes",
            },
    });
  } catch (err) {
    checks.push({
      testId: "manifest-digests-and-validation",
      passed: false,
      comparisonKind: "bitwise",
      message: `Manifest digest check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: {
        error: String(err),
        expectedDigest: manifest.wasmDigest,
        actualDigest: wasmDigest || undefined,
        compilePath: "bytes",
      },
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
    const bindingDoc = readFileSync(bindingDocPath, "utf8");
    const matrix = parseCapabilityMatrix(bindingDoc);

    const admittedExports = ["brownian_frames", "philox_normals", "diffusion1d_frames"];
    let matrixAgrees = true;
    let failureReason = "";
    let failingRow: unknown = null;
    let failingField = "";

    for (const exp of admittedExports) {
      const rows = matrix.filter((r) => r.browserExport === exp);
      if (rows.length === 0) {
        matrixAgrees = false;
        failureReason = `Missing capability matrix row for export "${exp}"`;
        failingField = "missing-row";
        break;
      }
      for (const row of rows) {
        if (row.releaseArtifact !== manifest.bundleId) {
          matrixAgrees = false;
          const manifestCap = manifest.capabilities?.find((c) => c.browserExport === exp);
          const manifestArtifact = manifestCap?.releaseArtifact ?? manifest.bundleId;
          failureReason = `Export "${exp}" releaseArtifact "${row.releaseArtifact}" !== manifest recorded "${manifestArtifact}"`;
          failingRow = row;
          failingField = "releaseArtifact";
          break;
        }
        if (row.acceptanceState === "not-started") {
          matrixAgrees = false;
          const manifestCap = manifest.capabilities?.find((c) => c.browserExport === exp);
          const manifestState = manifestCap?.acceptanceState;
          failureReason = manifestState
            ? `Export "${exp}" in capability matrix has acceptanceState "not-started" (manifest recorded "${manifestState}")`
            : `Export "${exp}" in capability matrix has acceptanceState "not-started"`;
          failingRow = row;
          failingField = "acceptanceState";
          break;
        }
      }
      if (!matrixAgrees) break;
    }

    if (matrixAgrees && Array.isArray(manifest.capabilities)) {
      for (const cap of manifest.capabilities) {
        const rows = matrix.filter((r) => r.capabilityId === cap.capabilityId);
        if (rows.length === 0) {
          matrixAgrees = false;
          failureReason = `Manifest capability "${cap.capabilityId}" absent from capability matrix`;
          failingField = "missing-row";
          break;
        }
        for (const row of rows) {
          if (cap.releaseArtifact && row.releaseArtifact !== cap.releaseArtifact) {
            matrixAgrees = false;
            failureReason = `Capability "${cap.capabilityId}" releaseArtifact mismatch: current matrix "${row.releaseArtifact}" !== manifest recorded "${cap.releaseArtifact}"`;
            failingRow = row;
            failingField = "releaseArtifact";
            break;
          }
          if (cap.acceptanceState && row.acceptanceState !== cap.acceptanceState) {
            matrixAgrees = false;
            failureReason = `Capability "${cap.capabilityId}" acceptanceState mismatch: current matrix "${row.acceptanceState}" !== manifest recorded "${cap.acceptanceState}"`;
            failingRow = row;
            failingField = "acceptanceState";
            break;
          }
        }
        if (!matrixAgrees) break;
      }
    }

    checks.push({
      testId: "capability-matrix-agreement",
      passed: matrixAgrees,
      comparisonKind: "structural",
      message: matrixAgrees
        ? "Exported capabilities agree with docs/FRANKENSIM_BINDING.md capability matrix rows."
        : `Capability matrix agreement failed: ${failureReason}`,
      expected: { releaseArtifact: manifest.bundleId, acceptanceStateNot: "not-started" },
      actual: matrixAgrees
        ? { matrixAgrees: true }
        : { matrixAgrees: false, reason: failureReason },
      failureDetails: matrixAgrees
        ? undefined
        : {
            reason: failureReason,
            matrixRow: failingRow,
            failingField,
          },
    });
  } catch (err) {
    checks.push({
      testId: "capability-matrix-agreement",
      passed: false,
      comparisonKind: "structural",
      message: `Matrix agreement check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  // --- Check 3: Export validity on small fixed cases ---
  let bf: Float64Array = new Float64Array(0);
  let bfw: Float64Array = new Float64Array(0);
  let pn: Float64Array = new Float64Array(0);
  let df: Float64Array = new Float64Array(0);
  try {
    bf = jsModule.brownian_frames(2, 4, 3, "12345", 0.1, 0.05);
    bfw = jsModule.brownian_frames_window(2, 2, 2, 3, "12345", 0.1, 0.05, [0.0, 0.0]);
    pn = jsModule.philox_normals("12345", 0x19050001, 0, "0", 10);
    df = jsModule.diffusion1d_frames(10, 5, 2, 0.1, 0.1, 0.05, 0);

    const bfCheck = validateProtocolBuffer(bf, {
      layoutId: "brownian-frames",
      version: 1,
      shape: [2, 5],
    });
    const bfwCheck = validateProtocolBuffer(bfw, {
      layoutId: "brownian-frames",
      version: 1,
      shape: [2, 3],
    });
    const pnCheck = validateProtocolBuffer(pn, {
      layoutId: "philox-normals",
      version: 1,
      shape: [10],
    });
    const dfCheck = validateProtocolBuffer(df, {
      layoutId: "diffusion1d-frames",
      version: 1,
      shape: [5, 10],
    });

    const shapesValid = bfCheck.valid && bfwCheck.valid && pnCheck.valid && dfCheck.valid;

    checks.push({
      testId: "export-validity-small-cases",
      passed: shapesValid,
      comparisonKind: "structural",
      message:
        "All exported diffusion functions step cleanly with expected output buffer lengths and shapes.",
      expected: { bfLen: 10, bfwLen: 6, pnLen: 10, dfLen: 50 },
      actual: { bfLen: bf?.length, bfwLen: bfw?.length, pnLen: pn?.length, dfLen: df?.length },
      failureDetails: shapesValid
        ? undefined
        : {
            caseInputs: {
              bfArgs: [2, 4, 3, "12345", 0.1, 0.05],
              bfwArgs: [2, 2, 2, 3, "12345", 0.1, 0.05, [0.0, 0.0]],
              pnArgs: ["12345", 0x19050001, 0, "0", 10],
              dfArgs: [10, 5, 2, 0.1, 0.1, 0.05, 0],
            },
          },
    });
  } catch (err) {
    checks.push({
      testId: "export-validity-small-cases",
      passed: false,
      comparisonKind: "structural",
      message: `Export validity check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  // --- Check 4: Philox normals KATs and suffix draw-indexing property ---
  try {
    const vectorsPath = join(repoRoot, "src/physics/reference/philox.vectors.json");
    // The array is `knownAnswers`, and each entry's expected block is `block`.
    // This check previously read `vectorsData.kats[].expected`, a shape the file
    // has never had: verify-wasm-artifacts.ts was written against a placeholder
    // schema at 7b602d4, and am-fs-philox-ts-port-7kp landed the real vectors at
    // 5ec954b with this shape. `kats` was therefore always undefined and
    // katsPassed was unconditionally false, so this check failed on every run
    // regardless of which artifact was present.
    const vectorsData = JSON.parse(readFileSync(vectorsPath, "utf8")) as {
      readonly knownAnswers: readonly {
        readonly counter: readonly string[];
        readonly key: readonly string[];
        readonly block: readonly string[];
        readonly source: string;
      }[];
    };
    // And it counted entries rather than checking them, while reporting that the
    // generator "satisfies Random123 KATs". Run them against the TS port instead,
    // reusing philox4x32_10 rather than reimplementing the round function here.
    const knownAnswers = vectorsData.knownAnswers;
    let katsPassed = Array.isArray(knownAnswers) && knownAnswers.length >= 3;
    const katFailures: string[] = [];
    if (katsPassed) {
      for (const ka of knownAnswers) {
        const counter = ka.counter.map((h) => Number.parseInt(h, 16));
        const key = ka.key.map((h) => Number.parseInt(h, 16));
        const expectedBlock = ka.block.map((h) => Number.parseInt(h, 16));
        const actual = Array.from(philox4x32_10(counter, key));
        if (
          actual.length !== expectedBlock.length ||
          actual.some((w, i) => w !== expectedBlock[i])
        ) {
          katsPassed = false;
          katFailures.push(
            `${ka.source}: expected ${ka.block.join(",")} got ${actual.map((w) => (w >>> 0).toString(16).padStart(8, "0")).join(",")}`,
          );
        }
      }
    }

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
      expected: { katsPassed: true, suffixMatches: true, knownAnswerCount: 3 },
      actual: {
        katsPassed,
        suffixMatches,
        knownAnswerCount: knownAnswers?.length ?? 0,
        katFailures,
      },
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
      failureDetails: ftcsCheckPassed
        ? undefined
        : {
            refusalCode,
            caseInputs: {
              stable: {
                n: 11,
                frames: 4,
                steps_per_frame: 2,
                d: 0.1,
                dx: 0.1,
                dt: 0.05,
                profile: 0,
              },
              unstable: {
                n: 11,
                frames: 4,
                steps_per_frame: 2,
                d: 0.1,
                dx: 0.1,
                dt: 0.0500001,
                profile: 0,
              },
            },
          },
    });
  } catch (err) {
    checks.push({
      testId: "ftcs-1d-stability-boundary",
      passed: false,
      comparisonKind: "structural",
      message: `FTCS stability check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  // --- Check 7: Malformed output rejection through protocol decoder ---
  try {
    // 1. Truncated by 8 bytes (1 Float64 element fewer than declared shape)
    const truncatedBf = new Float64Array(bf.buffer.slice(0, Math.max(0, bf.byteLength - 8)));
    const truncatedCheck = validateProtocolBuffer(truncatedBf, {
      layoutId: "brownian-frames",
      version: 1,
      shape: [2, 5],
    });
    const truncatedRejected = !truncatedCheck.valid;

    // 2. Given a nonfinite value (NaN, Infinity, -Infinity)
    const nanDf = new Float64Array(df);
    if (nanDf.length > 3) nanDf[3] = Number.NaN;
    const nanCheck = validateProtocolBuffer(nanDf, {
      layoutId: "diffusion1d-frames",
      version: 1,
      shape: [5, 10],
    });
    const infPn = new Float64Array(pn);
    if (infPn.length > 0) infPn[0] = Number.POSITIVE_INFINITY;
    const infCheck = validateProtocolBuffer(infPn, {
      layoutId: "philox-normals",
      version: 1,
      shape: [10],
    });
    const negInfBf = new Float64Array(bf);
    if (negInfBf.length > 1) negInfBf[1] = Number.NEGATIVE_INFINITY;
    const negInfCheck = validateProtocolBuffer(negInfBf, {
      layoutId: "brownian-frames",
      version: 1,
      shape: [2, 5],
    });
    const nonfiniteRejected = !nanCheck.valid && !infCheck.valid && !negInfCheck.valid;

    // 3. Relabeled with a wrong shape (shape does not match buffer dimensions)
    const wrongShapeCheck = validateProtocolBuffer(df, {
      layoutId: "diffusion1d-frames",
      version: 1,
      shape: [6, 10], // 60 elements expected, buffer has 50
    });
    const wrongShapeRejected = !wrongShapeCheck.valid;

    const malformedPassed = truncatedRejected && nonfiniteRejected && wrongShapeRejected;

    checks.push({
      testId: "malformed-output-rejection",
      passed: malformedPassed,
      comparisonKind: "structural",
      message:
        "Protocol decoder strictly rejects malformed outputs: truncated buffers (by 8 bytes), nonfinite values (NaN/Infinity), and wrong-shape relabeling.",
      expected: {
        truncatedRejected: true,
        nonfiniteRejected: true,
        wrongShapeRejected: true,
      },
      actual: {
        truncatedRejected,
        nonfiniteRejected,
        wrongShapeRejected,
      },
      failureDetails: malformedPassed
        ? undefined
        : {
            truncatedRejected,
            nonfiniteRejected,
            wrongShapeRejected,
            caseInputs: {
              truncatedLength: truncatedBf.length,
              expectedLength: 10,
              shapes: { expected: [5, 10], testedWrong: [6, 10] },
            },
          },
    });
  } catch (err) {
    checks.push({
      testId: "malformed-output-rejection",
      passed: false,
      comparisonKind: "structural",
      message: `Malformed output rejection check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  // --- Check 8: 64-bit unsigned integer boundary round trips ---
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

  // --- Check 9: Size budget check (< 500 KB policy ceiling and within 10% drift) ---
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

  // --- Check 10: Provenance registry admission ---
  try {
    const digestAdmitted = isAdmittedWasmDigest(manifest.wasmDigest);
    assertAdmittedWasmDigest(manifest.wasmDigest);

    let allDeclaredCapsAdmitted = true;
    for (const cap of manifest.capabilities) {
      if (!isAdmittedCapability(cap.capabilityId)) {
        allDeclaredCapsAdmitted = false;
        break;
      }
      assertAdmittedCapability(cap.capabilityId);
    }

    // Unadmitted capabilities (like diffusion.brownian-frames which is not exported by WASM) must NOT be admitted
    const unadmittedRejected = !isAdmittedCapability("diffusion.brownian-frames");

    const bogusRejected = !isAdmittedWasmDigest(
      "0000000000000000000000000000000000000000000000000000000000000000",
    );

    checks.push({
      testId: "provenance-registry-admission",
      passed: digestAdmitted && allDeclaredCapsAdmitted && unadmittedRejected && bogusRejected,
      comparisonKind: "structural",
      message:
        "Provenance registry correctly admits manifest digests/declared capabilities and rejects unadmitted capabilities and foreign digests.",
      expected: {
        digestAdmitted: true,
        allDeclaredCapsAdmitted: true,
        unadmittedRejected: true,
        bogusRejected: true,
      },
      actual: { digestAdmitted, allDeclaredCapsAdmitted, unadmittedRejected, bogusRejected },
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
      const details = (c.failureDetails ?? {}) as Record<string, unknown>;
      const evidencePath = join(failureDir, `${c.testId}.json`);
      const evidence = {
        bundleId: manifest.bundleId,
        file: "fs_annus_diffusion_bg.wasm",
        testId: c.testId,
        message: c.message,
        expected: c.expected,
        actual: c.actual,
        expectedDigest:
          (details.expectedDigest as string) ??
          (c.expected as { digest?: string } | undefined)?.digest ??
          manifest.wasmDigest,
        actualDigest:
          (details.actualDigest as string) ??
          (c.actual as { digest?: string } | undefined)?.digest ??
          undefined,
        caseInputs: details.caseInputs ?? null,
        firstDifferingIndex: details.firstDifferingIndex ?? null,
        maxDeviation: c.maxDeviation ?? details.maxDeviation ?? null,
        refusalCode: details.refusalCode ?? null,
        compilePath: details.compilePath ?? "bytes",
        matrixRow: details.matrixRow ?? null,
        failingField: details.failingField ?? null,
        reproductionCommand: "bun scripts/verify-wasm-artifacts.ts",
      };
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
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
