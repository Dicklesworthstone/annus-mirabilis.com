/**
 * Calls into the pinned FrankenSim module and the typed decoding of what comes back
 * (am-frankensim-repin-and-bind-jvhg).
 *
 * Each export returns a wasm-bindgen object holding an `envelope` string and a `values` buffer.
 * The envelope is `{"ok":{...}}`, `{"refusal":{...}}`, or `{"execution":{...}}` for philox's
 * budget miss. This module reads both fields, frees the object, and decodes the result into one
 * of three kinds:
 * - accepted, with the values;
 * - refused, with the registered refusal (wasmRefusalMap.ts);
 * - an execution outcome.
 * Malformed output is never passed on as a value. That covers an envelope that does not parse,
 * a buffer whose length disagrees with the envelope, a non-finite value, and values beside a
 * refusal. Each of these becomes the typed outcome `malformed-response`.
 *
 * Seeds and draw indices cross as BigInt, from canonical decimal strings, never through Number.
 * No module-level state: the caller passes the initialized exports.
 */

import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { makeRefusal, type RequestRefusal } from "../../experiments/results/refusals.ts";
import { mapFrankenSimRefusalEnvelope } from "../protocol/wasmRefusalMap.ts";

/** One export's return object, as the wasm-bindgen glue exposes it. */
export interface FrankenSimResultJs {
  readonly envelope: string;
  readonly values: Float64Array;
  free(): void;
}

/** The pinned module's exported surface (public/wasm/.../fs_annus_diffusion.d.ts). */
export interface FrankenSimExports {
  brownian_frames(
    nParticles: number,
    steps: number,
    stepKernel: number,
    seed: bigint,
    diffusion: number,
    dt: number,
  ): FrankenSimResultJs;
  philox_normals(
    seed: bigint,
    streamKernel: number,
    tile: number,
    startIndex: bigint,
    count: number,
  ): FrankenSimResultJs;
  diffusion1d_frames(
    n: number,
    frames: number,
    stepsPerFrame: number,
    diffusion: number,
    dx: number,
    dt: number,
    profile: number,
  ): FrankenSimResultJs;
  build_identity(): string;
}

export type FrankenSimExportName = "brownian_frames" | "philox_normals" | "diffusion1d_frames";

export type FrankenSimCall =
  | Readonly<{
      kind: "accepted";
      exportName: FrankenSimExportName;
      /** The `ok` body: kernel id, layout, quantity id and unit where the export names them. */
      ok: Readonly<Record<string, unknown>>;
      values: Float64Array;
    }>
  | Readonly<{ kind: "refused"; exportName: FrankenSimExportName; refusal: RequestRefusal }>
  | Readonly<{ kind: "outcome"; exportName: FrankenSimExportName; outcome: ExecutionOutcome }>;

const U64_MAX = 18446744073709551615n;

/** Canonical decimal string (the site's U64 encoding) to BigInt, refusing anything else. */
export function u64FromDecimal(text: string): bigint | null {
  if (!/^(0|[1-9][0-9]{0,19})$/.test(text)) return null;
  const v = BigInt(text);
  return v <= U64_MAX ? v : null;
}

function malformed(exportName: FrankenSimExportName, reason: string): FrankenSimCall {
  const d = executionOutcomeRegistry["malformed-response"];
  return {
    kind: "outcome",
    exportName,
    outcome: {
      outcome: "malformed-response",
      message: d.message,
      retry: d.retry,
      details: { reason, export: exportName },
    },
  };
}

const NO_IDENTITY = Object.freeze({
  instanceId: "frankensim-call",
  runId: "frankensim-call",
  actionIndex: 0,
  revisions: Object.freeze({ input: 0, observer: 0, measurement: 0, estimator: 0 }),
});

/** Expected buffer length for an ok envelope, from the envelope itself. */
function declaredLength(
  exportName: FrankenSimExportName,
  ok: Record<string, unknown>,
): number | null {
  if (exportName === "philox_normals") {
    const layout = ok.layout as Record<string, unknown> | undefined;
    return typeof layout?.length === "number" ? layout.length : null;
  }
  return typeof ok.valueCount === "number" ? ok.valueCount : null;
}

/**
 * Decode one envelope and its buffer. Exported for the malformed-output tests, which feed it
 * envelopes and buffers the module would never produce.
 */
export function decodeFrankenSimResult(
  exportName: FrankenSimExportName,
  envelopeText: string,
  values: Float64Array,
): FrankenSimCall {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelopeText);
  } catch {
    return malformed(exportName, "The envelope is not JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return malformed(exportName, "The envelope is not an object.");
  const keys = Object.keys(parsed);
  if (keys.length !== 1) return malformed(exportName, "The envelope must have exactly one key.");
  const key = keys[0];
  if (key === "ok") {
    const ok = (parsed as { ok: unknown }).ok;
    if (!ok || typeof ok !== "object" || Array.isArray(ok))
      return malformed(exportName, "The ok body is not an object.");
    const body = ok as Record<string, unknown>;
    if (body.export !== exportName)
      return malformed(exportName, `The ok envelope names ${String(body.export)}.`);
    const length = declaredLength(exportName, body);
    if (length === null || length !== values.length)
      return malformed(
        exportName,
        `The buffer has ${values.length} values; the envelope declares ${length}.`,
      );
    if (length === 0) return malformed(exportName, "An accepted result has no values.");
    for (let i = 0; i < values.length; i++)
      if (!Number.isFinite(values[i])) return malformed(exportName, `Value ${i} is not finite.`);
    return { kind: "accepted", exportName, ok: Object.freeze({ ...body }), values };
  }
  if (key === "refusal" || key === "execution") {
    if (values.length !== 0) return malformed(exportName, "A refusal envelope carried values.");
    const mapped = mapFrankenSimRefusalEnvelope(parsed, NO_IDENTITY, exportName);
    if (mapped.messageKind === "refusal")
      return { kind: "refused", exportName, refusal: mapped.refusal };
    return { kind: "outcome", exportName, outcome: mapped.outcome };
  }
  return malformed(exportName, `Unknown envelope key ${key}.`);
}

/**
 * wasm-bindgen converts a JS number to a usize or u32 without checking it, so -1 would arrive as
 * 4294967295 and 2.5 as 2. Whole numbers in [0, 2^32 - 1] only, refused before the call.
 */
function wholeArguments(
  exportName: FrankenSimExportName,
  named: Readonly<Record<string, number>>,
): FrankenSimCall | null {
  const bad = Object.entries(named)
    .filter(([, v]) => !Number.isSafeInteger(v) || v < 0 || v > 0xffffffff)
    .map(([k]) => k);
  if (bad.length === 0) return null;
  return {
    kind: "refused",
    exportName,
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds: bad },
      {
        details: {
          requirements: "Counts, kernels and indices are whole numbers from 0 to 4294967295.",
        },
      },
    ),
  };
}

function read(exportName: FrankenSimExportName, call: () => FrankenSimResultJs): FrankenSimCall {
  let result: FrankenSimResultJs;
  try {
    result = call();
  } catch (error) {
    const d = executionOutcomeRegistry["invariant-violation"];
    return {
      kind: "outcome",
      exportName,
      outcome: {
        outcome: "invariant-violation",
        message: d.message,
        retry: d.retry,
        details: { reason: "The module trapped.", export: exportName, error: String(error) },
      },
    };
  }
  try {
    return decodeFrankenSimResult(exportName, result.envelope, result.values);
  } finally {
    result.free();
  }
}

export function callBrownianFrames(
  exports: FrankenSimExports,
  p: Readonly<{
    nParticles: number;
    steps: number;
    stepKernel: number;
    seed: string;
    diffusion: number;
    dt: number;
  }>,
): FrankenSimCall {
  const seed = u64FromDecimal(p.seed);
  if (seed === null) return malformed("brownian_frames", "The seed is not a canonical u64 string.");
  const whole = wholeArguments("brownian_frames", {
    nParticles: p.nParticles,
    steps: p.steps,
    stepKernel: p.stepKernel,
  });
  if (whole) return whole;
  return read("brownian_frames", () =>
    exports.brownian_frames(p.nParticles, p.steps, p.stepKernel, seed, p.diffusion, p.dt),
  );
}

export function callPhiloxNormals(
  exports: FrankenSimExports,
  p: Readonly<{
    seed: string;
    streamKernel: number;
    tile: number;
    startIndex: string;
    count: number;
  }>,
): FrankenSimCall {
  const seed = u64FromDecimal(p.seed);
  const start = u64FromDecimal(p.startIndex);
  if (seed === null || start === null)
    return malformed("philox_normals", "The seed or start index is not a canonical u64 string.");
  const whole = wholeArguments("philox_normals", {
    streamKernel: p.streamKernel,
    tile: p.tile,
    count: p.count,
  });
  if (whole) return whole;
  return read("philox_normals", () =>
    exports.philox_normals(seed, p.streamKernel, p.tile, start, p.count),
  );
}

export function callDiffusion1dFrames(
  exports: FrankenSimExports,
  p: Readonly<{
    n: number;
    frames: number;
    stepsPerFrame: number;
    diffusion: number;
    dx: number;
    dt: number;
    profile: number;
  }>,
): FrankenSimCall {
  const whole = wholeArguments("diffusion1d_frames", {
    n: p.n,
    frames: p.frames,
    stepsPerFrame: p.stepsPerFrame,
    profile: p.profile,
  });
  if (whole) return whole;
  return read("diffusion1d_frames", () =>
    exports.diffusion1d_frames(p.n, p.frames, p.stepsPerFrame, p.diffusion, p.dx, p.dt, p.profile),
  );
}
