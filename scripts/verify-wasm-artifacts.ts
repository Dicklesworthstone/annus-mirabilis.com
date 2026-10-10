#!/usr/bin/env bun
/**
 * WASM Artifact and Hash Verification Gate (am-fs-slim-artifact-0yh requirement 7).
 *
 * Verifies, against the compiled module itself, called through the same loader and decoder as
 * the browser worker (am-frankensim-repin-and-bind-jvhg):
 * 1. Manifest digests equal file bytes; WebAssembly.validate passes.
 * 2. The module loads through loadBundle (digest, link, build_identity()).
 * 3. Capability-matrix agreement against docs/FRANKENSIM_BINDING.md.
 * 4. Export validity and shape/length checks on small fixed cases.
 * 5. Philox, bitwise: the TS port's KATs and integer draws, and the module's normals, at every
 *    position in src/physics/reference/philox.vectors.json; the draw-indexed suffix.
 * 6. The module's normals against the TS port's: tolerance in ulps (the transforms differ).
 * 7. Brownian step kernels (coin scale; kernel 3 == kernel 2 at 2 D dt = 1; kernel 4 refused).
 * 8. FTCS stability boundary: r = 0.5 accepted, r > 0.5 the typed ftcs-unstable envelope.
 * 9. Malformed output rejection by the worker's decoder.
 * 10. 64-bit seeds as BigInt at the boundaries.
 * 11. Size budget enforcement (< 500 KB and within 10% drift).
 * 12. Provenance registry admission (brownian_frames now admitted; see the check).
 * A check that could not run because the module did not load is reported as failed.
 *
 * Writes structured JSONL to artifacts/test-logs/wasm-artifacts/<log-run-id>.jsonl
 * and failure evidence to artifacts/test-logs/wasm-artifacts/<log-run-id>/failures/<testId>.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPhiloxStream, philox4x32_10 } from "../src/physics/reference/philox.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";
import {
  computeArtifactDigest,
  loadWasmBytes,
  validateWasmBytes,
} from "../src/testing/wasm/artifactHelpers.ts";
import { compareBitwise, ieee754Hex, withinTolerance } from "../src/units/tolerance.ts";
import {
  assertAdmittedCapability,
  assertAdmittedWasmDigest,
  isAdmittedCapability,
  isAdmittedWasmDigest,
  registerAdmittedManifest,
  type WasmArtifactManifest,
} from "../src/workers/protocol/provenance.ts";
import {
  callBrownianFrames,
  callDiffusion1dFrames,
  callPhiloxNormals,
  decodeFrankenSimResult,
  type FrankenSimCall,
  type FrankenSimExports,
} from "../src/workers/wasm/frankensimCalls.ts";
import { loadBundle, type WasmBindgenGlue, wasmFileOf } from "../src/workers/wasm/loadBundle.ts";
import { reportPopulation } from "./gate-census/population.ts";
import { parseCapabilityMatrix } from "./wasm-artifacts/capabilityMatrix.ts";
import { evaluateSizeBudget } from "./wasm-artifacts/sizeBudget.ts";

/**
 * WHAT PRODUCED THE NUMBER THIS CHECK JUDGED (am-verify-wasm-reports-js-as-wasm-oncl).
 *
 * The bead was filed when the deployed artifact was a 154-byte placeholder whose companion JS
 * reimplemented Philox, `brownian_frames` and `diffusion1d_frames`, so the Brownian and diffusion
 * checks passed against a JavaScript reimplementation and were cited as evidence about WASM. That
 * premise is stale -- the manifest has pinned a real 92,751-byte module since 2026-09-26 -- but the
 * defect the bead names is not: before this field, the string "engine" appeared ZERO times in this
 * 42 KB script, and a reader inferred which engine answered from prose like "the compiled module
 * exports" or "the TS port's". An inference is not a label, and the whole point of the bead is that
 * a run must SAY what it exercised rather than leave it to be deduced.
 *
 * `not-exercised` is the load-bearing value. A check that fell into its catch, or that was skipped
 * because the module did not load, establishes nothing about its engine, and this is what lets the
 * summary say "0 of 12 checks ran a value through an export of the pinned module" instead of
 * printing a sentence about WASM that no WASM produced.
 */
export type WasmCheckEngine =
  /** A value an export of the pinned module produced, read back through the typed decoder. */
  | "wasm-export"
  /** Both engines, where the check's SUBJECT is whether they agree. */
  | "wasm-vs-ts"
  /** The artifact's bytes, hashed or validated, never executed. */
  | "artifact-bytes"
  /** The TypeScript transport decoder. The module supplies the control input it corrupts. */
  | "host-decoder"
  /** The provenance registry's admission rules. */
  | "host-registry"
  /** Manifest and docs/FRANKENSIM_BINDING.md text, with nothing executed at all. */
  | "declarations"
  /** Nothing: the check did not reach its subject, so it is not evidence about any engine. */
  | "not-exercised";

/**
 * The engine each check CLAIMS when it reaches a verdict, declared once, away from the 25 push
 * sites that report one.
 *
 * `assertDeclaredEngine` refuses a check whose reported engine is neither `not-exercised` nor the
 * one declared here, so a check cannot be silently relabelled into a stronger claim, and a NEW check
 * cannot report an engine at all until its claim is written down beside the other twelve. That is
 * the same reason the census below names its population: the failure this guards against is a
 * stronger claim appearing without anyone deciding to make it.
 */
const CLAIMED_ENGINE: Readonly<Record<string, WasmCheckEngine>> = {
  "manifest-digests-and-validation": "artifact-bytes",
  "module-instantiation": "wasm-export",
  "capability-matrix-agreement": "declarations",
  "export-validity-small-cases": "wasm-export",
  "philox-normals-kats-and-suffix": "wasm-vs-ts",
  "philox-normals-wasm-vs-ts-port": "wasm-vs-ts",
  "brownian-trajectories-and-kernel-resolution": "wasm-export",
  "ftcs-1d-stability-boundary": "wasm-export",
  "malformed-output-rejection": "host-decoder",
  "u64-boundaries-round-trip": "wasm-export",
  "wasm-size-budget": "artifact-bytes",
  "provenance-registry-admission": "host-registry",
};

/**
 * Refuses a check whose engine claim is not the one declared for its testId.
 *
 * TWO RATCHETS SHAPED THIS CLASS, both of them after I had written it the obvious way.
 *
 * The code comes FIRST because refusalRatchet credits a kebab code only as a typed error's first
 * constructor argument: with the code inside the message, bareThrowRatchet read the whole class as
 * an untyped throw and went red at "4 bare throw site(s), recorded 3".
 *
 * The fields are DECLARED AND ASSIGNED rather than written as constructor parameter properties,
 * because `node --experimental-strip-types` cannot erase a parameter property -- it needs code
 * generated, not just types removed -- and src/testing/hygiene/stripTypesCompatible.test.ts is the
 * gate that says so. It was the single failure in a 17,333-test run, named by file and line:
 * "scripts/verify-wasm-artifacts.ts:128 parameter-property". A shorter constructor would have cost
 * this file the node lane.
 */
export class UndeclaredEngineClaimError extends Error {
  readonly code: string;
  readonly testId: string;
  readonly reported: string;
  constructor(code: string, testId: string, reported: string) {
    super(
      `check "${testId}" reports engine "${reported}", which is not its declared ` +
        `${CLAIMED_ENGINE[testId] ? `engine "${CLAIMED_ENGINE[testId]}"` : "(no declared engine: add it to CLAIMED_ENGINE)"}. ` +
        'A check may report its declared engine or "not-exercised", never a different one.',
    );
    this.name = "UndeclaredEngineClaimError";
    this.code = code;
    this.testId = testId;
    this.reported = reported;
  }
}

export function assertDeclaredEngine(checks: readonly VerificationCheckResult[]): void {
  for (const c of checks)
    if (c.engine !== "not-exercised" && CLAIMED_ENGINE[c.testId] !== c.engine)
      throw new UndeclaredEngineClaimError("undeclared-engine-claim", c.testId, c.engine);
}

/** How many checks each engine answered, in the declaration order of the union. */
export function engineTally(
  checks: readonly VerificationCheckResult[],
): ReadonlyArray<readonly [WasmCheckEngine, number]> {
  const order: readonly WasmCheckEngine[] = [
    "wasm-export",
    "wasm-vs-ts",
    "artifact-bytes",
    "host-decoder",
    "host-registry",
    "declarations",
    "not-exercised",
  ];
  return order.map((e) => [e, checks.filter((c) => c.engine === e).length] as const);
}

export interface VerificationCheckResult {
  readonly testId: string;
  /** What produced the number judged, never inferred from the message. */
  readonly engine: WasmCheckEngine;
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

/** A double's IEEE-754 bits as 16 lowercase hex digits, the form philox.vectors.json records. */
const bitsHex = (v: number) => ieee754Hex(v).slice(2);

/** Distance in units in the last place between two finite doubles. */
function ulpDistance(a: number, b: number): bigint {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 2n ** 63n;
  const ordered = (x: number) => {
    const v = new DataView(new ArrayBuffer(8));
    v.setFloat64(0, x);
    const u = v.getBigInt64(0);
    return u < 0n ? -(u & 0x7fffffffffffffffn) : u;
  };
  const d = ordered(a) - ordered(b);
  return d < 0n ? -d : d;
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
  const wasmFile = wasmFileOf(manifest) ?? "fs_annus_diffusion_bg.wasm";
  const wasmPath = join(bundleDir, wasmFile);

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
      engine: "artifact-bytes",
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
      engine: "not-exercised",
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

  // --- Check 2: the module loads through the real loader, with its identity checked ---
  // The same path the browser worker takes (src/workers/wasm/loadBundle.ts): sha256 against the
  // manifest, compile the verified bytes, initSync on the manifest's own glue, build_identity().
  let fs: FrankenSimExports | null = null;
  const glueFile = Object.keys(manifest.files).find((n) => n.endsWith(".js"));
  try {
    const glue = glueFile
      ? ((await import(
          /* @vite-ignore */ pathToFileURL(join(bundleDir, glueFile)).href
        )) as WasmBindgenGlue)
      : undefined;
    const loaded = await loadBundle({
      manifestData: manifest,
      wasmUrl: wasmPath,
      readBytes: (p) => readFile(p),
      ...(glue ? { glue } : {}),
    });
    const expectedIdentity = (manifest.build as { identity?: string } | undefined)?.identity;
    const identityChecked = loaded.kind === "loaded" && loaded.identity === expectedIdentity;
    if (loaded.kind === "loaded") fs = loaded.exports;
    checks.push({
      engine: loaded.kind === "loaded" ? "wasm-export" : "not-exercised",
      testId: "module-instantiation",
      passed: loaded.kind === "loaded" && identityChecked,
      comparisonKind: "bitwise",
      message:
        loaded.kind === "loaded"
          ? `The compiled module loads through loadBundle and reports build_identity() ${loaded.identity}.`
          : `The module was refused: ${loaded.outcome}: ${loaded.message}`,
      expected: { kind: "loaded", identity: expectedIdentity ?? null },
      actual:
        loaded.kind === "loaded"
          ? { kind: "loaded", identity: loaded.identity, digest: loaded.digest }
          : { kind: "refused", outcome: loaded.outcome },
      failureDetails:
        loaded.kind === "loaded"
          ? undefined
          : { outcome: loaded.outcome, expectedDigest: manifest.wasmDigest, compilePath: "bytes" },
    });
  } catch (err) {
    checks.push({
      engine: "not-exercised",
      testId: "module-instantiation",
      passed: false,
      comparisonKind: "structural",
      message: `The glue could not be imported: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 3: Capability matrix agreement ---
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
      engine: "declarations",
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
      engine: "not-exercised",
      testId: "capability-matrix-agreement",
      passed: false,
      comparisonKind: "structural",
      message: `Matrix agreement check failed: ${err instanceof Error ? err.message : String(err)}`,
      failureDetails: { error: String(err) },
    });
  }

  // Every check below calls the loaded module. Without it they cannot run, and each says so as
  // a failure, not a skip: a gate that examined nothing has not passed.
  const EXPORT_CHECKS = [
    "export-validity-small-cases",
    "philox-normals-kats-and-suffix",
    "philox-normals-wasm-vs-ts-port",
    "brownian-trajectories-and-kernel-resolution",
    "ftcs-1d-stability-boundary",
    "malformed-output-rejection",
    "u64-boundaries-round-trip",
  ];
  if (!fs) {
    for (const testId of EXPORT_CHECKS)
      checks.push({
        engine: "not-exercised",
        testId,
        passed: false,
        comparisonKind: "structural",
        message: "Not run: the module did not load, so there was nothing to call.",
      });
  } else {
    const m = fs;
    const values = (c: FrankenSimCall): Float64Array =>
      c.kind === "accepted" ? c.values : new Float64Array(0);

    // --- Check 4: every export steps a small case, through the typed decoder ---
    let bf: Float64Array = new Float64Array(0);
    let pn: Float64Array = new Float64Array(0);
    let df: Float64Array = new Float64Array(0);
    try {
      const bfc = callBrownianFrames(m, {
        nParticles: 2,
        steps: 4,
        stepKernel: 3,
        seed: "12345",
        diffusion: 0.1,
        dt: 0.05,
      });
      const pnc = callPhiloxNormals(m, {
        seed: "12345",
        streamKernel: 0x19050001,
        tile: 0,
        startIndex: "0",
        count: 10,
      });
      const dfc = callDiffusion1dFrames(m, {
        n: 10,
        frames: 5,
        stepsPerFrame: 2,
        diffusion: 0.1,
        dx: 0.1,
        dt: 0.05,
        profile: 0,
      });
      bf = values(bfc);
      pn = values(pnc);
      df = values(dfc);
      const kinds = [bfc.kind, pnc.kind, dfc.kind];
      const shapesValid =
        kinds.every((k) => k === "accepted") &&
        validateProtocolBuffer(bf, { layoutId: "brownian-frames", version: 1, shape: [2, 5] })
          .valid &&
        validateProtocolBuffer(pn, { layoutId: "philox-normals", version: 1, shape: [10] }).valid &&
        validateProtocolBuffer(df, { layoutId: "diffusion1d-frames", version: 1, shape: [5, 10] })
          .valid;
      checks.push({
        engine: "wasm-export",
        testId: "export-validity-small-cases",
        passed: shapesValid,
        comparisonKind: "structural",
        message: shapesValid
          ? "brownian_frames, philox_normals and diffusion1d_frames each return an ok envelope and a buffer of the declared shape. brownian_frames_window is not exported by this artifact and is not called."
          : `An export did not return an ok envelope of the declared shape: kinds ${kinds.join(", ")}; lengths ${bf.length}, ${pn.length}, ${df.length}.`,
        expected: { kinds: ["accepted", "accepted", "accepted"], bfLen: 10, pnLen: 10, dfLen: 50 },
        actual: { kinds, bfLen: bf.length, pnLen: pn.length, dfLen: df.length },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "export-validity-small-cases",
        passed: false,
        comparisonKind: "structural",
        message: `Export validity check failed: ${err instanceof Error ? err.message : String(err)}`,
        failureDetails: { error: String(err) },
      });
    }

    // --- Check 5: Philox, bitwise against the recorded vectors, through the real module ---
    try {
      const vectorsPath = join(repoRoot, "src/physics/reference/philox.vectors.json");
      const vectorsData = JSON.parse(readFileSync(vectorsPath, "utf8")) as {
        readonly knownAnswers: readonly {
          readonly counter: readonly string[];
          readonly key: readonly string[];
          readonly block: readonly string[];
          readonly source: string;
        }[];
        readonly positions: readonly {
          readonly seed: string;
          readonly streamKernel: number;
          readonly tile: number;
          readonly index: string;
          readonly u64: string;
          readonly normalBits: string;
        }[];
        readonly normalSequences: readonly {
          readonly seed: string;
          readonly streamKernel: number;
          readonly tile: number;
          readonly startIndex: string;
          readonly count: number;
          readonly normalBits: readonly string[];
        }[];
      };
      // The TS port's block function against the 3 Random123 known answers.
      const katFailures: string[] = [];
      for (const ka of vectorsData.knownAnswers) {
        const counter = ka.counter.map((h) => Number.parseInt(h, 16));
        const key = ka.key.map((h) => Number.parseInt(h, 16));
        const actual = Array.from(philox4x32_10(counter, key)).map((w) =>
          (w >>> 0).toString(16).padStart(8, "0"),
        );
        if (actual.join(",") !== ka.block.join(","))
          katFailures.push(`${ka.source}: got ${actual.join(",")}`);
      }
      // Every recorded position: the TS port's integer draw, and the module's normal, bitwise.
      let portU64Mismatches = 0;
      let wasmNormalMismatches = 0;
      let wasmNormals = 0;
      let typedOverflows = 0;
      for (const p of vectorsData.positions) {
        const stream = createPhiloxStream(
          { seed: p.seed, kernel: p.streamKernel, tile: p.tile } as Parameters<
            typeof createPhiloxStream
          >[0],
          p.index,
        );
        if (stream.nextU64().toString() !== p.u64) portU64Mismatches++;
        const r = callPhiloxNormals(m, {
          seed: p.seed,
          streamKernel: p.streamKernel,
          tile: p.tile,
          startIndex: p.index,
          count: 1,
        });
        if (BigInt(p.index) + 2n > 18446744073709551615n) {
          if (r.kind === "refused" && r.refusal.code === "stream-index-overflow") typedOverflows++;
          else wasmNormalMismatches++;
        } else {
          wasmNormals++;
          if (r.kind !== "accepted" || bitsHex(r.values[0] ?? Number.NaN) !== p.normalBits)
            wasmNormalMismatches++;
        }
      }
      let sequenceMismatches = 0;
      for (const sq of vectorsData.normalSequences) {
        const r = callPhiloxNormals(m, {
          seed: sq.seed,
          streamKernel: sq.streamKernel,
          tile: sq.tile,
          startIndex: sq.startIndex,
          count: sq.count,
        });
        if (
          r.kind !== "accepted" ||
          Array.from(r.values, bitsHex).join(",") !== sq.normalBits.join(",")
        )
          sequenceMismatches++;
      }
      // start_index counts draws: normal k of a call from 0 is normal 0 of a call from 2k.
      const full = values(
        callPhiloxNormals(m, {
          seed: "99999",
          streamKernel: 0x19050001,
          tile: 1,
          startIndex: "0",
          count: 20,
        }),
      );
      const offset = values(
        callPhiloxNormals(m, {
          seed: "99999",
          streamKernel: 0x19050001,
          tile: 1,
          startIndex: "10",
          count: 15,
        }),
      );
      const suffixMatches =
        offset.length === 15 &&
        Array.from(offset).every((v, i) => compareBitwise(v, full[5 + i]).ok);
      const passed =
        vectorsData.knownAnswers.length >= 3 &&
        katFailures.length === 0 &&
        vectorsData.positions.length > 0 &&
        wasmNormals > 0 &&
        typedOverflows > 0 &&
        portU64Mismatches === 0 &&
        wasmNormalMismatches === 0 &&
        vectorsData.normalSequences.length > 0 &&
        sequenceMismatches === 0 &&
        suffixMatches;
      checks.push({
        engine: "wasm-vs-ts",
        testId: "philox-normals-kats-and-suffix",
        passed,
        comparisonKind: "bitwise",
        message: `Philox, bitwise, over ${vectorsData.positions.length} recorded positions: TS port known-answer failures ${katFailures.length} of ${vectorsData.knownAnswers.length}; TS port integer-draw mismatches ${portU64Mismatches}; module normals compared ${wasmNormals}, mismatched ${wasmNormalMismatches}; typed stream-index-overflow refusals ${typedOverflows}; recorded sequences mismatched ${sequenceMismatches} of ${vectorsData.normalSequences.length}; draw-indexed suffix ${suffixMatches ? "matches" : "differs"}.`,
        expected: {
          katFailures: 0,
          portU64Mismatches: 0,
          wasmNormalMismatches: 0,
          sequenceMismatches: 0,
          suffixMatches: true,
        },
        actual: {
          katFailures: katFailures.length,
          portU64Mismatches,
          wasmNormalMismatches,
          wasmNormals,
          typedOverflows,
          sequenceMismatches,
          suffixMatches,
        },
        failureDetails: passed ? undefined : { katFailures },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "philox-normals-kats-and-suffix",
        passed: false,
        comparisonKind: "bitwise",
        message: `Philox check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // --- Check 6: the module's normals against the TS port's, which are not bitwise by design ---
    // The integers agree bitwise (check 5). The normal transform does not: fs-math's det ln/cos
    // against the host's Math (philox.vectors.json records "tolerance, not bitwise"). Bound:
    // 8 ulps per normal. Measured 2026-09-24 over 40,000 normals: 65% bitwise equal, max 3 ulps.
    try {
      const ULP_BOUND = 8n;
      let worst = 0n;
      let compared = 0;
      for (const seed of ["0", "1905", "9007199254740993", "18446744073709551615"])
        for (const tile of [0, 1, 4095]) {
          const w = values(
            callPhiloxNormals(m, {
              seed,
              streamKernel: 0x19050001,
              tile,
              startIndex: "0",
              count: 500,
            }),
          );
          const t = createPhiloxStream({ seed, kernel: 0x19050001, tile } as Parameters<
            typeof createPhiloxStream
          >[0]);
          for (let i = 0; i < 500; i++) {
            const d = ulpDistance(t.nextNormal(), w[i] ?? Number.NaN);
            if (d > worst) worst = d;
            compared++;
          }
        }
      checks.push({
        engine: "wasm-vs-ts",
        testId: "philox-normals-wasm-vs-ts-port",
        passed: compared === 6000 && worst <= ULP_BOUND,
        comparisonKind: "tolerance",
        tolerance: Number(ULP_BOUND),
        maxDeviation: Number(worst),
        message: `The module's normals are within ${worst} ulps of the TS port's over ${compared} normals (bound ${ULP_BOUND}).`,
        expected: { compared: 6000, maxUlps: `<= ${ULP_BOUND}` },
        actual: { compared, maxUlps: worst.toString() },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "philox-normals-wasm-vs-ts-port",
        passed: false,
        comparisonKind: "tolerance",
        message: `Normal comparison failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // --- Check 7: Brownian step kernels ---
    try {
      const coin = values(
        callBrownianFrames(m, {
          nParticles: 1,
          steps: 10,
          stepKernel: 0,
          seed: "42",
          diffusion: 0.5,
          dt: 0.02,
        }),
      );
      const uniform = values(
        callBrownianFrames(m, {
          nParticles: 1,
          steps: 10,
          stepKernel: 1,
          seed: "42",
          diffusion: 0.5,
          dt: 0.02,
        }),
      );
      // With 2 D dt = 1, kernel 3's scale is sqrt(1) = 1 and it equals kernel 2 bitwise.
      const k2 = values(
        callBrownianFrames(m, {
          nParticles: 1,
          steps: 10,
          stepKernel: 2,
          seed: "42",
          diffusion: 10,
          dt: 0.05,
        }),
      );
      const k3 = values(
        callBrownianFrames(m, {
          nParticles: 1,
          steps: 10,
          stepKernel: 3,
          seed: "42",
          diffusion: 10,
          dt: 0.05,
        }),
      );
      const coinValid =
        coin.length === 11 &&
        coin[0] === 0 &&
        Array.from(coin).every(
          (x, i) =>
            i === 0 || Math.abs(Math.abs(x - (coin[i - 1] ?? 0)) - 0.1414213562373095) < 1e-15,
        );
      const uniformValid = uniform.length === 11 && uniform[0] === 0;
      const k2k3Coincide = k2.length === 11 && compareBitwise(Array.from(k3), Array.from(k2)).ok;
      const unsupported = callBrownianFrames(m, {
        nParticles: 1,
        steps: 10,
        stepKernel: 4,
        seed: "42",
        diffusion: 0.5,
        dt: 0.02,
      });
      const kernelRefused =
        unsupported.kind === "refused" && unsupported.refusal.code === "unsupported-kernel";
      checks.push({
        engine: "wasm-export",
        testId: "brownian-trajectories-and-kernel-resolution",
        passed: coinValid && uniformValid && k2k3Coincide && kernelRefused,
        comparisonKind: "bitwise",
        message:
          coinValid && uniformValid && k2k3Coincide && kernelRefused
            ? "Coin steps are exactly +-sqrt(2 D dt); kernel 3 at 2 D dt = 1 equals kernel 2 bitwise; step kernel 4 is the typed unsupported-kernel refusal."
            : `Brownian kernels failed: coin ${coinValid}, uniform ${uniformValid}, kernel 3 = kernel 2 ${k2k3Coincide}, kernel 4 refused ${kernelRefused}.`,
        expected: { coinValid: true, uniformValid: true, k2k3Coincide: true, kernelRefused: true },
        actual: { coinValid, uniformValid, k2k3Coincide, kernelRefused },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "brownian-trajectories-and-kernel-resolution",
        passed: false,
        comparisonKind: "bitwise",
        message: `Brownian check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // --- Check 8: FTCS stability boundary; the refusal is an envelope, never a throw ---
    const unstableInputs = {
      n: 11,
      frames: 4,
      stepsPerFrame: 2,
      diffusion: 0.1,
      dx: 0.1,
      dt: 0.0500001,
      profile: 0,
    };
    try {
      const stable = callDiffusion1dFrames(m, {
        n: 11,
        frames: 4,
        stepsPerFrame: 2,
        diffusion: 0.1,
        dx: 0.1,
        dt: 0.05,
        profile: 0,
      });
      const sv = values(stable);
      const stablePassed = stable.kind === "accepted" && sv.length === 44;
      let initialMass = 0;
      let finalMass = 0;
      for (let i = 0; i < 11; i++) {
        initialMass += (sv[i] ?? 0) * 0.1;
        finalMass += (sv[33 + i] ?? 0) * 0.1;
      }
      const massConserved =
        withinTolerance(initialMass, 1, { absolute: 1e-12 }).ok &&
        withinTolerance(finalMass, 1, { absolute: 1e-12 }).ok;
      const unstable = callDiffusion1dFrames(m, unstableInputs);
      const refusalCode = unstable.kind === "refused" ? unstable.refusal.code : `${unstable.kind}`;
      const passed = stablePassed && massConserved && refusalCode === "ftcs-unstable";
      checks.push({
        engine: "wasm-export",
        testId: "ftcs-1d-stability-boundary",
        passed,
        comparisonKind: "structural",
        message: passed
          ? "r = 0.5 is accepted and conserves mass; r > 0.5 returns the typed ftcs-unstable refusal in its envelope, with no field."
          : `FTCS boundary failed: r = 0.5 accepted ${stablePassed}, mass conserved ${massConserved}, r > 0.5 gave ${refusalCode}.`,
        expected: { stablePassed: true, massConserved: true, refusalCode: "ftcs-unstable" },
        actual: { stablePassed, massConserved, refusalCode },
        failureDetails: passed
          ? undefined
          : { refusalCode, caseInputs: { unstable: unstableInputs } },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "ftcs-1d-stability-boundary",
        passed: false,
        comparisonKind: "structural",
        message: `FTCS stability check failed: ${err instanceof Error ? err.message : String(err)}`,
        failureDetails: { error: String(err) },
      });
    }

    // --- Check 9: malformed output never becomes a value ---
    // The worker's own decoder (frankensimCalls.ts), fed real buffers and envelopes corrupted
    // the ways a broken module or transport could corrupt them, plus the buffer-layout check.
    try {
      const ok = (n: number) =>
        JSON.stringify({
          ok: { export: "brownian_frames", valueCount: n, quantityId: "latentPosition1d" },
        });
      const cases: [string, string, Float64Array][] = [
        ["truncated by one value", ok(bf.length), bf.slice(0, Math.max(0, bf.length - 1))],
        ["NaN", ok(bf.length), Float64Array.from(bf, (v, i) => (i === 1 ? Number.NaN : v))],
        [
          "Infinity",
          ok(bf.length),
          Float64Array.from(bf, (v, i) => (i === 1 ? Number.POSITIVE_INFINITY : v)),
        ],
        [
          "values beside a refusal",
          JSON.stringify({
            refusal: { code: "unsupported-kernel", message: "m", ranked_repairs: [], details: {} },
          }),
          bf,
        ],
        [
          "an unregistered code",
          JSON.stringify({
            refusal: { code: "made-up", message: "m", ranked_repairs: [], details: {} },
          }),
          new Float64Array(0),
        ],
        ["two envelope keys", JSON.stringify({ ok: {}, refusal: {} }), new Float64Array(0)],
      ];
      const decoded = cases.map(([name, env, vals]) => {
        const r = decodeFrankenSimResult("brownian_frames", env, vals);
        return {
          name,
          rejected: r.kind === "outcome" && r.outcome.outcome === "malformed-response",
        };
      });
      const layoutRejected =
        !validateProtocolBuffer(df, { layoutId: "diffusion1d-frames", version: 1, shape: [6, 10] })
          .valid &&
        !validateProtocolBuffer(
          Float64Array.from(pn, (v, i) => (i === 0 ? Number.NaN : v)),
          { layoutId: "philox-normals", version: 1, shape: [10] },
        ).valid;
      const controlAccepted =
        decodeFrankenSimResult("brownian_frames", ok(bf.length), bf).kind === "accepted" &&
        bf.length === 10;
      const passed = controlAccepted && layoutRejected && decoded.every((d) => d.rejected);
      checks.push({
        engine: "host-decoder",
        testId: "malformed-output-rejection",
        passed,
        comparisonKind: "structural",
        message: `The decoder accepts the real buffer and rejects ${decoded.filter((d) => d.rejected).length} of ${decoded.length} corruptions as malformed-response; the layout check rejects a wrong shape and a NaN.`,
        expected: { controlAccepted: true, layoutRejected: true, rejected: cases.length },
        actual: { controlAccepted, layoutRejected, decoded },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "malformed-output-rejection",
        passed: false,
        comparisonKind: "structural",
        message: `Malformed output check failed: ${err instanceof Error ? err.message : String(err)}`,
        failureDetails: { error: String(err) },
      });
    }

    // --- Check 10: 64-bit seeds cross as BigInt ---
    try {
      const u64Data = JSON.parse(
        readFileSync(join(repoRoot, "src/testing/fixtures/u64-boundaries.json"), "utf8"),
      ) as { valid: string[]; formatViolations: string[] };
      const accepted = u64Data.valid.map((v) =>
        callPhiloxNormals(m, {
          seed: v,
          streamKernel: 0x19050001,
          tile: 0,
          startIndex: "0",
          count: 2,
        }),
      );
      const allValid = accepted.every((r) => r.kind === "accepted" && r.values.length === 2);
      const distinct =
        new Set(accepted.map((r) => Array.from(values(r), ieee754Hex).join())).size ===
        u64Data.valid.length;
      const violationsRefused = u64Data.formatViolations.every(
        (v) =>
          callPhiloxNormals(m, { seed: v, streamKernel: 0, tile: 0, startIndex: "0", count: 1 })
            .kind !== "accepted",
      );
      checks.push({
        engine: "wasm-export",
        testId: "u64-boundaries-round-trip",
        passed: allValid && distinct && violationsRefused,
        comparisonKind: "bitwise",
        message: `All ${u64Data.valid.length} canonical u64 boundary seeds (including 2^53 +- 1 and 2^64 - 1) reach the module as BigInt and give ${u64Data.valid.length} distinct streams; ${u64Data.formatViolations.length} non-canonical strings never reach it.`,
        expected: { allValid: true, distinct: true, violationsRefused: true },
        actual: { allValid, distinct, violationsRefused },
      });
    } catch (err) {
      checks.push({
        engine: "not-exercised",
        testId: "u64-boundaries-round-trip",
        passed: false,
        comparisonKind: "bitwise",
        message: `u64 boundary check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // --- Check 11: Size budget check (< 500 KB policy ceiling and within 10% drift) ---
  try {
    const evalResult = evaluateSizeBudget(manifest.sizeBudget, manifest.wasmBytes);

    checks.push({
      engine: "artifact-bytes",
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
      engine: "not-exercised",
      testId: "wasm-size-budget",
      passed: false,
      comparisonKind: "structural",
      message: `Size budget check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // --- Check 12: Provenance registry admission ---
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

    // Flipped for the compiled artifact (am-frankensim-repin-and-bind-jvhg). The placeholder
    // exported none of the three, so diffusion.brownian-frames had to be unadmitted. The compiled
    // module exports brownian_frames, and the manifest declares it, so it must now be admitted.
    // A capability no row admits and no export backs, such as brownian_frames_window, which this
    // artifact does not export, must still be refused.
    const brownianAdmitted = isAdmittedCapability("diffusion.brownian-frames");
    const unadmittedRejected = !isAdmittedCapability("diffusion.brownian-frames-window");

    const bogusRejected = !isAdmittedWasmDigest(
      "0000000000000000000000000000000000000000000000000000000000000000",
    );

    checks.push({
      engine: "host-registry",
      testId: "provenance-registry-admission",
      passed:
        digestAdmitted &&
        allDeclaredCapsAdmitted &&
        brownianAdmitted &&
        unadmittedRejected &&
        bogusRejected,
      comparisonKind: "structural",
      message: `Provenance registry: manifest digest admitted ${digestAdmitted}; every declared capability admitted ${allDeclaredCapsAdmitted}; diffusion.brownian-frames admitted ${brownianAdmitted} (the compiled module exports brownian_frames, so it must be); undeclared capability refused ${unadmittedRejected}; foreign digest refused ${bogusRejected}.`,
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
      engine: "not-exercised",
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
      // AGENTS.md's structured-log field for this: "executionLabel". The same value appears as
      // `engine` so a reader grepping either word finds it (am-verify-wasm-reports-js-as-wasm-oncl).
      executionLabel: c.engine,
      engine: c.engine,
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
        file: wasmFile,
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

  // Before anything is returned, so a run cannot report a stronger engine claim than the one
  // declared for its check (am-verify-wasm-reports-js-as-wasm-oncl).
  assertDeclaredEngine(checks);
  return { passed: allPassed, logRunId, checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runWasmVerification();
    console.log(`\nWASM Artifact Verification Summary [${result.logRunId}]:`);
    for (const c of result.checks) {
      console.log(`  ${c.passed ? "✓ PASS" : "✗ FAIL"} [${c.engine}]: ${c.testId} - ${c.message}`);
    }
    // WHAT ANSWERED, BESIDE WHAT PASSED (am-verify-wasm-reports-js-as-wasm-oncl). A verdict without
    // this line reads the same whether twelve checks ran values through the pinned module or none
    // did, which is the condition that made the original finding possible.
    const tally = engineTally(result.checks);
    console.log(`  checks by engine: ${tally.map(([e, n]) => `${e} ${n}`).join(", ")}`);
    const wasmExercised = tally
      .filter(([e]) => e === "wasm-export" || e === "wasm-vs-ts")
      .reduce((a, [, n]) => a + n, 0);
    // The census line (am-rc1001-bridge-plan-pcjk.9), printed before the verdict so a failing run also
    // says how much it examined. The population is the CHECKS this script ran: a run that registered
    // two of them would print "All WASM artifact verification checks PASSED" having verified almost
    // nothing, and the sentence would be identical. Measured 2026-10-06: 12 checks. The floor is 8.
    const censusVacuous = reportPopulation({
      gate: "verify-wasm-artifacts",
      examined: result.checks.length,
      noun: "wasm verification checks",
      minimum: 8,
    });
    if (censusVacuous) {
      console.error(
        "\nREFUSED: fewer checks ran than this script declares it must, so a pass would be a statement " +
          "about a suite that was not assembled.",
      );
      process.exit(1);
    }
    if (!result.passed) {
      console.error("\nWASM artifact verification failed.");
      process.exit(1);
    }
    // THE SENTENCE NEVER CLAIMS WASM THAT NO WASM PRODUCED. With the artifact absent the six export
    // checks are already pushed as "Not run: the module did not load", so the run FAILS above and
    // never reaches here -- which is stricter than this bead asked for, and is why this branch is a
    // second line of defence rather than the repair. It still matters: a future run in which every
    // export check reported `not-exercised` while still passing would otherwise print a sentence
    // about WASM verification on the strength of digests and documentation alone.
    if (wasmExercised === 0) {
      console.log(
        `\nAll ${result.checks.length} checks that ran PASSED, and NO WASM EXPORT WAS EXERCISED: ` +
          "0 of them ran a value through an export of the pinned module, so this run is not " +
          "evidence about WASM.",
      );
    } else {
      console.log(
        `\nAll WASM artifact verification checks PASSED (${wasmExercised} of ${result.checks.length} ` +
          "ran a value through an export of the pinned module).",
      );
    }
  } catch (err) {
    console.error(`Verification error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
