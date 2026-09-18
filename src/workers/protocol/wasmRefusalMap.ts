/**
 * FrankenSim Refusal Envelope Mapping Table and Translator.
 * Specification: docs/FRANKENSIM_BINDING.md §5.4, governed by bead am-rt-worker-protocol-gaq.
 *
 * Implements:
 * - Direct representation of the normative refusal mapping table
 * - Translation of FrankenSim {"refusal": {"code", "message", "ranked_repairs", ...}}
 * - Budget rows mapped to ExecutionOutcome "budget-exhausted"
 * - Refusal rows mapped to RequestRefusal with reader text from refusalCodeRegistry
 * - Upstream message and ranked_repairs preserved in details
 * - Unmapped upstream codes translated to ExecutionOutcome "malformed-response"
 */

import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { type RefusalCode, refusalCodeRegistry } from "../../experiments/results/refusalCodes.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import type { DomainKind } from "../../experiments/results/types.ts";
import type { OutcomeResponse, RefusalResponse, Revisions } from "./schema.ts";

export type TargetKind = "refusal-code" | "execution-outcome";

export interface RefusalMappingRow {
  readonly export: string;
  readonly upstreamCode: string;
  readonly when: string;
  readonly target: RefusalCode | "budget-exhausted";
  readonly targetKind: TargetKind;
  readonly domainKind?: DomainKind;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly rankedRepairs?: readonly string[];
}

export const REFUSAL_MAPPING_ROWS: readonly RefusalMappingRow[] = Object.freeze([
  // brownian_frames
  {
    export: "brownian_frames",
    upstreamCode: "unsupported-step-kernel",
    when: "step_kernel not in {0,1,2,3}",
    target: "unsupported-kernel",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { stepKernel: "<requested>" },
    rankedRepairs: [
      "use step_kernel 0 (coin), 1 (uniform), 2 (unit Gaussian teaching), or 3 (Gaussian with exact D)",
    ],
  },
  {
    export: "brownian_frames",
    upstreamCode: "nonfinite-diffusion-or-dt",
    when: "diffusion or dt is NaN or Inf",
    target: "nonfinite-input",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "diffusion|dt", value: "<debug>" },
    rankedRepairs: ["pass a finite diffusion (>= 0) and a finite dt (> 0)"],
  },
  {
    export: "brownian_frames",
    upstreamCode: "invalid-diffusion-or-dt",
    when: "diffusion < 0, or dt <= 0, both finite",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "diffusion|dt", value: "<debug>" },
    rankedRepairs: ["use diffusion >= 0; use dt > 0", "diffusion = 0 is valid and returns zeros"],
  },
  {
    export: "brownian_frames",
    upstreamCode: "zero-particles-or-steps",
    when: "n_particles == 0 or steps == 0",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "n_particles|steps", value: 0 },
    rankedRepairs: ["use n_particles >= 1 and steps >= 1"],
  },
  {
    export: "brownian_frames",
    upstreamCode: "tile-width-exceeded",
    when: "n_particles > u32::MAX",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "n_particles", limit: 4294967295 },
    rankedRepairs: ["n_particles must fit StreamKey.tile (u32)"],
  },
  {
    export: "brownian_frames",
    upstreamCode: "output-len-overflow-or-budget",
    when: "n_particles * (steps + 1) overflows or exceeds BROWNIAN_MAX_OUTPUT_LEN",
    target: "budget-exhausted",
    targetKind: "execution-outcome",
    details: { requested: "<len>", allowed: 2097152, unit: "f64-values" },
    rankedRepairs: ["use brownian_frames_window with a smaller steps", "reduce n_particles"],
  },

  // brownian_frames_window
  {
    export: "brownian_frames_window",
    upstreamCode: "bad-start-positions",
    when: "len != n_particles, a nonfinite entry, or a nonzero entry with start_step == 0",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "start_positions", index: "<first bad>" },
    rankedRepairs: ["pass n_particles finite positions", "start_step 0 requires all zeros"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "window-steps-zero",
    when: "steps == 0",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "steps", value: 0 },
    rankedRepairs: ["window steps must be >= 1"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "stream-index-overflow",
    when: "draws_per_step * (start_step + steps) exceeds 2^64-1",
    target: "stream-index-overflow",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      startIndex: "<derived>",
      draws: "<needed>",
      maxIndex: "18446744073709551615",
    },
    rankedRepairs: [
      "reduce start_step + steps",
      "use a coin or uniform kernel (1 draw/step) if the Gaussian 2-draw counter is the limiter",
    ],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "InvalidCheckpointLength",
    when: "StreamReplayError::InvalidCheckpointLength",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      reason: "checkpoint-disagreement",
      field: "length",
      declared: "<actual>",
      expected: 83,
    },
    rankedRepairs: ["supply an 83-byte canonical StreamCheckpoint frame"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "InvalidCheckpointMagic",
    when: "StreamReplayError::InvalidCheckpointMagic",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { reason: "checkpoint-disagreement", field: "magic" },
    rankedRepairs: ["frame must begin with FSRCKPT\\0"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "InvalidCheckpointDomain",
    when: "StreamReplayError::InvalidCheckpointDomain",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { reason: "checkpoint-disagreement", field: "domain" },
    rankedRepairs: ["use the fs-rand stream-checkpoint identity domain"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "UnknownCheckpointVersion",
    when: "StreamReplayError::UnknownCheckpointVersion",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      reason: "checkpoint-disagreement",
      field: "checkpoint_version",
      declared: "<v>",
      expected: 1,
    },
    rankedRepairs: ["rebuild the checkpoint under STREAM_CHECKPOINT_VERSION = 1"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "UnknownStreamSemanticsVersion",
    when: "StreamReplayError::UnknownStreamSemanticsVersion",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      reason: "checkpoint-disagreement",
      field: "stream_semantics_version",
      declared: "<v>",
      expected: 1,
    },
    rankedRepairs: ["rebuild the checkpoint under STREAM_SEMANTICS_VERSION = 1"],
  },
  {
    export: "brownian_frames_window",
    upstreamCode: "checkpoint-key-or-index-mismatch",
    when: "resumed kernel, tile, or derived index disagrees with start_step",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      reason: "checkpoint-disagreement",
      field: "kernel|tile|index",
      declared: "<v>",
      expected: "<from start_step>",
    },
    rankedRepairs: [
      "do not pass a checkpoint; the window derives the draw index from start_step",
      "or pass a checkpoint whose key and index match the derivation",
    ],
  },

  // philox_normals
  {
    export: "philox_normals",
    upstreamCode: "count-zero",
    when: "count == 0",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "count", value: 0 },
    rankedRepairs: ["request count >= 1"],
  },
  {
    export: "philox_normals",
    upstreamCode: "count-budget",
    when: "count > PHILOX_NORMALS_MAX_COUNT",
    target: "budget-exhausted",
    targetKind: "execution-outcome",
    details: { requested: "<count>", allowed: 1048576, unit: "normals" },
    rankedRepairs: ["request fewer normals", "issue several calls with advancing start_index"],
  },
  {
    export: "philox_normals",
    upstreamCode: "stream-index-overflow",
    when: "start_index + 2*count exceeds 2^64-1 (wrapping would occur)",
    target: "stream-index-overflow",
    targetKind: "refusal-code",
    domainKind: "input",
    details: {
      startIndex: "<start_index>",
      draws: "<2*count>",
      maxIndex: "18446744073709551615",
    },
    rankedRepairs: [
      "reduce count",
      "lower start_index",
      "start_index=18446744073709551613 count=1 is the last accepted pair",
    ],
  },

  // diffusion1d_frames
  {
    export: "diffusion1d_frames",
    upstreamCode: "ftcs-unstable",
    when: "r = (diffusion * dt) / (dx * dx) > 0.5, no epsilon",
    target: "ftcs-unstable",
    targetKind: "refusal-code",
    domainKind: "numerical",
    details: {
      ratio: "<r>",
      limit: 0.5,
      dtMax: "(dx * dx) / (2.0 * diffusion)",
    },
    rankedRepairs: [
      "use dt = dtMax",
      "increase dx to at least sqrt(2 D dt)",
      "reduce diffusion to at most dx^2 / (2 dt)",
    ],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "n-too-small",
    when: "n < 3",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "n", value: "<n>", limit: 3 },
    rankedRepairs: ["n must be >= 3 (two boundaries and at least one interior cell)"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "zero-frames-or-spf",
    when: "frames == 0 or steps_per_frame == 0",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "frames|steps_per_frame", value: 0 },
    rankedRepairs: ["use frames >= 1 and steps_per_frame >= 1"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "nonfinite-scalars",
    when: "diffusion, dx, or dt is NaN or Inf",
    target: "nonfinite-input",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "diffusion|dx|dt" },
    rankedRepairs: ["pass finite diffusion, dx, and dt"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "invalid-scalars",
    when: "diffusion < 0, or dx <= 0, or dt <= 0, all finite",
    target: "invalid-parameter",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { name: "diffusion|dx|dt" },
    rankedRepairs: ["diffusion >= 0; dx > 0; dt > 0", "diffusion = 0 is valid"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "unsupported-profile",
    when: "profile not in {0,1,2}",
    target: "unsupported-kernel",
    targetKind: "refusal-code",
    domainKind: "input",
    details: { profile: "<requested>" },
    rankedRepairs: ["use profile 0 (spike), 1 (step), or 2 (two spikes)"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "output-len-budget",
    when: "frames * n overflows or exceeds DIFFUSION1D_MAX_OUTPUT_LEN",
    target: "budget-exhausted",
    targetKind: "execution-outcome",
    details: { requested: "<len>", allowed: 2097152, unit: "f64-values" },
    rankedRepairs: ["reduce frames or n"],
  },
  {
    export: "diffusion1d_frames",
    upstreamCode: "total-steps-budget",
    when: "frames * steps_per_frame overflows or exceeds DIFFUSION1D_MAX_TOTAL_STEPS",
    target: "budget-exhausted",
    targetKind: "execution-outcome",
    details: { requested: "<steps>", allowed: 1048576, unit: "ftcs-steps" },
    rankedRepairs: ["reduce frames or steps_per_frame"],
  },
]);

export interface FrankenSimRefusalEnvelope {
  readonly refusal: {
    readonly code: string;
    readonly message?: string;
    readonly ranked_repairs?: readonly string[];
    readonly details?: Record<string, unknown>;
  };
}

export interface MessageIdentity {
  readonly instanceId: string;
  readonly runId: string;
  readonly actionIndex: number;
  readonly revisions: Revisions;
}

/**
 * Maps a FrankenSim refusal envelope to either a RefusalResponse or an OutcomeResponse.
 */
export function mapFrankenSimRefusalEnvelope(
  envelope: unknown,
  identity: MessageIdentity,
  exportName?: string,
): RefusalResponse | OutcomeResponse {
  if (
    envelope === null ||
    typeof envelope !== "object" ||
    !("refusal" in envelope) ||
    (envelope as any).refusal === null ||
    typeof (envelope as any).refusal !== "object"
  ) {
    const malformed = executionOutcomeRegistry["malformed-response"];
    return {
      messageKind: "outcome",
      ...identity,
      outcome: {
        outcome: "malformed-response",
        message: malformed.message,
        retry: malformed.retry,
        details: { reason: "Refusal envelope must have top-level refusal object." },
      },
    };
  }

  const rawRefusal = (envelope as any).refusal;
  const rawCode = String(rawRefusal.code ?? "");
  const rawMessage = typeof rawRefusal.message === "string" ? rawRefusal.message : undefined;
  const rawRepairs = Array.isArray(rawRefusal.ranked_repairs)
    ? rawRefusal.ranked_repairs.map(String)
    : undefined;
  const rawDetails =
    rawRefusal.details && typeof rawRefusal.details === "object" ? { ...rawRefusal.details } : {};

  // Find in mapping table
  const matchingRow = REFUSAL_MAPPING_ROWS.find((row) => {
    if (exportName && row.export !== exportName) return false;
    return row.upstreamCode === rawCode;
  });

  if (!matchingRow) {
    // Unmapped upstream code -> malformed-response outcome
    const malformed = executionOutcomeRegistry["malformed-response"];
    return {
      messageKind: "outcome",
      ...identity,
      outcome: {
        outcome: "malformed-response",
        message: malformed.message,
        retry: malformed.retry,
        details: {
          reason: `Unmapped upstream refusal code: "${rawCode}"`,
          upstreamCode: rawCode,
          ...(rawMessage ? { upstreamMessage: rawMessage } : {}),
          ...(exportName ? { export: exportName } : {}),
        },
      },
    };
  }

  // Preserve upstream message and ranked_repairs in details for diagnostics
  const mergedDetails: Record<string, unknown> = {
    ...rawDetails,
    upstreamCode: rawCode,
    ...(rawMessage ? { upstreamMessage: rawMessage } : {}),
    ...(rawRepairs ? { upstreamRankedRepairs: rawRepairs } : {}),
  };

  if (matchingRow.targetKind === "execution-outcome") {
    // Target is budget-exhausted
    const outcomeDef = executionOutcomeRegistry["budget-exhausted"];
    const requestedWork = typeof rawDetails.requested === "number" ? rawDetails.requested : 0;
    const allowedWork = typeof rawDetails.allowed === "number" ? rawDetails.allowed : 0;

    return {
      messageKind: "outcome",
      ...identity,
      outcome: {
        outcome: "budget-exhausted",
        message: outcomeDef.message,
        retry: outcomeDef.retry,
        requested: { workUnits: requestedWork, allocationBytes: 0 },
        allowed: { workUnits: allowedWork, allocationBytes: 0 },
        details: mergedDetails as any,
      },
    };
  }

  // Target is a RefusalCode
  const targetCode = matchingRow.target as RefusalCode;
  const definition = refusalCodeRegistry[targetCode];
  if (!definition) {
    throw new Error(
      `Target refusal code "${targetCode}" is not registered in refusalCodeRegistry.`,
    );
  }

  // Repairs: reader text from definition, or ranked repairs from table
  const repairs =
    matchingRow.rankedRepairs && matchingRow.rankedRepairs.length > 0
      ? matchingRow.rankedRepairs.map((r) => ({ label: r }))
      : [{ label: definition.repair }];

  const affected =
    typeof rawDetails.name === "string" ? { parameterIds: [rawDetails.name] as const } : {};

  const refusal: RequestRefusal = {
    code: targetCode,
    domainKind: matchingRow.domainKind ?? definition.domainKind,
    affected,
    message: definition.message,
    rankedRepairs: repairs,
    details: mergedDetails as any,
  };

  return {
    messageKind: "refusal",
    ...identity,
    refusal,
  };
}
